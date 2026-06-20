import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Failed to load guides', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }

  const guideId = String(req.query.id || '').trim()
  const withContent = String(req.query.withContent || '') === '1' || !!guideId

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    const metaResp = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTORY_ID,
      range: 'Guides!A:H',
    })
    const metaRows = metaResp.data.values || []
    if (metaRows.length < 2) return res.status(200).json({ guides: [], guide: null })

    const metaHeaders = metaRows[0]
    let guides = metaRows.slice(1).map((row, i) => {
      const obj: Record<string, any> = { rowIndex: i + 2 }
      metaHeaders.forEach((h, j) => {
        obj[h] = row[j] || ''
      })
      return obj
    })

    if (guideId) {
      guides = guides.filter(g => g.ID === guideId)
      if (guides.length === 0) return res.status(404).json({ error: 'Guide not found' })
    }

    if (!withContent) {
      return res.status(200).json({ guides })
    }

    // Pull versions for the requested guide(s)
    const versionsResp = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTORY_ID,
      range: 'GuideVersions!A:F',
    })
    const vRows = versionsResp.data.values || []
    const vHeaders = vRows[0] || []
    const allVersions = vRows.slice(1).map(row => {
      const obj: Record<string, any> = {}
      vHeaders.forEach((h, j) => {
        obj[h] = row[j] || ''
      })
      return obj
    })

    const enriched = guides.map(g => {
      const versions = allVersions
        .filter(v => v['Guide ID'] === g.ID)
        .sort((a, b) => Number(b.Version || 0) - Number(a.Version || 0))
      const currentVersion = String(g['Current Version'] || versions[0]?.Version || '1')
      const current = versions.find(v => String(v.Version) === currentVersion) || versions[0]
      return {
        ...g,
        Markdown: current?.Markdown || '',
        versions: versions.map(v => ({
          version: Number(v.Version || 0),
          createdAt: v['Created At'] || '',
          createdBy: v['Created By'] || '',
          note: v.Note || '',
        })),
      }
    })

    if (guideId) {
      return res.status(200).json({ guide: enriched[0] })
    }
    return res.status(200).json({ guides: enriched })
  } catch (error: any) {
    console.error('guides-list error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to load guides', detail })
  }
}
