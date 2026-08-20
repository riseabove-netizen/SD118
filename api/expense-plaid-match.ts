// Match one or more receipts against the Plaid_Transactions cache in the
// SD118 Expenses spreadsheet.
//
// Input: [{account, date (YYYY-MM-DD), eur?, usd?, merchant?}]
// Output per input:
//   best match { txn_id, date, merchant, amount_usd, currency, category,
//                account_label ('Amex 3240' | 'Bilt' | 'Unknown'),
//                account_matches_selection: boolean }
//   or null.
//
// Matching rules:
//   1. Search ALL linked cards (Amex 3240 + Bilt) — not filtered to the
//      crew's selected account. Reason: crews sometimes swipe the wrong
//      card and we still want to catch the charge.
//   2. Restrict to a ±3-day window around the receipt date.
//   3. Score each candidate:
//        - amount score: if usd is known, |txn - usd|; else if eur is known,
//          rough estimate txn ≈ eur * 1.05..1.20, so distance = min(|txn - eur*1.05|, |txn - eur*1.20|) / (eur*0.15)
//        - merchant score: substring match bonus
//        - date score: |days diff|
//   4. Return the candidate with the best score if amount is within a
//      reasonable tolerance (10% of amount + $2), else null.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = { maxDuration: 30 }

const SPREADSHEET_ID = '1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk'

const ACCOUNT_TO_MASK: Record<string, string> = {
  'Amex 3240': '3240',
  'Bilt': '0540',
}

const MASK_TO_LABEL: Record<string, string> = {
  '3240': 'Amex 3240',
  '0540': 'Bilt',
}

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

type PlaidRow = {
  txn_id: string
  date: string
  merchant: string
  amount_usd: number
  currency: string
  account: string
  account_mask: string
  category: string
}

type MatchQuery = {
  account: string
  date: string        // YYYY-MM-DD
  eur?: number | null
  usd?: number | null
  merchant?: string | null
}

type MatchResult = {
  txn_id: string
  date: string
  merchant: string
  amount_usd: number
  currency: string
  category: string
  account_mask: string
  account_label: string
  account_matches_selection: boolean
} | null

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.abs((da - db) / 86400000)
}

function matchOne(cache: PlaidRow[], q: MatchQuery): MatchResult {
  const selectedMask = ACCOUNT_TO_MASK[q.account] || q.account
  const receiptMerchant = (q.merchant || '').toLowerCase().trim()

  // Window: ±3 days across ALL known cards
  const inWindow = cache.filter(r => daysBetween(r.date, q.date) <= 3)
  if (inWindow.length === 0) return null

  const usd = q.usd ?? null
  const eur = q.eur ?? null

  const candidates = inWindow.map(r => {
    let amountPenalty: number
    if (usd != null) {
      amountPenalty = Math.abs(r.amount_usd - usd)
    } else if (eur != null && eur > 0) {
      // Try a range of EUR→USD rates (1.00 to 1.25 is roughly the ECB envelope)
      const lo = eur * 1.00
      const hi = eur * 1.25
      if (r.amount_usd >= lo && r.amount_usd <= hi) amountPenalty = 0
      else amountPenalty = Math.min(Math.abs(r.amount_usd - lo), Math.abs(r.amount_usd - hi))
    } else {
      amountPenalty = Infinity
    }
    const datePenalty = daysBetween(r.date, q.date)
    // Merchant bonus: negative penalty
    let merchantBonus = 0
    if (receiptMerchant && r.merchant) {
      const rm = r.merchant.toLowerCase()
      if (rm.includes(receiptMerchant) || receiptMerchant.includes(rm)) merchantBonus = -5
      else {
        // token overlap
        const rtokens = new Set(receiptMerchant.split(/\W+/).filter(t => t.length >= 3))
        const ptokens = new Set(rm.split(/\W+/).filter(t => t.length >= 3))
        let overlap = 0
        for (const t of rtokens) if (ptokens.has(t)) overlap++
        if (overlap > 0) merchantBonus = -2
      }
    }
    const score = amountPenalty + datePenalty * 0.5 + merchantBonus
    return { row: r, score, amountPenalty }
  })

  candidates.sort((a, b) => a.score - b.score)
  const best = candidates[0]
  if (!best || !Number.isFinite(best.score)) return null

  // Tolerance gate: if we have USD or EUR to compare against, the amountPenalty
  // must be within 10% of the receipt amount + $2 slack.
  const reference = usd ?? (eur != null ? eur * 1.15 : null)
  if (reference == null) return null
  const tolerance = Math.max(reference * 0.10, 2)
  if (best.amountPenalty > tolerance) return null

  return {
    txn_id: best.row.txn_id,
    date: best.row.date,
    merchant: best.row.merchant,
    amount_usd: best.row.amount_usd,
    currency: best.row.currency,
    category: best.row.category,
    account_mask: best.row.account_mask,
    account_label: MASK_TO_LABEL[best.row.account_mask] || 'Unknown',
    account_matches_selection: best.row.account_mask === selectedMask,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const body = req.body as { queries: MatchQuery[] }
  const queries = body?.queries
  if (!Array.isArray(queries) || queries.length === 0) {
    return res.status(400).json({ error: 'queries[] required' })
  }

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Plaid_Transactions!A2:J',
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const rows = resp.data.values || []
    const cache: PlaidRow[] = rows.map(r => ({
      txn_id: String(r[0] ?? ''),
      date: String(r[1] ?? ''),
      merchant: String(r[2] ?? ''),
      amount_usd: Number(r[3]) || 0,
      currency: String(r[4] ?? 'USD'),
      account: String(r[5] ?? ''),
      account_mask: String(r[6] ?? ''),
      category: String(r[7] ?? ''),
    })).filter(r => r.txn_id && r.date)

    const results: MatchResult[] = queries.map(q => matchOne(cache, q))
    // Also return cache freshness (max updated_at)
    let latestUpdated = ''
    for (const r of rows) {
      const u = String(r[9] ?? '')
      if (u > latestUpdated) latestUpdated = u
    }
    return res.status(200).json({ ok: true, matches: results, cacheSize: cache.length, cacheUpdated: latestUpdated })
  } catch (err: any) {
    console.error('expense-plaid-match error:', err)
    return res.status(500).json({ error: 'Failed to match', detail: err?.message || String(err) })
  }
}
