// Shared helpers for the Plaid_Transactions sheet tab.
// Columns: A:txn_id, B:date, C:merchant, D:amount_usd, E:currency, F:account,
//          G:account_mask, H:category, I:payment_channel, J:updated_at,
//          K:queue_status, L:submitted_at
import { google } from 'googleapis'
import { sheetsAuth, SPREADSHEET_ID, readPlaidItems, buildAccountLabelMap, plaidClient, updatePlaidItem, PlaidItemRow } from './_plaid.js'

export const PLAID_TXNS_TAB = 'Plaid_Transactions'

// Masks we care about (Gabriel-only filter).
export const GABRIEL_MASKS = new Set(['3240', '0540'])

// Mask → sheet-account label (matches existing rows).
// Amex writes as "Amex 3240"; Bilt writes as "Bilt" (39 existing Bilt rows do NOT include the mask).
export function maskToSheetAccount(mask: string): string {
  if (mask === '3240') return 'Amex 3240'
  if (mask === '0540') return 'Bilt'
  return ''
}

// Queue-facing label (with mask) — used only in the admin queue UI, never in the Expenses sheet.
export function maskToQueueLabel(mask: string): string {
  if (mask === '3240') return 'Amex 3240'
  if (mask === '0540') return 'Bilt 0540'
  return `?${mask}`
}

export type PlaidTxnRow = {
  rowIndex: number      // 1-based, includes header row
  txn_id: string
  date: string          // YYYY-MM-DD
  merchant: string
  amount_usd: number
  currency: string
  account: string       // free-text account label
  account_mask: string
  category: string
  payment_channel: string
  updated_at: string
  queue_status: string  // 'pending' | 'submitted' | 'skipped' | 'historical'
  submitted_at: string
}

export async function readAllPlaidTxns(): Promise<PlaidTxnRow[]> {
  const auth = sheetsAuth(false)
  const sheets = google.sheets({ version: 'v4', auth })
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PLAID_TXNS_TAB}!A2:L`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  const values = resp.data.values || []
  return values.map((r, i) => ({
    rowIndex: i + 2,
    txn_id: String(r[0] ?? ''),
    date: String(r[1] ?? ''),
    merchant: String(r[2] ?? ''),
    amount_usd: typeof r[3] === 'number' ? r[3] : parseFloat(String(r[3] ?? '0')) || 0,
    currency: String(r[4] ?? ''),
    account: String(r[5] ?? ''),
    account_mask: String(r[6] ?? ''),
    category: String(r[7] ?? ''),
    payment_channel: String(r[8] ?? ''),
    updated_at: String(r[9] ?? ''),
    queue_status: String(r[10] ?? ''),
    submitted_at: String(r[11] ?? ''),
  })).filter(r => r.txn_id)
}

export async function appendPlaidTxns(rows: Array<Omit<PlaidTxnRow, 'rowIndex'>>): Promise<number> {
  if (rows.length === 0) return 0
  const auth = sheetsAuth(true)
  const sheets = google.sheets({ version: 'v4', auth })
  const values = rows.map(r => [
    r.txn_id, r.date, r.merchant, r.amount_usd, r.currency,
    r.account, r.account_mask, r.category, r.payment_channel,
    r.updated_at, r.queue_status, r.submitted_at,
  ])
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PLAID_TXNS_TAB}!A:L`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })
  return rows.length
}

export async function updatePlaidTxnStatus(rowIndex: number, status: string, submittedAt: string = ''): Promise<void> {
  const auth = sheetsAuth(true)
  const sheets = google.sheets({ version: 'v4', auth })
  // Same retry logic as expense-submit: on 429 or 503 back off exponentially.
  let delay = 1000
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PLAID_TXNS_TAB}!K${rowIndex}:L${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[status, submittedAt]] },
      })
      return
    } catch (err: any) {
      const status_code = err?.code || err?.response?.status
      if ((status_code !== 429 && status_code !== 503 && status_code !== 500) || attempt === 6) throw err
      await new Promise(r => setTimeout(r, delay + Math.random() * 500))
      delay = Math.min(delay * 2, 16000)
    }
  }
}

// Look up a row index by txn_id (one round trip; O(n)).
export async function findRowByTxnId(txn_id: string): Promise<number | null> {
  const all = await readAllPlaidTxns()
  const hit = all.find(r => r.txn_id === txn_id)
  return hit ? hit.rowIndex : null
}

// Core sync: pull new txns from Plaid /transactions/sync, filter to Gabriel masks,
// dedupe against existing sheet, append as 'pending'. Updates each item's cursor.
// Returns { pulled, appended }.
export async function syncPlaidTransactions(opts?: { maxDaysBack?: number }): Promise<{ pulled: number; appended: number; per_item: Array<{ item_id: string; pulled: number; appended: number; error?: string }> }> {
  const items = await readPlaidItems()
  const activeItems = items.filter(i => i.status === 'active' && i.access_token)
  const labels = buildAccountLabelMap(activeItems)
  const plaid = plaidClient()

  // Cache existing txn_ids once so per-item filtering is cheap.
  const existing = await readAllPlaidTxns()
  const seenIds = new Set(existing.map(r => r.txn_id))

  const toAppend: Array<Omit<PlaidTxnRow, 'rowIndex'>> = []
  const perItem: Array<{ item_id: string; pulled: number; appended: number; error?: string }> = []
  let totalPulled = 0

  const cutoff = opts?.maxDaysBack
    ? new Date(Date.now() - opts.maxDaysBack * 86400_000).toISOString().slice(0, 10)
    : null

  for (const item of activeItems) {
    let itemPulled = 0
    let itemAppended = 0
    try {
      let cursor: string | undefined = item.cursor || undefined
      let hasMore = true
      let latestCursor = cursor
      // Track per-item account_id -> mask
      const accountMap: Record<string, string> = {}
      while (hasMore) {
        const resp = await plaid.transactionsSync({
          access_token: item.access_token,
          cursor,
          count: 500,
        })
        for (const a of resp.data.accounts) {
          accountMap[a.account_id] = (a.mask || '').toString()
        }
        for (const t of resp.data.added) {
          itemPulled++
          totalPulled++
          if (t.pending) continue
          const mask = accountMap[t.account_id] || ''
          // Gate strictly on account_id being explicitly labeled in Plaid_Items.
          // A shared Bilt item can carry a partner card that reuses the same mask,
          // so mask alone is not a safe filter — only accounts we've explicitly
          // labeled here belong to Gabriel and should sync.
          const label = labels[t.account_id]
          if (!label) continue
          if (!GABRIEL_MASKS.has(mask)) continue
          if (cutoff && t.date < cutoff) continue
          if (seenIds.has(t.transaction_id)) continue
          seenIds.add(t.transaction_id)
          toAppend.push({
            txn_id: t.transaction_id,
            date: t.date,
            merchant: t.merchant_name || t.name || '',
            amount_usd: Math.abs(t.amount),
            currency: t.iso_currency_code || t.unofficial_currency_code || 'USD',
            account: label,
            account_mask: mask,
            category: (t.personal_finance_category?.primary as string) || '',
            payment_channel: (t.payment_channel as string) || '',
            updated_at: new Date().toISOString(),
            queue_status: 'pending',
            submitted_at: '',
          })
          itemAppended++
        }
        // (Ignore modified/removed for now — this is an intake queue, not a mirror.)
        cursor = resp.data.next_cursor
        latestCursor = cursor
        hasMore = resp.data.has_more
      }
      // Persist cursor + last_synced_at.
      await updatePlaidItem(item.rowIndex, {
        cursor: latestCursor || '',
        last_synced_at: new Date().toISOString(),
      })
      perItem.push({ item_id: item.item_id, pulled: itemPulled, appended: itemAppended })
    } catch (err: any) {
      const msg = err?.response?.data?.error_message || err?.message || String(err)
      perItem.push({ item_id: item.item_id, pulled: itemPulled, appended: itemAppended, error: msg })
    }
  }

  const appended = await appendPlaidTxns(toAppend)
  return { pulled: totalPulled, appended, per_item: perItem }
}
