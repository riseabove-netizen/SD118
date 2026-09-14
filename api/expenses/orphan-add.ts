// POST /api/expenses/orphan-add — crew or admin.
// Appends an OCR'd receipt that failed to match a Plaid transaction (even after a fresh sync)
// to the Orphan_Receipts sheet, so an admin can resolve it later.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { requireCrew, sheetsAuth, SPREADSHEET_ID } from '../_plaid.js'

export const ORPHAN_TAB = 'Orphan_Receipts'

function newId(): string {
  return `orph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireCrew(req, res)) return
  const body = req.body as {
    receipt_url?: string
    receipt_thumb_url?: string
    ocr?: { merchant?: string | null; date?: string | null; eur?: number | null; usd?: number | null }
    addedBy?: string
  }
  const receiptUrl = body?.receipt_url || ''
  const thumbUrl = body?.receipt_thumb_url || ''
  const ocr = body?.ocr || {}
  const addedBy = body?.addedBy || ''
  if (!receiptUrl) return res.status(400).json({ error: 'receipt_url required' })

  try {
    const id = newId()
    const auth = sheetsAuth(true)
    const sheets = google.sheets({ version: 'v4', auth })
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ORPHAN_TAB}!A:J`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          id,
          new Date().toISOString(),
          receiptUrl,
          thumbUrl,
          ocr.merchant || '',
          ocr.date || '',
          ocr.eur ?? '',
          ocr.usd ?? '',
          addedBy,
          'pending',
        ]],
      },
    })
    return res.status(200).json({ ok: true, id })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
