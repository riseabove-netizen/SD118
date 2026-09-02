// GET /api/plaid/unloaded?days=45
// Admin-only. Lists Plaid transactions (last N days) that do NOT appear in the
// Expenses sheet, by comparing (account_label + amount rounded to 0.01 + date).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import {
  plaidClient, requireAdmin, readPlaidItems, buildAccountLabelMap,
  sheetsAuth, SPREADSHEET_ID, EXPENSES_TAB,
} from '../_plaid.js'

function parseUsd(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isFinite(n) ? Math.abs(n) : null
}

function keyFor(account_label: string, amount: number, date: string): string {
  return `${account_label}|${amount.toFixed(2)}|${date}`
}

function shift(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  try {
    const days = Math.max(1, Math.min(180, parseInt(String(req.query.days || '45'), 10)))
    const today = new Date().toISOString().slice(0, 10)
    const start = shift(today, -days)

    const items = await readPlaidItems()
    const active = items.filter(i => i.status === 'active' && i.access_token)
    const labels = buildAccountLabelMap(active)
    const plaid = plaidClient()

    // Fetch Plaid txns
    type Out = {
      plaid_txn_id: string
      account_label: string
      account_mask: string
      date: string
      amount_usd: number
      currency: string
      merchant: string
      name: string
    }
    const plaidTxns: Out[] = []
    for (const it of active) {
      let offset = 0
      const pageSize = 500
      while (true) {
        const resp = await plaid.transactionsGet({
          access_token: it.access_token,
          start_date: start,
          end_date: today,
          options: { count: pageSize, offset, include_personal_finance_category: false },
        })
        const accMap: Record<string, string> = {}
        for (const a of resp.data.accounts) accMap[a.account_id] = (a.mask || '').toString()
        for (const t of resp.data.transactions) {
          if (t.pending) continue
          plaidTxns.push({
            plaid_txn_id: t.transaction_id,
            account_label: labels[t.account_id] || '',
            account_mask: accMap[t.account_id] || '',
            date: t.date,
            amount_usd: Math.abs(t.amount),
            currency: t.iso_currency_code || t.unofficial_currency_code || 'USD',
            merchant: t.merchant_name || '',
            name: t.name || '',
          })
        }
        offset += resp.data.transactions.length
        if (offset >= resp.data.total_transactions || resp.data.transactions.length === 0) break
      }
    }

    // Read Expenses sheet: Date (A), Account (B), USD (H)
    const auth = sheetsAuth(false)
    const sheets = google.sheets({ version: 'v4', auth })
    const readResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${EXPENSES_TAB}!A2:H`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const rows = readResp.data.values || []
    const existing = new Set<string>()
    for (const r of rows) {
      let d = String(r[0] ?? '').trim()
      // Normalize date -> YYYY-MM-DD
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(d)) d = d.replace(/\//g, '-')
      const acc = String(r[1] ?? '').trim()
      const usd = parseUsd(r[7])
      if (!d || !acc || usd === null) continue
      // Register both same-day and ±1 day for tolerance
      existing.add(keyFor(acc, usd, d))
      const d0 = new Date(d + 'T00:00:00Z')
      for (const off of [-1, 1]) {
        const d2 = new Date(d0.getTime() + off * 86400000).toISOString().slice(0, 10)
        existing.add(keyFor(acc, usd, d2))
      }
    }

    const unloaded = plaidTxns.filter(t => !existing.has(keyFor(t.account_label, t.amount_usd, t.date)))
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    return res.status(200).json({
      ok: true,
      unloaded,
      total_plaid: plaidTxns.length,
      total_existing_keys: existing.size,
      window: { start, end: today },
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
