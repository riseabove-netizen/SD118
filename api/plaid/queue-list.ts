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
    // Plaid's Bilt feed merges every cardholder (Gabriel + Enrico's
    // authorized-user cards) into ONE account (mask 0540) and returns no
    // account_owner, so there is no Plaid field that separates them.
    // Instead we learn from the admin: any merchant the admin has marked
    // as Enrico's ('enrico' status) flags future Bilt charges from the
    // same merchant as "Likely Enrico" so they are held back from
    // auto-submit until the admin decides.
    const norm = (m: string) => (m || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const enricoMerchants = new Set(
      all.filter(r => r.queue_status === 'enrico' && r.account_mask === '0540').map(r => norm(r.merchant)).filter(Boolean),
    )
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
        likely_enrico: r.account_mask === '0540' && enricoMerchants.has(norm(r.merchant)),
      }))
    return res.status(200).json({ ok: true, pending, count: pending.length })
  } catch (e: any) {
    const msg = e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
