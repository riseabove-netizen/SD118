// Check whether one or more candidate expense entries duplicate a row that
// already exists in the Expenses tab.
//
// Input:
//   { queries: [{ date: 'YYYY/MM/DD' | 'YYYY-MM-DD',
//                 store?: string,
//                 usd?: number|string,
//                 eur?: number|string }] }
//
// Output:
//   { ok, results: [{ isDuplicate, matchedRow?, matchedStore?, matchedDate?,
//                     matchedUsd?, matchedEur? } | null] }
//
// A row is considered a duplicate when it matches on:
//   - same date (\u00b11 day tolerance for late-posted receipts)
//   - normalised merchant name equal (case + punctuation stripped, first 3+
//     tokens overlap)
//   - amount within \u00b1 $0.50 or \u20ac0.50 of the candidate
//
// Only the most recent ~200 Expense rows are scanned to keep this fast.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s
}

const SPREADSHEET_ID = cleanEnv(process.env.EXPENSES_SPREADSHEET_ID) || cleanEnv(process.env.SPREADSHEET_ID) || ''
const SHEET_TITLE = 'Expenses'
const SCAN_ROWS = 200

function getAuth() {
  const raw = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) || cleanEnv(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) || ''
  if (!raw) throw new Error('Missing service account credentials')
  const creds = JSON.parse(raw)
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function normDate(s: string): string {
  return (s || '').replace(/\//g, '-').slice(0, 10)
}

function normMerchant(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string): string[] {
  return normMerchant(s).split(' ').filter(t => t.length >= 3)
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 999
  return Math.abs((da - db) / 86400000)
}

function parseNumber(v: any): number | null {
  if (v == null) return null
  const s = String(v).replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

type Query = { date: string; store?: string; usd?: number|string|null; eur?: number|string|null }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const queries: Query[] = Array.isArray(body?.queries) ? body.queries : []
    if (!queries.length) return res.status(200).json({ ok: true, results: [] })

    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Grab last SCAN_ROWS rows. Use spreadsheets.values.get with a wide range.
    // Column layout: A date, B account, G store, H USD, I EUR
    const range = `${SHEET_TITLE}!A2:O`
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const allRows = resp.data.values || []
    const startIdx = Math.max(0, allRows.length - SCAN_ROWS)
    const recent = allRows.slice(startIdx).map((r, i) => ({
      rowNum: 2 + startIdx + i,
      date: normDate(String(r[0] ?? '')),
      account: String(r[1] ?? ''),
      store: String(r[6] ?? ''),
      usd: parseNumber(r[7]),
      eur: parseNumber(r[8]),
    })).filter(r => r.date)

    const results = queries.map(q => {
      const qDate = normDate(q.date)
      const qStore = normMerchant(q.store || '')
      const qToks = tokens(q.store || '')
      const qUsd = parseNumber(q.usd)
      const qEur = parseNumber(q.eur)

      for (const r of recent) {
        if (daysBetween(qDate, r.date) > 1) continue

        // Merchant match: exact normalised OR \u22652 shared tokens \u22653 chars
        const rToks = tokens(r.store)
        const shared = qToks.filter(t => rToks.includes(t))
        const merchantMatch = (qStore && normMerchant(r.store) === qStore) || shared.length >= 2
        if (!merchantMatch) continue

        // Amount match: within $0.50 or \u20ac0.50 on whichever field is available
        let amountMatch = false
        if (qUsd != null && r.usd != null && Math.abs(qUsd - r.usd) <= 0.5) amountMatch = true
        if (qEur != null && r.eur != null && Math.abs(qEur - r.eur) <= 0.5) amountMatch = true
        // If we have neither USD nor EUR comparison, fall back to merchant+date only
        if (qUsd == null && qEur == null) amountMatch = true
        if (!amountMatch) continue

        return {
          isDuplicate: true,
          matchedRow: r.rowNum,
          matchedStore: r.store,
          matchedDate: r.date,
          matchedAccount: r.account,
          matchedUsd: r.usd,
          matchedEur: r.eur,
        }
      }
      return { isDuplicate: false }
    })

    return res.status(200).json({ ok: true, results, scanned: recent.length })
  } catch (err: any) {
    console.error('expense-duplicate-check error:', err)
    return res.status(500).json({ ok: false, error: err?.message || String(err) })
  }
}
