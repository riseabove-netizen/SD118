import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SPREADSHEET_ID } from '../_plaid'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ ok: true, ssid: SPREADSHEET_ID })
}
