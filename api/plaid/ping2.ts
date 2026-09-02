import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    plaid_env_names: Object.keys(PlaidEnvironments),
    has_api: typeof PlaidApi === 'function',
  })
}
