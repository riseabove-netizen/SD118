// POST /api/expenses/orphan-resolve — admin only.
// Marks one or more orphan rows as 'resolved' (or 'skipped').
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { requireAdmin, sheetsAuth, SPREADSHEET_ID } from '../_plaid.js'

export const ORPHAN_TAB = 'Orphan_Receipts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  const body = req.body as { ids?: string[]; status?: 'resolved' | 'skipped' }
  const ids = Array.isArray(body?.ids) ? body!.ids! : []
  const status = body?.status === 'skipped' ? 'skipped' : 'resolved'
  if (ids.length === 0) return res.status(400).json({ error: 'ids[] required' })

  try {
    const auth = sheetsAuth(true)
    const sheets = google.sheets({ version: 'v4', auth })
    // Read once, find rows, write J column per row.
    const readResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ORPHAN_TAB}!A2:A`,
    })
    const idCol = readResp.data.values || []
    const idToRow = new Map<string, number>()
    idCol.forEach((r, i) => { if (r[0]) idToRow.set(String(r[0]), i + 2) })
    const data = ids
      .map(id => idToRow.get(id))
      .filter((r): r is number => !!r)
      .map(row => ({ range: `${ORPHAN_TAB}!J${row}`, values: [[status]] }))
    if (data.length === 0) return res.status(200).json({ ok: true, updated: 0 })
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data },
    })
    return res.status(200).json({ ok: true, updated: data.length })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
