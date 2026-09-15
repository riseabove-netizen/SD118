// TEMPORARY diagnostic — admin-only. Lists every Plaid account across all items
// with mask, name, official_name, subtype, and (when available) identity owners.
// Delete after use.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, requireAdmin, readPlaidItems, buildAccountLabelMap } from '../_plaid.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  try {
    const items = await readPlaidItems()
    const labels = buildAccountLabelMap(items)
    const plaid = plaidClient()
    const out: any[] = []
    for (const it of items) {
      if (it.status && it.status !== 'active') continue
      try {
        const acc = await plaid.accountsGet({ access_token: it.access_token })
        let identity: any[] = []
        try {
          const id = await plaid.identityGet({ access_token: it.access_token })
          identity = id.data.accounts.map(a => ({
            account_id: a.account_id,
            owners: (a.owners || []).map(o => ({ names: o.names || [] })),
          }))
        } catch (e: any) {
          identity = [{ error: e?.response?.data?.error_code || e?.message || 'identity_unavailable' }]
        }
        out.push({
          item_id: it.item_id,
          institution_name: it.institution_name,
          account_labels: it.account_labels,
          accounts: acc.data.accounts.map(a => ({
            account_id: a.account_id,
            name: a.name,
            official_name: a.official_name,
            mask: a.mask,
            subtype: a.subtype,
            label: labels[a.account_id] || '(unlabeled)',
          })),
          identity,
        })
      } catch (e: any) {
        out.push({ item_id: it.item_id, error: e?.response?.data?.error_message || e?.message })
      }
    }
    return res.status(200).json({ items: out })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
