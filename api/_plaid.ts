// Shared Plaid client + Plaid_Items sheet helpers.
//
// Env vars (added to Vercel):
//   PLAID_CLIENT_ID
//   PLAID_PROD_SECRET
//   PLAID_SANDBOX_SECRET
//   PLAID_ENV=production|sandbox   (default: production)
// Admin endpoints require header:  Authorization: Bearer <admin-token>  (matches api/auth.ts scheme)
// Re-exported from a Plaid + Sheets helper. Vercel Node runtime.
import crypto from 'crypto'
import { google } from 'googleapis'
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const SPREADSHEET_ID = '1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk'
export const PLAID_ITEMS_TAB = 'Plaid_Items'
export const EXPENSES_TAB = 'Expenses'

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}

export function plaidEnvName(): 'production' | 'sandbox' {
  const env = (cleanEnv(process.env.PLAID_ENV) || 'production').toLowerCase()
  return env === 'sandbox' ? 'sandbox' : 'production'
}

export function plaidClient(envOverride?: 'production' | 'sandbox'): PlaidApi {
  const clientId = cleanEnv(process.env.PLAID_CLIENT_ID)
  if (!clientId) throw new Error('PLAID_CLIENT_ID not set')
  const env = envOverride || plaidEnvName()
  const secret = env === 'sandbox'
    ? cleanEnv(process.env.PLAID_SANDBOX_SECRET)
    : cleanEnv(process.env.PLAID_PROD_SECRET)
  if (!secret) throw new Error(`Plaid secret for ${env} not set`)
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  })
  return new PlaidApi(config)
}

export function sheetsAuth(readWrite: boolean = false) {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: readWrite
      ? ['https://www.googleapis.com/auth/spreadsheets']
      : ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function _hmac(payload: string): string {
  const secret = (process.env.HMAC_SECRET || process.env.APP_SECRET || 'fallback-secret').trim()
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function verifyToken(token: string | undefined | null): { ok: boolean; role?: 'admin' | 'viewer' | 'crew' } {
  if (!token || typeof token !== 'string') return { ok: false }
  const dot = token.indexOf('.')
  if (dot < 0) return { ok: false }
  const b64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let payload = ''
  try { payload = Buffer.from(b64, 'base64').toString('utf-8') } catch { return { ok: false } }
  const expected = _hmac(payload)
  if (sig.length !== expected.length) return { ok: false }
  try {
    const sigBuf = new Uint8Array(Buffer.from(sig, 'hex'))
    const expBuf = new Uint8Array(Buffer.from(expected, 'hex'))
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return { ok: false }
  } catch { return { ok: false } }
  const parts = payload.split(':')
  if (parts.length < 3 || parts[0] !== 'auth') return { ok: false }
  const role = parts[1]
  if (role === 'admin' || role === 'viewer' || role === 'crew') return { ok: true, role }
  return { ok: false }
}

function getBearer(req: VercelRequest): string | null {
  const h = req.headers['authorization'] || req.headers['Authorization' as any]
  if (!h || typeof h !== 'string') return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const auth = verifyToken(getBearer(req))
  if (!auth.ok || auth.role !== 'admin') {
    res.status(401).json({ error: 'Unauthorized: admin token required' })
    return false
  }
  return true
}

export type PlaidItemRow = {
  rowIndex: number   // 1-based row in Plaid_Items including header row
  item_id: string
  access_token: string
  institution_name: string
  account_labels: string   // JSON of {account_id: label} - e.g. {"acc_1":"Amex 3240"}
  cursor: string
  added_at: string
  last_synced_at: string
  status: string           // 'active' | 'unlinked' | 'error'
}

export const PLAID_PRODUCTS: Products[] = [Products.Transactions]
export const PLAID_COUNTRIES: CountryCode[] = [CountryCode.Us]

export async function readPlaidItems(): Promise<PlaidItemRow[]> {
  const auth = sheetsAuth(false)
  const sheets = google.sheets({ version: 'v4', auth })
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PLAID_ITEMS_TAB}!A2:H`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  const values = resp.data.values || []
  const rows: PlaidItemRow[] = values.map((r, i) => ({
    rowIndex: i + 2,
    item_id: String(r[0] ?? ''),
    access_token: String(r[1] ?? ''),
    institution_name: String(r[2] ?? ''),
    account_labels: String(r[3] ?? ''),
    cursor: String(r[4] ?? ''),
    added_at: String(r[5] ?? ''),
    last_synced_at: String(r[6] ?? ''),
    status: String(r[7] ?? 'active'),
  })).filter(r => r.item_id && r.access_token)
  return rows
}

export async function appendPlaidItem(item: Omit<PlaidItemRow, 'rowIndex'>): Promise<void> {
  const auth = sheetsAuth(true)
  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PLAID_ITEMS_TAB}!A:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        item.item_id, item.access_token, item.institution_name,
        item.account_labels, item.cursor, item.added_at,
        item.last_synced_at, item.status,
      ]],
    },
  })
}

export async function updatePlaidItem(rowIndex: number, patch: Partial<PlaidItemRow>): Promise<void> {
  const auth = sheetsAuth(true)
  const sheets = google.sheets({ version: 'v4', auth })
  // Read current row, merge, write back
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PLAID_ITEMS_TAB}!A${rowIndex}:H${rowIndex}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  const r = cur.data.values?.[0] || []
  const merged = [
    patch.item_id           ?? r[0] ?? '',
    patch.access_token      ?? r[1] ?? '',
    patch.institution_name  ?? r[2] ?? '',
    patch.account_labels    ?? r[3] ?? '',
    patch.cursor            ?? r[4] ?? '',
    patch.added_at          ?? r[5] ?? '',
    patch.last_synced_at    ?? r[6] ?? '',
    patch.status            ?? r[7] ?? 'active',
  ]
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PLAID_ITEMS_TAB}!A${rowIndex}:H${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [merged] },
  })
}

// Map an account_id -> label ("Amex 3240" / "Bilt 0540" / "Unknown") using all rows' account_labels.
export function buildAccountLabelMap(items: PlaidItemRow[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const it of items) {
    if (!it.account_labels) continue
    try {
      const parsed = JSON.parse(it.account_labels)
      for (const [aid, label] of Object.entries(parsed as Record<string, string>)) {
        map[aid] = label
      }
    } catch {}
  }
  return map
}
