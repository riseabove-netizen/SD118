import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
  maxDuration: 30,
}

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function newId() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  return `G-${stamp}-${Math.random().toString(36).slice(2, 6)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }

  const body = req.body as {
    id?: string
    title?: string
    category?: string
    markdown?: string
    note?: string
    user?: string
  }
  if (!body || !body.title || !body.markdown) {
    return res.status(400).json({ error: 'Invalid body', detail: 'title and markdown are required' })
  }

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const nowIso = new Date().toISOString()
    const user = (body.user || 'crew').trim()
    const category = (body.category || '').trim()
    const title = body.title.trim()
    const markdown = body.markdown
    const note = (body.note || '').trim()

    // Load existing Guides
    const metaResp = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTORY_ID,
      range: 'Guides!A:H',
    })
    const metaRows = metaResp.data.values || []
    const headers = metaRows[0] || ['ID', 'Title', 'Category', 'Current Version', 'Updated At', 'Updated By', 'Created At', 'Created By']

    let guideId = (body.id || '').trim()
    let isNew = !guideId
    let createdAt = nowIso
    let createdBy = user
    let nextVersion = 1
    let existingRowIdx = -1

    if (!isNew) {
      existingRowIdx = metaRows.slice(1).findIndex(r => r[0] === guideId)
      if (existingRowIdx < 0) {
        return res.status(404).json({ error: 'Guide not found' })
      }
      const existing = metaRows[existingRowIdx + 1]
      createdAt = existing[6] || nowIso
      createdBy = existing[7] || user
      nextVersion = Number(existing[3] || 0) + 1
    } else {
      guideId = newId()
    }

    // Append the new version
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: 'GuideVersions!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[guideId, String(nextVersion), nowIso, user, markdown, note]],
      },
    })

    const rowValues = [guideId, title, category, String(nextVersion), nowIso, user, createdAt, createdBy]

    if (isNew) {
      // If headers missing, write them
      if (metaRows.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: INVENTORY_ID,
          range: 'Guides!A1:H1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers] },
        })
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId: INVENTORY_ID,
        range: 'Guides!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      })
    } else {
      const sheetRow = existingRowIdx + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId: INVENTORY_ID,
        range: `Guides!A${sheetRow}:H${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      })
    }

    return res.status(200).json({ ok: true, id: guideId, version: nextVersion })
  } catch (error: any) {
    console.error('guides-upsert error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to save guide', detail })
  }
}
