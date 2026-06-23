import type { VercelRequest, VercelResponse } from '@vercel/node'
import extractHandler from '../lib/bulk-extract'
import reviseHandler from '../lib/bulk-revise'
import saveHandler from '../lib/bulk-save'

export const config = {
  api: { bodyParser: { sizeLimit: '40mb' } },
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '').trim()
  if (action === 'extract') return extractHandler(req, res)
  if (action === 'revise') return reviseHandler(req, res)
  if (action === 'save') return saveHandler(req, res)
  return res.status(400).json({ error: 'Invalid action', detail: 'action must be extract|revise|save' })
}
