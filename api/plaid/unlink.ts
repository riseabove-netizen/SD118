// POST /api/plaid/unlink   { item_id: string }
// Admin-only. Removes the item from Plaid and marks the Plaid_Items row unlinked.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { plaidClient, requireAdmin, readPlaidItems, updatePlaidItem } from '../_plaid'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return

  try {
    const body = req.body as { item_id?: string } | undefined
    const item_id = body?.item_id
    if (!item_id) return res.status(400).json({ error: 'item_id required' })

    const items = await readPlaidItems()
    const row = items.find(r => r.item_id === item_id)
    if (!row) return res.status(404).json({ error: 'item not found' })

    const plaid = plaidClient()
    try {
      await plaid.itemRemove({ access_token: row.access_token })
    } catch (e: any) {
      // continue even if Plaid rejects — mark local status
    }
    await updatePlaidItem(row.rowIndex, { status: 'unlinked', access_token: '' })

    return res.status(200).json({ ok: true, item_id })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
