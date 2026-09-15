// POST /api/plaid/match
// Called from the expense intake form on submit.
//
// Strategy:
//   1. Look up each query against the Plaid_Transactions sheet backlog first
//      (queue_status ∈ {pending, historical}). This is much faster than a
//      live Plaid /transactions/get round-trip.
//   2. If nothing hits in the backlog, fall back to a live Plaid API pull
//      across all active items in the ±3-day window.
//
// Tolerance (both cache + live):
//   - Date: within DATE_WINDOW_DAYS of receipt date.
//   - Amount: |plaid_usd − receipt_amount| ≤ AMOUNT_TOLERANCE (fixed 0.50).
//     Applied to USD-to-USD and EUR-to-EUR comparisons alike; no FX rate,
//     no percentage tolerance.
//
// Body: { queries: [{ account: string, date: string (YYYY-MM-DD), eur?: number, usd?: number, merchant?: string }] }
// Response: { ok: true, matches: [ {plaid_txn_id, ...} | null ] }
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, readPlaidItems, buildAccountLabelMap } from '../_plaid.js'
import { readAllPlaidTxns } from '../_plaid-txns.js'

// account is optional: when omitted, the match runs across ALL cards (used by
// the crew scan flow, which doesn't ask the user which card was used).
type MatchQuery = { account?: string; date: string; eur?: number; usd?: number; merchant?: string }
type MatchResult = {
  plaid_txn_id: string
  txn_id: string
  amount_usd: number
  usd: number
  amount_account: number
  currency: string
  merchant: string
  date: string
  category: string
  account_label: string
  account_mask: string
  account_matches_selection: boolean
  source: 'cache' | 'live'
  cache_row?: number
  // Set when the matched Plaid row has already been categorized by the admin
  // (queue_status='submitted'). Crew UI uses this to skip duplicate submits.
  already_submitted?: boolean
  submitted_at?: string
} | null

const DATE_WINDOW_DAYS = 3
// Fixed tolerance in the receipt's own currency (Plaid USD amounts and EUR
// receipts both compared against 0.50). No FX conversion, no % window.
const AMOUNT_TOLERANCE = 0.50

function parseAmount(v: number | string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isFinite(n) ? Math.abs(n) : null
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.abs(Math.round((da - db) / 86400000))
}

function shift(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = req.body as { queries?: MatchQuery[] } | undefined
    const queries = Array.isArray(body?.queries) ? body!.queries! : []
    if (queries.length === 0) return res.status(200).json({ ok: true, matches: [] })
    if (queries.length > 25) return res.status(400).json({ error: 'max 25 queries per request' })

    // ── Pass 1: check the Plaid_Transactions backlog ────────────────────
    // Include SUBMITTED rows too so crew scans can detect a receipt the admin
    // already categorized and short-circuit (no duplicate expense row).
    const backlog = (await readAllPlaidTxns()).filter(r =>
      r.queue_status === 'pending' || r.queue_status === 'historical' || r.queue_status === 'submitted'
    )

    const matches: MatchResult[] = queries.map((q) => {
      const targetLabel = q.account || ''  // '' → any card (crew scan flow)
      const targetDate = q.date
      const receiptUsd = parseAmount(q.usd)
      const receiptEur = parseAmount(q.eur)
      // If receipt is EUR-only, compare against the raw EUR value; Plaid stores
      // Amex/Bilt txns in USD so we compare EUR ↔ USD numerically with the
      // fixed 0.50 tolerance (the user asked for a strict fixed tolerance in
      // either currency — no FX conversion).
      const receiptAmount = receiptUsd ?? receiptEur
      if (receiptAmount == null) return null

      const cands = backlog.filter(r =>
        (!targetLabel || r.account === targetLabel) &&
        daysBetween(r.date, targetDate) <= DATE_WINDOW_DAYS
      )
      let best: (typeof cands[number] & { _score: number }) | null = null
      for (const c of cands) {
        const diff = Math.abs(c.amount_usd - receiptAmount)
        if (diff <= AMOUNT_TOLERANCE) {
          const score = diff + daysBetween(c.date, targetDate) * 0.001
          if (!best || score < best._score) best = { ...c, _score: score }
        }
      }
      if (!best) return null
      const isSubmitted = best.queue_status === 'submitted'
      return {
        plaid_txn_id: best.txn_id,
        txn_id: best.txn_id,
        amount_usd: best.amount_usd,
        usd: best.amount_usd,
        amount_account: best.amount_usd,
        currency: best.currency || 'USD',
        already_submitted: isSubmitted,
        submitted_at: best.submitted_at || '',
        merchant: best.merchant,
        date: best.date,
        category: best.category || '',
        account_label: best.account,
        account_mask: best.account_mask,
        account_matches_selection: best.account === targetLabel,
        source: 'cache',
        cache_row: best.rowIndex,
      }
    })

    // ── Pass 2: for queries that missed the cache, hit live Plaid ───────
    const missing = queries
      .map((q, i) => ({ q, i }))
      .filter(x => matches[x.i] === null)

    let liveScanned = 0
    let liveWindow: { start: string; end: string } | null = null
    if (missing.length > 0) {
      const items = await readPlaidItems()
      const activeItems = items.filter(i => i.status === 'active' && i.access_token)
      if (activeItems.length > 0) {
        const labels = buildAccountLabelMap(activeItems)
        const plaid = plaidClient()

        let minDate = missing[0].q.date, maxDate = missing[0].q.date
        for (const { q } of missing) {
          if (q.date < minDate) minDate = q.date
          if (q.date > maxDate) maxDate = q.date
        }
        const fetchStart = shift(minDate, -DATE_WINDOW_DAYS)
        const fetchEnd = shift(maxDate, DATE_WINDOW_DAYS)
        liveWindow = { start: fetchStart, end: fetchEnd }

        type PlaidTxn = {
          transaction_id: string
          account_id: string
          amount: number
          iso_currency_code: string | null
          unofficial_currency_code: string | null
          date: string
          merchant_name: string | null
          name: string
          pending: boolean
        }
        const allTxns: Array<PlaidTxn & { account_label: string; account_mask: string }> = []

        for (const item of activeItems) {
          let offset = 0
          const pageSize = 500
          while (true) {
            const resp = await plaid.transactionsGet({
              access_token: item.access_token,
              start_date: fetchStart,
              end_date: fetchEnd,
              options: { count: pageSize, offset, include_personal_finance_category: false },
            })
            const accountMap: Record<string, { mask: string }> = {}
            for (const a of resp.data.accounts) {
              accountMap[a.account_id] = { mask: (a.mask || '').toString() }
            }
            for (const t of resp.data.transactions) {
              if (t.pending) continue
              const label = labels[t.account_id] || ''
              allTxns.push({
                transaction_id: t.transaction_id,
                account_id: t.account_id,
                amount: t.amount,
                iso_currency_code: t.iso_currency_code || null,
                unofficial_currency_code: t.unofficial_currency_code || null,
                date: t.date,
                merchant_name: t.merchant_name || null,
                name: t.name || '',
                pending: t.pending || false,
                account_label: label,
                account_mask: accountMap[t.account_id]?.mask || '',
              })
            }
            offset += resp.data.transactions.length
            if (offset >= resp.data.total_transactions || resp.data.transactions.length === 0) break
          }
        }
        liveScanned = allTxns.length

        for (const { q, i } of missing) {
          const targetLabel = q.account || ''  // '' → any card
          const targetDate = q.date
          const receiptAmount = parseAmount(q.usd) ?? parseAmount(q.eur)
          if (receiptAmount == null) continue

          const cands = allTxns.filter(t =>
            (!targetLabel || t.account_label === targetLabel) &&
            daysBetween(t.date, targetDate) <= DATE_WINDOW_DAYS
          )
          let best: (typeof cands[number] & { _score: number }) | null = null
          for (const c of cands) {
            const plaidUsd = Math.abs(c.amount)
            const diff = Math.abs(plaidUsd - receiptAmount)
            if (diff <= AMOUNT_TOLERANCE) {
              const score = diff + daysBetween(c.date, targetDate) * 0.001
              if (!best || score < best._score) best = { ...c, _score: score }
            }
          }
          if (!best) continue
          const merchant = best.merchant_name || best.name || ''
          matches[i] = {
            plaid_txn_id: best.transaction_id,
            txn_id: best.transaction_id,
            amount_usd: Math.abs(best.amount),
            usd: Math.abs(best.amount),
            amount_account: best.amount,
            currency: best.iso_currency_code || best.unofficial_currency_code || 'USD',
            merchant,
            date: best.date,
            category: '',
            account_label: best.account_label,
            account_mask: best.account_mask,
            account_matches_selection: best.account_label === targetLabel,
            source: 'live',
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      matches,
      cache_size: backlog.length,
      live_scanned: liveScanned,
      live_window: liveWindow,
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
