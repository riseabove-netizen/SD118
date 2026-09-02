// POST /api/plaid/exchange
// Admin-only. Exchanges a public_token from Plaid Link for an access_token,
// fetches accounts + institution, and stores the item in the Plaid_Items sheet.
//
// Body: { public_token: string, account_labels?: {[account_id]: string} }
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, requireAdmin, appendPlaidItem } from '../_plaid'

const KNOWN_MASKS: Record<string, string> = {
  '3240': 'Amex 3240',
  '0540': 'Bilt 0540',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  try {
    const body = req.body as { public_token?: string; account_labels?: Record<string, string> } | undefined
    const public_token = body?.public_token
    if (!public_token) return res.status(400).json({ error: 'public_token required' })

    const plaid = plaidClient()
    const exch = await plaid.itemPublicTokenExchange({ public_token })
    const access_token = exch.data.access_token
    const item_id = exch.data.item_id

    const [accountsResp, itemResp] = await Promise.all([
      plaid.accountsGet({ access_token }),
      plaid.itemGet({ access_token }),
    ])
    const inst_id = itemResp.data.item.institution_id || ''
    let institution_name = ''
    if (inst_id) {
      try {
        const inst = await plaid.institutionsGetById({ institution_id: inst_id, country_codes: [ 'US' as any ] })
        institution_name = inst.data.institution.name
      } catch { institution_name = inst_id }
    }

    // Auto-label accounts using known masks; caller can override via account_labels.
    const overrides = body?.account_labels || {}
    const labels: Record<string, string> = {}
    const accountsOut: Array<{ account_id: string, name: string, mask: string, label: string, subtype: string }> = []
    for (const a of accountsResp.data.accounts) {
      const mask = (a.mask || '').toString()
      const auto = KNOWN_MASKS[mask] || `${institution_name} ${mask || a.name}`.trim()
      const label = overrides[a.account_id] || auto
      labels[a.account_id] = label
      accountsOut.push({
        account_id: a.account_id,
        name: a.name || '',
        mask,
        label,
        subtype: (a.subtype || '') as string,
      })
    }

    const now = new Date().toISOString()
    await appendPlaidItem({
      item_id,
      access_token,
      institution_name,
      account_labels: JSON.stringify(labels),
      cursor: '',
      added_at: now,
      last_synced_at: '',
      status: 'active',
    })

    return res.status(200).json({
      ok: true,
      item_id,
      institution_name,
      accounts: accountsOut,
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
