// Diagnostic endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return res.status(200).json({
      ok: true,
      msg: 'pong',
      env: {
        has_plaid_id: !!process.env.PLAID_CLIENT_ID,
        has_plaid_prod: !!process.env.PLAID_PROD_SECRET,
        has_plaid_sandbox: !!process.env.PLAID_SANDBOX_SECRET,
        plaid_env: process.env.PLAID_ENV || null,
        has_google_key: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        has_hmac: !!process.env.HMAC_SECRET,
        has_app_secret: !!process.env.APP_SECRET,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
