// Bilt email -> expense queue.
// Bilt only emails purchase alerts to the cardholder who made the charge, so
// every alert in Gabriel's inbox is Gabriel's charge (Enrico's authorized-user
// cards never generate one). Plaid's Bilt feed mixed both cardholders, so the
// Bilt Plaid item was unlinked and these alerts are now the Bilt source.
//
// Each parsed alert becomes a Plaid_Transactions row with
//   txn_id = "bilt-email:<message_id>", payment_channel = "email", mask 0540
// so the existing queue / submit / receipt flow handles it unchanged.
// Before queueing we cross-check Expenses (account Bilt, same amount, date
// within 3 days) and existing queue rows, so already-listed charges are not
// inserted twice.
import { google } from 'googleapis'
import { sheetsAuth, SPREADSHEET_ID } from './_plaid.js'
import { readAllPlaidTxns, appendPlaidTxns, type PlaidTxnRow } from './_plaid-txns.js'

export type BiltAlert = { message_id: string; txn_date: string; merchant: string; usd_amount: string }

const dayDiff = (a: string, b: string) =>
  Math.abs((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000)

function sheetDateToIso(v: any): string {
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const s = String(v || '')
  const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  const u = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (u) return `${u[3]}-${u[1].padStart(2, '0')}-${u[2].padStart(2, '0')}`
  return ''
}

export async function readBiltExpenseRows(): Promise<Array<{ date: string; amount: number }>> {
  const sheets = google.sheets({ version: 'v4', auth: sheetsAuth(false) })
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Expenses!A2:H',
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  return (resp.data.values || [])
    .filter(r => /bilt/i.test(String(r[1] ?? '')) && !/enrico/i.test(String(r[1] ?? '')))
    .map(r => ({ date: sheetDateToIso(r[0]), amount: typeof r[7] === 'number' ? r[7] : parseFloat(String(r[7] ?? '').replace(/[$,]/g, '')) || 0 }))
    .filter(r => r.date)
}

export type QueueResult = { message_id: string; status: 'queued' | 'already_listed' | 'already_queued' | 'skipped'; reason?: string }

// Queue a batch of alerts. Pass pre-read rows to avoid re-reading per alert.
export async function queueBiltAlerts(alerts: BiltAlert[], opts?: { expenses?: Array<{ date: string; amount: number }>; txns?: PlaidTxnRow[] }): Promise<QueueResult[]> {
  const expenses = opts?.expenses ?? await readBiltExpenseRows()
  const txns = opts?.txns ?? await readAllPlaidTxns()
  const usedExpense = new Set<number>()
  const usedTxn = new Set<number>()
  const out: QueueResult[] = []
  const toAppend: Array<Omit<PlaidTxnRow, 'rowIndex'>> = []
  const now = new Date().toISOString()
  for (const a of alerts) {
    const amount = parseFloat(a.usd_amount)
    const id = `bilt-email:${a.message_id}`
    if (!a.message_id || !a.txn_date || !(amount > 0)) { out.push({ message_id: a.message_id, status: 'skipped', reason: 'no amount/date' }); continue }
    if (txns.some(t => t.txn_id === id) || toAppend.some(t => t.txn_id === id)) { out.push({ message_id: a.message_id, status: 'already_queued' }); continue }
    // Already on Expenses (Bilt, same amount, within 3 days)?
    const ei = expenses.findIndex((e, i) => !usedExpense.has(i) && Math.abs(e.amount - amount) < 0.01 && dayDiff(e.date, a.txn_date) <= 3)
    if (ei >= 0) { usedExpense.add(ei); out.push({ message_id: a.message_id, status: 'already_listed', reason: 'on Expenses' }); continue }
    // Already handled via the old Plaid Bilt feed (submitted / skipped)?
    const ti = txns.findIndex((t, i) => !usedTxn.has(i) && t.account_mask === '0540' && !t.txn_id.startsWith('bilt-email:') &&
      ['submitted', 'skipped', 'historical'].includes(t.queue_status) && Math.abs(t.amount_usd - amount) < 0.01 && dayDiff(t.date, a.txn_date) <= 3)
    if (ti >= 0) { usedTxn.add(ti); out.push({ message_id: a.message_id, status: 'already_listed', reason: `plaid ${txns[ti].queue_status}` }); continue }
    toAppend.push({
      txn_id: id, date: a.txn_date, merchant: a.merchant || 'Bilt charge', amount_usd: amount, currency: 'USD',
      account: 'Bilt 0540', account_mask: '0540', category: '', payment_channel: 'email',
      updated_at: now, queue_status: 'pending', submitted_at: '',
    })
    out.push({ message_id: a.message_id, status: 'queued' })
  }
  await appendPlaidTxns(toAppend)
  return out
}
