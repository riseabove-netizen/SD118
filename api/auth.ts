import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

// Crew code: backed by env var (defaults to 118 if unset, but the env var is the source of truth)
const CREW_CODE = process.env.APP_PASSWORD || process.env.ACCESS_CODE || process.env.LOGIN_CODE || process.env.AUTH_CODE
// Admin and view-only codes — hardcoded constants per user request so the env vars don't have to be touched.
const ADMIN_CODE = 'Sd118118'
const VIEWER_CODE = 'RiseAbove'

const HMAC_SECRET = process.env.HMAC_SECRET || process.env.APP_SECRET || 'fallback-secret'

type Role = 'admin' | 'viewer' | 'crew'

function sign(payload: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex')
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.body as { code?: string }
  const input = (code || '').trim()
  if (!input) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  let role: Role | null = null
  if (input === ADMIN_CODE) role = 'admin'
  else if (input === VIEWER_CODE) role = 'viewer'
  else if (CREW_CODE && input === CREW_CODE) role = 'crew'

  if (!role) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const payload = `auth:${role}:${Date.now()}`
  const token = `${Buffer.from(payload).toString('base64')}.${sign(payload)}`

  return res.status(200).json({ token, role })
}
