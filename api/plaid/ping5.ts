import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { google } from 'googleapis'
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    crypto: typeof crypto.createHmac,
    google: typeof google.sheets,
    plaid: typeof PlaidApi,
    envs: Object.keys(PlaidEnvironments),
    countries: Object.keys(CountryCode).length,
    products: Object.keys(Products).length,
    Config: typeof Configuration,
  })
}
