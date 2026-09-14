// POST /api/plaid/queue-skip — admin only.
// Marks the listed txn_ids as 'skipped' so they drop out of the queue.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from '../_plaid.js'
import { readAllPlaidTxns, updatePlaidTxnStatus } from '../_plaid-txns.js'

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  const body = req.body as { txn_ids?: string[] }
  const ids = Array.isArray(body?.txn_ids) ? body!.txn_ids! : []
  if (ids.length === 0) return res.status(400).json({ error: 'txn_ids[] required' })
  try {
    const all = await readAllPlaidTxns()
    const byId = new Map(all.map(r => [r.txn_id, r]))
    const results: Array<{ txn_id: string; ok: boolean; error?: string }> = []
    for (const id of ids) {
      const row = byId.get(id)
      if (!row) { results.push({ txn_id: id, ok: false, error: 'not found' }); continue }
      try {
        await updatePlaidTxnStatus(row.rowIndex, 'skipped', '')
        results.push({ txn_id: id, ok: true })
      } catch (e: any) {
        results.push({ txn_id: id, ok: false, error: e?.message || String(e) })
      }
    }
    return res.status(200).json({ ok: results.every(r => r.ok), results })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
