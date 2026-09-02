// POST /api/plaid/link-token
// Admin-only. Creates a Plaid Link token so the frontend can launch Plaid Link.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, plaidEnvName, requireAdmin, PLAID_PRODUCTS, PLAID_COUNTRIES } from '../_plaid'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  try {
    const plaid = plaidClient()
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: 'rise-above-admin' },
      client_name: 'Rise Above Operations',
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRIES,
      language: 'en',
    })
    return res.status(200).json({
      link_token: resp.data.link_token,
      expiration: resp.data.expiration,
      env: plaidEnvName(),
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
