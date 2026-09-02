// GET /api/plaid/accounts
// Admin-only. Lists linked Plaid items and their accounts.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, requireAdmin, readPlaidItems, buildAccountLabelMap } from '../_plaid.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

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
