// POST /api/plaid/match
// Called from the expense intake form on submit.
//
// For each query, calls Plaid /transactions/get across all active items for the
// selected card only, in a ±3 day window around the receipt date. Returns the
// best strict match: same mask, amount ± $0.05 (USD-to-USD), date ± 3 days.
// If receipt is EUR, uses live FX (open.er-api.com) ± 3%. If none match, null.
//
// Body: { queries: [{ account: string, date: string (YYYY-MM-DD), eur?: number, usd?: number, merchant?: string }] }
// Response: { ok: true, matches: [ {plaid_txn_id, usd, currency, merchant, date, account_label} | null ] }
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, readPlaidItems, buildAccountLabelMap, PlaidItemRow } from '../_plaid.js'

type MatchQuery = { account: string; date: string; eur?: number; usd?: number; merchant?: string }
type MatchResult = {
  plaid_txn_id: string
  usd: number
  amount_account: number
  currency: string
  merchant: string
  date: string
  account_label: string
  account_mask: string
} | null

const DATE_WINDOW_DAYS = 3
const USD_TOLERANCE = 0.05   // strict
const FX_TOLERANCE_PCT = 0.03 // ±3%

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

async function eurToUsd(): Promise<number | null> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/EUR')
    if (!r.ok) return null
    const j = await r.json()
    const usd = j?.rates?.USD
    return typeof usd === 'number' ? usd : null
  } catch { return null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = req.body as { queries?: MatchQuery[] } | undefined
    const queries = Array.isArray(body?.queries) ? body!.queries! : []
    if (queries.length === 0) return res.status(200).json({ ok: true, matches: [] })
    if (queries.length > 25) return res.status(400).json({ error: 'max 25 queries per request' })

    const items = await readPlaidItems()
    const activeItems = items.filter(i => i.status === 'active' && i.access_token)
    if (activeItems.length === 0) {
      return res.status(200).json({ ok: true, matches: queries.map(() => null), warning: 'no active Plaid items' })
    }
    const labels = buildAccountLabelMap(activeItems)
    const plaid = plaidClient()

    // Determine widest window we need across queries
    let minDate = queries[0].date, maxDate = queries[0].date
    for (const q of queries) {
      if (q.date < minDate) minDate = q.date
      if (q.date > maxDate) maxDate = q.date
    }
    const fetchStart = shift(minDate, -DATE_WINDOW_DAYS)
    const fetchEnd = shift(maxDate, DATE_WINDOW_DAYS)

    // Fetch all txns in [fetchStart, fetchEnd] across all active items (paginated).
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
    const allTxns: Array<PlaidTxn & { account_label: string, account_mask: string }> = []

    for (const item of activeItems) {
      // First page to get accounts + count
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

    // Do we need FX?
    const needsFx = queries.some(q => q.eur && !q.usd)
    const fx = needsFx ? await eurToUsd() : null

    const matches: MatchResult[] = queries.map((q) => {
      const targetLabel = q.account
      const targetDate = q.date
      const receiptUsd = parseAmount(q.usd)
      const receiptEur = parseAmount(q.eur)

      // Filter to same account (label match)
      const candidates = allTxns.filter(t => t.account_label === targetLabel && daysBetween(t.date, targetDate) <= DATE_WINDOW_DAYS)

      // Score each candidate; best (lowest score) wins if under threshold.
      let best: (PlaidTxn & { account_label: string, account_mask: string, _score: number, _via: string }) | null = null

      for (const c of candidates) {
        // Plaid amount is in account's currency (USD here).
        const plaidUsd = Math.abs(c.amount)

        if (receiptUsd) {
          const diff = Math.abs(plaidUsd - receiptUsd)
          if (diff <= USD_TOLERANCE) {
            const score = diff + daysBetween(c.date, targetDate) * 0.001
            if (!best || score < best._score) best = { ...c, _score: score, _via: 'usd' }
          }
        } else if (receiptEur && fx) {
          // Receipt is EUR; convert to USD, allow 3% tolerance.
          const receiptAsUsd = receiptEur * fx
          const pct = Math.abs(plaidUsd - receiptAsUsd) / receiptAsUsd
          if (pct <= FX_TOLERANCE_PCT) {
            const score = pct + daysBetween(c.date, targetDate) * 0.001
            if (!best || score < best._score) best = { ...c, _score: score, _via: 'fx' }
          }
        }
      }

      if (!best) return null
      const merchant = best.merchant_name || best.name || ''
      return {
        // New canonical fields:
        plaid_txn_id: best.transaction_id,
        // Legacy fields kept for existing Intake.tsx UI:
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
      }
    })

    return res.status(200).json({
      ok: true,
      matches,
      scanned: allTxns.length,
      window: { start: fetchStart, end: fetchEnd },
      fx_eur_usd: fx,
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
