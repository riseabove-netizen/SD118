// GET /api/plaid/accounts
// Admin-only. Lists linked Plaid items and their accounts.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, requireAdmin, readPlaidItems, buildAccountLabelMap } from '../_plaid.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  // Diagnostic: raw Plaid transactions (all fields) for a date range,
  // used to find which fields separate cardholders on a shared account.
  if (req.query.op === 'raw') {
    try {
      const start = String(req.query.start || '')
      const end = String(req.query.end || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return res.status(400).json({ error: 'start and end (YYYY-MM-DD) required' })
      }
      const items = await readPlaidItems()
      const plaid = plaidClient()
      const out: any[] = []
      for (const it of items) {
        if ((it.status && it.status !== 'active') || !it.access_token) continue
        try {
          const r = await plaid.transactionsGet({
            access_token: it.access_token,
            start_date: start,
            end_date: end,
            options: { count: 500, include_original_description: true } as any,
          })
          out.push({ item_id: it.item_id, institution_name: it.institution_name, accounts: r.data.accounts, transactions: r.data.transactions })
        } catch (e: any) {
          out.push({ item_id: it.item_id, error: e?.response?.data?.error_message || e?.message || String(e) })
        }
      }
      return res.status(200).json({ items: out })
    } catch (e: any) {
      return res.status(500).json({ error: e?.response?.data?.error_message || e?.message || String(e) })
    }
  }

  try {
    const items = await readPlaidItems()
    const labels = buildAccountLabelMap(items)
    const plaid = plaidClient()

    const out = []
    for (const it of items) {
      if (it.status && it.status !== 'active') {
        out.push({
          item_id: it.item_id,
          institution_name: it.institution_name,
          status: it.status,
          accounts: [],
        })
        continue
      }
      try {
        const acc = await plaid.accountsGet({ access_token: it.access_token })
        out.push({
          item_id: it.item_id,
          institution_name: it.institution_name,
          status: 'active',
          added_at: it.added_at,
          last_synced_at: it.last_synced_at,
          accounts: acc.data.accounts.map(a => ({
            account_id: a.account_id,
            name: a.name || '',
            mask: (a.mask || '').toString(),
            label: labels[a.account_id] || '',
            subtype: (a.subtype || '') as string,
            balance_usd: a.balances?.current ?? null,
          })),
        })
      } catch (e: any) {
        out.push({
          item_id: it.item_id,
          institution_name: it.institution_name,
          status: 'error',
          error: e?.response?.data?.error_message || e?.message || String(e),
          accounts: [],
        })
      }
    }

    return res.status(200).json({ items: out })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
