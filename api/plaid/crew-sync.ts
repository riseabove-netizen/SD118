// POST /api/plaid/crew-sync — crew or admin.
// Same sync logic as the daily cron, but limited to the last 14 days so the
// crew scan flow can trigger a fresh pull without waiting on a full history.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCrew } from '../_plaid.js'
import { syncPlaidTransactions } from '../_plaid-txns.js'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireCrew(req, res)) return
  try {
    const result = await syncPlaidTransactions({ maxDaysBack: 14 })
    return res.status(200).json({
      ok: true,
      pulled: result.pulled,
      new: result.appended,
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    console.error('crew-sync error:', msg)
    return res.status(500).json({ error: msg })
  }
}
