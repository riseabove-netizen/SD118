import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { renderGuidePdf } from './_guide-pdf'

// Kept as a separate serverless function from api/guides.ts on purpose.
// Bundling pdf-lib + the ~715-line PDF renderer into guides.ts pushed that
// function past Vercel's serverless size limit and every guides.* call started
// returning FUNCTION_INVOCATION_FAILED. Splitting the archive path out keeps
// guides.ts lightweight (Sheets + Anthropic only) and puts the heavy PDF
// dependency on its own cold path.

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
  maxDuration: 60,
}

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

function slugify(s: string): string {
  return (s || 'guide')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function getSheetsAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function getDriveAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)

async function handleArchive(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  const manualsFolderId = cleanEnv(process.env.MANUALS_FOLDER_ID)
  if (!manualsFolderId) {
    return res.status(500).json({ error: 'Server not configured', detail: 'MANUALS_FOLDER_ID not set' })
  }

  const guideId = String(req.query.id || (req.body as any)?.id || '').trim()
  if (!guideId) return res.status(400).json({ error: 'Invalid body', detail: 'guide id is required' })

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const metaResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'Guides!A:H',
  })
  const metaRows = metaResp.data.values || []
  if (metaRows.length < 2) return res.status(404).json({ error: 'Guide not found' })
  const headers = metaRows[0]
  const row = metaRows.slice(1).find(r => r[0] === guideId)
  if (!row) return res.status(404).json({ error: 'Guide not found' })

  const g: Record<string, string> = {}
  headers.forEach((h, j) => { g[h] = row[j] || '' })

  const versionsResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'GuideVersions!A:F',
  })
  const vRows = versionsResp.data.values || []
  const vHeaders = vRows[0] || []
  const versions = vRows.slice(1).map(r => {
    const obj: Record<string, string> = {}
    vHeaders.forEach((h, j) => { obj[h] = r[j] || '' })
    return obj
  })
  const current = versions
    .filter(v => v['Guide ID'] === guideId)
    .sort((a, b) => Number(b.Version || 0) - Number(a.Version || 0))[0]
  const markdown = current?.Markdown || ''
  if (!markdown.trim()) {
    return res.status(400).json({ error: 'Guide has no content to archive' })
  }

  const pdfBytes = await renderGuidePdf({
    title: g['Title'] || 'Operational Guide',
    category: g['Category'] || '',
    version: g['Current Version'] || '1',
    updatedAt: g['Updated At'] || '',
    updatedBy: g['Updated By'] || '',
    markdown,
  })

  const driveAuth = getDriveAuth()
  const drive = google.drive({ version: 'v3', auth: driveAuth })
  const filename = `${slugify(g['Title'] || 'guide')}-v${g['Current Version'] || '1'}.pdf`

  try {
    const baseSlug = slugify(g['Title'] || 'guide')
    const listResp = await drive.files.list({
      q: `'${manualsFolderId}' in parents and trashed=false and name contains '${baseSlug}'`,
      fields: 'files(id,name)',
      pageSize: 20,
    })
    for (const f of listResp.data.files || []) {
      if (f.name && f.name.startsWith(baseSlug + '-v') && f.name.endsWith('.pdf') && f.id) {
        await drive.files.update({ fileId: f.id, requestBody: { trashed: true } })
      }
    }
  } catch (err: any) {
    console.warn('archive: prior-version cleanup failed (non-fatal)', err?.message || err)
  }

  const uploadResp = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [manualsFolderId],
      mimeType: 'application/pdf',
      description: `Operational guide — ${g['Title']} (v${g['Current Version'] || '1'}) archived ${new Date().toISOString()}`,
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(Buffer.from(pdfBytes)),
    },
    fields: 'id,name,webViewLink,webContentLink',
  })
  const fileId = uploadResp.data.id
  if (!fileId) return res.status(500).json({ error: 'Upload failed' })

  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    })
  } catch (err: any) {
    console.warn('archive: setting anyone-reader failed (non-fatal)', err?.message || err)
  }

  return res.status(200).json({
    ok: true,
    fileId,
    name: uploadResp.data.name,
    viewUrl: uploadResp.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    downloadUrl: uploadResp.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    return await handleArchive(req, res)
  } catch (error: any) {
    console.error('guide-archive error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Archive failed', detail })
  }
}
