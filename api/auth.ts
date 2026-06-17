import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// Support multiple env var names for backward compat
const ACCESS_CODE = process.env.APP_PASSWORD || process.env.ACCESS_CODE || process.env.LOGIN_CODE || process.env.AUTH_CODE
const HMAC_SECRET = process.env.HMAC_SECRET || process.env.APP_SECRET || 'fallback-secret'

function sign(payload: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex')
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.body as { code?: string }

  if (!code || code.trim() !== ACCESS_CODE) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const payload = `auth:${Date.now()}`
  const token = `${Buffer.from(payload).toString('base64')}.${sign(payload)}`

  return res.status(200).json({ token })
}