// POST /api/plaid/queue-undo — admin only.
// Reverses a queue-submit for a single txn:
//   1) Deletes the Expenses row that was written (identified by (txn_id via crosscheck) OR explicit row number).
//   2) Resets the Plaid_Transactions row back to 'pending' so it re-appears in the queue.
//
// Called by the client's 10-second undo toast after auto-drain or manual submit.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { requireAdmin } from '../_plaid.js'
import { findRowByTxnId, updatePlaidTxnStatus } from '../_plaid-txns.js'

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

async function withRetry<T>(op: () => Promise<T>, opName: string, maxAttempts = 6): Promise<T> {
  let delay = 1000
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await op() } catch (err: any) {
      const status = err?.code || err?.response?.status
      if ((status !== 429 && status !== 503 && status !== 500) || attempt === maxAttempts) throw err
      console.warn(`[queue-undo] ${opName} attempt ${attempt} got ${status}, retry in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay + Math.random() * 500))
      delay = Math.min(delay * 2, 16000)
    }
  }
  throw new Error(`${opName} exhausted retries`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  const body = req.body as { txn_id?: string; expensesRow?: number }
  const txn_id = body?.txn_id
  const explicitRow = typeof body?.expensesRow === 'number' ? body.expensesRow : null
  if (!txn_id) return res.status(400).json({ error: 'txn_id required' })

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Resolve the Expenses sheetId (needed for the deleteDimension request).
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets(properties(sheetId,title))',
    })
    const expensesSheet = meta.data.sheets?.find(s => s.properties?.title === EXPENSES_SHEET_TITLE)
    const expensesSheetId = expensesSheet?.properties?.sheetId
    if (typeof expensesSheetId !== 'number') throw new Error('Could not resolve Expenses sheetId')

    // Locate the row to delete: prefer the explicit rowNum the client remembered,
    // fall back to scanning col S for `matched:<txn_id>`.
    let rowToDelete = explicitRow
    if (!rowToDelete) {
      const scan = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${EXPENSES_SHEET_TITLE}!S:S`,
      })
      const values: string[][] = (scan.data.values as any) || []
      const marker = `matched:${txn_id}`
      // Rows are 1-indexed; sheet has a header row at 1.
      for (let i = values.length - 1; i >= 0; i--) {
        if ((values[i]?.[0] || '').trim() === marker) { rowToDelete = i + 1; break }
      }
    }
    if (!rowToDelete || rowToDelete < 2) {
      return res.status(404).json({ ok: false, error: `No Expenses row found for txn ${txn_id}` })
    }

    // Delete the row (1-based sheet row -> 0-based dimension index).
    await withRetry(() => sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: expensesSheetId,
              dimension: 'ROWS',
              startIndex: rowToDelete! - 1,
              endIndex: rowToDelete!,
            },
          },
        }],
      },
    }), 'delete-row')

    // Reset the Plaid_Transactions row back to 'pending' (empty submitted_at).
    const plaidRow = await findRowByTxnId(txn_id)
    if (plaidRow) {
      try {
        await updatePlaidTxnStatus(plaidRow, 'pending', '')
      } catch (e: any) {
        console.warn('queue-undo: could not reset plaid status:', e?.message)
      }
    }

    return res.status(200).json({ ok: true, deletedRow: rowToDelete })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
}
