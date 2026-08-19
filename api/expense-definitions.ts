// Serve the Definitions tab of the SD118 Expenses spreadsheet.
// Admin sees every row where Project == 'Operating'.
// Crew sees only rows where 'Show to user' (col D) == 'yes'.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = { maxDuration: 15 }

const SPREADSHEET_ID = '1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk'

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export type DefinitionRow = {
  project: string
  category: string
  subcategory: string
  showToUser: boolean
  chrissy?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Definitions!A2:E300',
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const values = resp.data.values || []
    const rows: DefinitionRow[] = []
    for (const r of values) {
      const project = String(r[0] ?? '').trim()
      const category = String(r[1] ?? '').trim()
      const subcategory = String(r[2] ?? '').trim()
      if (!project || !category || !subcategory) continue
      const showToUser = String(r[3] ?? '').trim().toLowerCase() === 'yes'
      const chrissy = String(r[4] ?? '').trim() || undefined
      rows.push({ project, category, subcategory, showToUser, chrissy })
    }
    // Cache 5 min at the CDN so we don't slam the Sheets API on every intake.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ ok: true, rows })
  } catch (err: any) {
    console.error('expense-definitions error:', err)
    return res.status(500).json({ error: 'Failed to load definitions', detail: err?.message || String(err) })
  }
}
