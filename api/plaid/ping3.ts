// Test readPlaidItems directly
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readPlaidItems } from '../_plaid'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const items = await readPlaidItems()
    return res.status(200).json({ ok: true, count: items.length, first_item_id: items[0]?.item_id || null })
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e), stack: String(e?.stack || '').slice(0, 500) })
  }
}
