// POST /api/plaid/link-token
// Admin-only. Creates a Plaid Link token so the frontend can launch Plaid Link.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, plaidEnvName, requireAdmin, readPlaidItems, PLAID_PRODUCTS, PLAID_COUNTRIES } from '../_plaid.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  try {
    const plaid = plaidClient()
    // Update mode: pass { item_id } to re-authenticate an existing item
    // (ITEM_LOGIN_REQUIRED) without creating a new item or changing its
    // access_token / cursor.
    const itemId = (req.body as { item_id?: string } | undefined)?.item_id
    let accessToken: string | undefined
    if (itemId) {
      const items = await readPlaidItems()
      const it = items.find(i => i.item_id === itemId)
      if (!it?.access_token) return res.status(404).json({ error: 'Item not found' })
      accessToken = it.access_token
    }
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: 'rise-above-admin' },
      client_name: 'Rise Above Operations',
      ...(accessToken ? { access_token: accessToken } : { products: PLAID_PRODUCTS }),
      country_codes: PLAID_COUNTRIES,
      language: 'en',
    })
    return res.status(200).json({
      update_mode: !!accessToken,
      link_token: resp.data.link_token,
      expiration: resp.data.expiration,
      env: plaidEnvName(),
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
