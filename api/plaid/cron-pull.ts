// Daily Plaid pull (Vercel cron, 07:00 UTC = 03:00 EDT).
// Filters to Gabriel Garcez's cards only (Amex 3240 + Bilt 0540). Enrico's
// Bilt cards (masks 2047, 5281) are naturally excluded by the mask filter.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCronOrAdmin } from '../_plaid.js'
import { syncPlaidTransactions } from '../_plaid-txns.js'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCronOrAdmin(req, res)) return
  try {
    const result = await syncPlaidTransactions()
    return res.status(200).json({
      ok: true,
      pulled: result.pulled,
      new: result.appended,
      per_item: result.per_item,
    })
  } catch (e: any) {
    const msg = e?.response?.data?.error_message || e?.message || String(e)
    console.error('cron-pull error:', msg)
    return res.status(500).json({ error: msg })
  }
}
