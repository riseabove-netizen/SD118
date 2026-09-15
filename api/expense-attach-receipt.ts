// Attach a Drive receipt URL to the Expenses row previously submitted by admin
// for a given Plaid txn. Preserves ALL admin edits: only writes col O if empty.
//
// POST { plaid_txn_id: string, receiptUrl: string }
//   -> { ok: true, row: number, updated: boolean, already?: boolean }
//   -> { ok: false, error: 'not_found' | ... }
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = { maxDuration: 20 }

const SPREADSHEET_ID = '1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk'
const EXPENSES_SHEET_TITLE = 'Expenses'

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  const body = (req.body || {}) as { plaid_txn_id?: string; receiptUrl?: string }
  const txnId = String(body.plaid_txn_id || '').trim()
  const url = String(body.receiptUrl || '').trim()
  if (!txnId) return res.status(400).json({ ok: false, error: 'plaid_txn_id required' })
  if (!url) return res.status(400).json({ ok: false, error: 'receiptUrl required' })

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Read only col S (crosscheck) and col O (existing receipt). Header on row 1.
    // We fetch S first to find the row cheaply — Sheets returns the range as
    // a 2D array where row i corresponds to sheet row i+2.
    const crosscheckResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${EXPENSES_SHEET_TITLE}!S2:S`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const crossVals = crosscheckResp.data.values || []
    const needle = `matched:${txnId}`
    // Scan bottom-up: admin's latest edit wins if txn was ever re-submitted.
    let rowIndex = -1
    for (let i = crossVals.length - 1; i >= 0; i--) {
      const cell = String(crossVals[i]?.[0] ?? '').trim()
      if (cell === needle) { rowIndex = i + 2; break }
    }
    if (rowIndex < 0) return res.status(200).json({ ok: false, error: 'not_found' })

    // Check col O — never overwrite an existing receipt URL (that would clobber
    // admin's own attachment if they already added one).
    const receiptResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${EXPENSES_SHEET_TITLE}!O${rowIndex}:O${rowIndex}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const existing = String(receiptResp.data.values?.[0]?.[0] ?? '').trim()
    if (existing) {
      return res.status(200).json({ ok: true, row: rowIndex, updated: false, already: true })
    }

    // Empty — attach the new receipt URL.
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${EXPENSES_SHEET_TITLE}!O${rowIndex}:O${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[url]] },
    })
    return res.status(200).json({ ok: true, row: rowIndex, updated: true })
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) })
  }
}
