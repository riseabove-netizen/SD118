import type { VercelRequest, VercelResponse } from '@vercel/node'
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const readSecret = (v: string | undefined) => {
    if (!v) return { present: false }
    const trimmed = v.trim()
    return { present: true, length: v.length, trimmed_length: trimmed.length, first_char: trimmed[0], last_char: trimmed[trimmed.length-1] }
  }
  return res.status(200).json({
    PLAID_CLIENT_ID: readSecret(process.env.PLAID_CLIENT_ID),
    PLAID_PROD_SECRET: readSecret(process.env.PLAID_PROD_SECRET),
    PLAID_SANDBOX_SECRET: readSecret(process.env.PLAID_SANDBOX_SECRET),
    PLAID_ENV_raw: process.env.PLAID_ENV,
    PLAID_ENV_trimmed_lower: (process.env.PLAID_ENV || '').trim().toLowerCase(),
  })
}
