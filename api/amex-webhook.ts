// CloudMailin inbound-email webhook for Amex + Bilt purchase alerts.
//
// Setup:
//   - CloudMailin target URL: https://sd118-runlog.vercel.app/api/amex-webhook
//   - CloudMailin format: JSON (normalized)
//   - CloudMailin Authorization header: Bearer <CLOUDMAILIN_TOKEN>
//   - Gmail filter forwards Amex/Bilt purchase alerts to CloudMailin address,
//     which then POSTs to this endpoint.
//
// What this endpoint does on every POST:
//   1) Verifies Bearer token.
//   2) Parses the CloudMailin payload into structured fields
//      (merchant, amount, currency, txn_date, last-4, account label).
//   3) Appends the raw payload to Amex_Emails_Raw (audit trail — enables
//      re-parsing offline if the parser ever needs tuning).
//   4) Appends the parsed row to Amex_Emails, dedup'd by message_id.
//      USD stays blank for foreign-currency charges — the daily reconciler
//      fills those from Plaid.
//   5) Returns 200 (never 4xx/5xx to avoid CloudMailin retries).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { parseCloudMailin, parsedToRow, PARSED_HEADERS, type ParsedAmex } from './amex-parser'

export const config = { maxDuration: 20 }

const EXPENSES_SPREADSHEET_ID = '1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk'
const RAW_SHEET = 'Amex_Emails_Raw'
const PARSED_SHEET = 'Amex_Emails'
const RAW_HEADERS = ['received_at_utc', 'from', 'subject', 'message_id', 'plain_snippet', 'raw_json']

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}

function getSheetsAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureSheet(sheets: any, title: string, headers: readonly string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: EXPENSES_SPREADSHEET_ID })
  const exists = (meta.data.sheets || []).some((s: any) => s.properties?.title === title)
  if (exists) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: EXPENSES_SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: EXPENSES_SPREADSHEET_ID,
    range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [Array.from(headers)] },
  })
}

function verifyBearer(req: VercelRequest): boolean {
  const expected = cleanEnv(process.env.CLOUDMAILIN_TOKEN)
  if (!expected) return false
  const auth = String(req.headers['authorization'] || '')
  if (!auth.toLowerCase().startsWith('bearer ')) return false
  const provided = auth.slice(7).trim()
  if (provided.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < provided.length; i++) mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0
}

// Truncate the raw payload down to Google's 50k-cell limit while preserving
// JSON structure. Trims the html/plain bodies from the end rather than the
// whole serialized string (which would leave invalid JSON).
function safeSerialize(body: any, cellLimit = 45000): string {
  const shrinkable = { ...body }
  let serialized = JSON.stringify(shrinkable)
  if (serialized.length <= cellLimit) return serialized
  for (const field of ['html', 'plain'] as const) {
    if (typeof shrinkable[field] === 'string' && shrinkable[field].length > 0) {
      const overshoot = serialized.length - cellLimit
      if (overshoot > 0) {
        const newLen = Math.max(0, shrinkable[field].length - overshoot - 200)
        shrinkable[field] = shrinkable[field].slice(0, newLen)
        serialized = JSON.stringify(shrinkable)
      }
    }
    if (serialized.length <= cellLimit) return serialized
  }
  if (serialized.length > cellLimit && shrinkable.attachments) {
    delete shrinkable.attachments
    serialized = JSON.stringify(shrinkable)
  }
  if (serialized.length > cellLimit) serialized = serialized.slice(0, cellLimit)
  return serialized
}

async function isDuplicateMessageId(sheets: any, messageId: string): Promise<boolean> {
  if (!messageId) return false
  // Read column A (message_id) of Amex_Emails. Small — one column.
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: EXPENSES_SPREADSHEET_ID,
    range: `${PARSED_SHEET}!A2:A`,
  })
  const rows: string[][] = resp.data.values || []
  for (const r of rows) if (r[0] === messageId) return true
  return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: 'amex-webhook',
      hint: 'POST CloudMailin normalized-JSON payloads here with Authorization: Bearer <token>',
      hasToken: !!cleanEnv(process.env.CLOUDMAILIN_TOKEN),
      parses: true,
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!verifyBearer(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' })

  const body: any = req.body || {}
  const nowIso = new Date().toISOString()

  const headers = body.headers || {}
  const from = String(headers.from || body?.envelope?.from || '')
  const subject = String(headers.subject || '')
  const messageId = String(headers.message_id || '').replace(/^<|>$/g, '')
  const plain = String(body.plain || '')
  const plainSnippet = plain.slice(0, 500)

  // Parse first — cheap, in-memory, and we want to log parse status even if
  // the sheet writes fail.
  let parsed: ParsedAmex | null = null
  let parseError: string | null = null
  try {
    parsed = parseCloudMailin(body, {
      receivedAtUtc: nowIso,
      from,
      subject,
      messageId,
      plainSnippet,
    })
  } catch (err: any) {
    parseError = err?.message || String(err)
    console.error('[amex-webhook] parse failed:', parseError)
  }

  let rawWriteOk = false
  let parsedWriteOk = false
  let parsedDedup = false
  let sheetError: string | null = null
  try {
    const auth = getSheetsAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    await ensureSheet(sheets, RAW_SHEET, RAW_HEADERS)
    await ensureSheet(sheets, PARSED_SHEET, PARSED_HEADERS)

    // 1) Append raw row (audit trail — always, even if parse failed).
    const rawJson = safeSerialize(body)
    await sheets.spreadsheets.values.append({
      spreadsheetId: EXPENSES_SPREADSHEET_ID,
      range: `${RAW_SHEET}!A:F`,
      valueInputOption: 'RAW',
      requestBody: { values: [[nowIso, from, subject, messageId, plainSnippet, rawJson]] },
    })
    rawWriteOk = true

    // 2) Append parsed row to Amex_Emails, dedup'd by message_id.
    if (parsed && parsed.parse_status !== 'not_amex') {
      const dup = await isDuplicateMessageId(sheets, parsed.message_id)
      if (dup) {
        parsedDedup = true
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: EXPENSES_SPREADSHEET_ID,
          range: `${PARSED_SHEET}!A:P`,
          valueInputOption: 'RAW',
          requestBody: { values: [parsedToRow(parsed)] },
        })
        parsedWriteOk = true
      }
    }
  } catch (err: any) {
    sheetError = err?.message || String(err)
    console.error('[amex-webhook] sheet write failed:', sheetError)
  }

  console.log('[amex-webhook] received', {
    from,
    subject,
    messageId,
    parseStatus: parsed?.parse_status,
    merchant: parsed?.merchant,
    localAmount: parsed?.local_amount,
    localCurrency: parsed?.local_currency,
    last4: parsed?.account_last4,
    txnDate: parsed?.txn_date,
    rawWriteOk,
    parsedWriteOk,
    parsedDedup,
  })

  return res.status(200).json({
    ok: true,
    receivedAt: nowIso,
    from,
    subject,
    messageId,
    parseStatus: parsed?.parse_status || null,
    parseError,
    parsed: parsed
      ? {
          merchant: parsed.merchant,
          local_amount: parsed.local_amount,
          local_currency: parsed.local_currency,
          txn_date: parsed.txn_date,
          account_last4: parsed.account_last4,
          account_label: parsed.account_label,
          notes: parsed.notes,
        }
      : null,
    rawWriteOk,
    parsedWriteOk,
    parsedDedup,
    sheetError,
  })
}
