// CloudMailin inbound-email webhook for Amex + Bilt purchase alerts.
//
// Setup:
//   - CloudMailin target URL: https://sd118-runlog.vercel.app/api/amex-webhook
//   - CloudMailin format: JSON (normalized)
//   - CloudMailin Authorization header: Bearer <CLOUDMAILIN_TOKEN>
//   - Gmail filter forwards Amex/Bilt purchase alerts to CloudMailin address,
//     which then POSTs to this endpoint.
//
// This first iteration just:
//   1) Accepts POST (avoids 405 that blocks Gmail forwarding verification).
//   2) Verifies Bearer token.
//   3) Logs the payload to Vercel logs and to a sheet raw-capture tab
//      so we can see the real Amex/Bilt email shape before writing the parser.
//   4) Returns 200.
//
// Once we have a real Amex/Bilt alert captured, we'll add:
//   - Regex parser for amount / merchant / card last-4 / date
//   - Dedup by Gmail message-id
//   - Append to Amex_Emails tab
//   - Reconciliation against Plaid_Transactions

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = { maxDuration: 20 }

const EXPENSES_SPREADSHEET_ID = '1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk'
const RAW_SHEET = 'Amex_Emails_Raw'
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

async function ensureRawSheet(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: EXPENSES_SPREADSHEET_ID })
  const exists = (meta.data.sheets || []).some((s: any) => s.properties?.title === RAW_SHEET)
  if (exists) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: EXPENSES_SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: RAW_SHEET } } }] },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: EXPENSES_SPREADSHEET_ID,
    range: `${RAW_SHEET}!A1:${String.fromCharCode(64 + RAW_HEADERS.length)}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [RAW_HEADERS] },
  })
}

function verifyBearer(req: VercelRequest): boolean {
  const expected = cleanEnv(process.env.CLOUDMAILIN_TOKEN)
  if (!expected) {
    // No token configured — refuse rather than accept anything.
    return false
  }
  const auth = String(req.headers['authorization'] || '')
  if (!auth.toLowerCase().startsWith('bearer ')) return false
  const provided = auth.slice(7).trim()
  // Timing-safe-ish compare
  if (provided.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < provided.length; i++) mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET for a quick health check (also useful when clicking the URL in a browser).
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: 'amex-webhook',
      hint: 'POST CloudMailin normalized-JSON payloads here with Authorization: Bearer <token>',
      hasToken: !!cleanEnv(process.env.CLOUDMAILIN_TOKEN),
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!verifyBearer(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const body: any = req.body || {}
  const nowIso = new Date().toISOString()

  // CloudMailin normalized JSON shape (see docs.cloudmailin.com):
  //   { headers: {...}, envelope: {...}, plain: "...", html: "...", attachments: [...] }
  const headers = body.headers || {}
  const from = String(headers.from || body?.envelope?.from || '')
  const subject = String(headers.subject || '')
  const messageId = String(headers.message_id || '').replace(/^<|>$/g, '')
  const plain = String(body.plain || '')
  const plainSnippet = plain.slice(0, 500)

  let sheetWriteOk = false
  let sheetWriteError: string | null = null
  try {
    const auth = getSheetsAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    await ensureRawSheet(sheets)
    // Truncate raw_json to avoid Google's per-cell size limits (50k chars).
    const rawJson = JSON.stringify(body).slice(0, 45000)
    await sheets.spreadsheets.values.append({
      spreadsheetId: EXPENSES_SPREADSHEET_ID,
      range: `${RAW_SHEET}!A:F`,
      valueInputOption: 'RAW',
      requestBody: { values: [[nowIso, from, subject, messageId, plainSnippet, rawJson]] },
    })
    sheetWriteOk = true
  } catch (err: any) {
    sheetWriteError = err?.message || String(err)
    // Still return 200 — we don't want CloudMailin to retry if the sheet is
    // temporarily rate-limited. The raw email is preserved in Vercel logs.
    console.error('[amex-webhook] sheet write failed:', sheetWriteError)
  }

  console.log('[amex-webhook] received', {
    from,
    subject,
    messageId,
    plainSnippetLength: plainSnippet.length,
    sheetWriteOk,
  })

  return res.status(200).json({
    ok: true,
    receivedAt: nowIso,
    from,
    subject,
    messageId,
    sheetWriteOk,
    sheetWriteError,
  })
}
