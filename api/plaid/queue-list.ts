// GET /api/plaid/queue-list — admin only.
// Returns pending Plaid transactions for the admin queue, newest first.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from '../_plaid.js'
import { readAllPlaidTxns, maskToQueueLabel } from '../_plaid-txns.js'

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  try {
    const all = await readAllPlaidTxns()
    const pending = all
      .filter(r => r.queue_status === 'pending')
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map(r => ({
        row: r.rowIndex,
        txn_id: r.txn_id,
        date: r.date,
        merchant: r.merchant,
        amount_usd: r.amount_usd,
        account: r.account,
        account_mask: r.account_mask,
        account_queue_label: maskToQueueLabel(r.account_mask),
        category: r.category,
        currency: r.currency,
      }))
    return res.status(200).json({ ok: true, pending, count: pending.length })
  } catch (e: any) {
    const msg = e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
