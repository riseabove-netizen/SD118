// GET /api/expenses/orphan-list — admin only.
// Lists pending orphan receipts (OCR'd receipts that never matched a Plaid txn).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { requireAdmin, sheetsAuth, SPREADSHEET_ID } from '../_plaid.js'

export const ORPHAN_TAB = 'Orphan_Receipts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  try {
    const auth = sheetsAuth(false)
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ORPHAN_TAB}!A2:J`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const values = resp.data.values || []
    const rows = values.map((r, i) => ({
      row: i + 2,
      id: String(r[0] ?? ''),
      added_at: String(r[1] ?? ''),
      receipt_url: String(r[2] ?? ''),
      receipt_thumb_url: String(r[3] ?? ''),
      ocr_merchant: String(r[4] ?? ''),
      ocr_date: String(r[5] ?? ''),
      ocr_eur: r[6] === '' || r[6] == null ? null : (typeof r[6] === 'number' ? r[6] : parseFloat(String(r[6])) || null),
      ocr_usd: r[7] === '' || r[7] == null ? null : (typeof r[7] === 'number' ? r[7] : parseFloat(String(r[7])) || null),
      added_by: String(r[8] ?? ''),
      status: String(r[9] ?? 'pending'),
    })).filter(r => r.id && r.status !== 'resolved' && r.status !== 'skipped')
    return res.status(200).json({ ok: true, orphans: rows, count: rows.length })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
