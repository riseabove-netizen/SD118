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


// ==== inlined parser (see api/_amex-parser.ts for canonical source) ====
// Amex email parser — TypeScript port of amex_reconcile.py's parse_raw_row.
//
// Given a CloudMailin normalized-JSON payload (or the raw pieces of one),
// returns structured fields (merchant, amount, currency, txn_date, last-4).
// The account label ("Amex 3240") is derived from the last-4.
//
// Both the modern "Large Purchase Approved" HTML template and the legacy
// prose-format alerts are supported.

type ParsedAmex = {
  message_id: string
  received_at_utc: string
  email_from: string
  email_subject: string
  txn_date: string          // YYYY-MM-DD
  merchant: string
  local_amount: string      // formatted "32.60" or ""
  local_currency: string    // "USD" | "EUR" | ... | ""
  account_last4: string     // 4 digits or ""
  account_label: string     // "Amex 3240" or "" — the reconciler may still fill Plaid's own label
  usd_amount: string
  plaid_txn_id: string
  plaid_matched_at: string
  match_confidence: string
  parse_status: 'ok' | 'parse_failed' | 'not_amex' | ''
  notes: string
}

type CloudMailinShape = {
  headers?: Record<string, any>
  envelope?: Record<string, any>
  plain?: string
  html?: string
  attachments?: any[]
}

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₣': 'CHF',
}
const CURRENCY_CODES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'MXN'])
const AMOUNT_NOISE_PHRASES = ['more than', 'over $', 'greater than', 'exceeds', 'exceeded']

// Match a currency-tagged amount. Also strips trailing '*' footnote marker.
const RE_AMOUNT = /(?<sym>[$€£¥₣])?\s*(?<code>USD|EUR|GBP|JPY|CHF|CAD|AUD|MXN)?\s*(?<num>\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2}))\*?/gi

// Modern Amex template: merchant sits in a <p> inside a color:#006fcf <div>.
const RE_MERCHANT_HTML_BLUE = /<div[^>]*color:\s*#006fcf[^>]*>\s*<p[^>]*>([^<]{2,80})<\/p>/i

// Legacy prose: "... at MERCHANT NAME was ..."
const RE_MERCHANT_PROSE = /\bat\s+([A-Z0-9][A-Z0-9 &'.\-*/]{1,60}?)(?=\s+was\b|\s+on\b|\s+for\b|\s*\.)/i

// "Account Ending: 53240" — take last 4 in code.
const RE_ACCOUNT_ENDING = /account\s*ending[\s:]*?(\d{4,6})/i
const RE_LAST4_FALLBACK = /(?:ending(?:\s+in)?|acct?\s*(?:ending|no\.?)|xxxx+|\*{2,})[\s:*x]*?(\d{4})/i

const RE_DATE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4}|[A-Z][a-z]{2},\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\b/

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}` }

function tryParseDate(raw: string, receivedIso: string): string {
  const s = raw.trim()

  // "Thu, Aug 20, 2026" or "Aug 20, 2026" or "August 20, 2026"
  const m1 = s.match(/^(?:[A-Za-z]{3,},\s+)?([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m1) {
    const mon = MONTHS[m1[1].toLowerCase()]
    if (mon) return `${m1[3]}-${pad2(mon)}-${pad2(Number(m1[2]))}`
  }

  // 08/20/2026 or 08-20-2026 or 08/20/26 — assume M/D/Y (Amex is US-formatted)
  const m2 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m2) {
    let [_, a, b, y] = m2
    let year = Number(y)
    if (y.length === 2) year += year < 50 ? 2000 : 1900
    return `${year}-${pad2(Number(a))}-${pad2(Number(b))}`
  }

  // Fallback: date of received timestamp
  try {
    const d = new Date(receivedIso)
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    }
  } catch { /* noop */ }
  return ''
}

function stripHtmlToText(html: string): string {
  if (!html) return ''
  let s = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<[^>]+>/g, '\n')
  s = decodeHtmlEntities(s)
  const lines = s.split(/\r?\n/)
    .map((ln) => ln.replace(/[ \t]+/g, ' ').trim())
    .filter((ln) => ln.length > 0)
  return lines.join('\n')
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)) } catch { return _ }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)) } catch { return _ }
    })
}

// Quoted-printable decode. CloudMailin usually delivers already-decoded HTML,
// but this is defensive.
function maybeDecodeQP(s: string): string {
  if (!s || !s.includes('=')) return s
  if (!/=[0-9A-Fa-f]{2}/.test(s)) return s
  try {
    // Handle soft-break `=\n` first
    const withoutSoft = s.replace(/=\r?\n/g, '')
    // Then decode =XX pairs to bytes, then interpret bytes as UTF-8
    const bytes: number[] = []
    for (let i = 0; i < withoutSoft.length; i++) {
      const c = withoutSoft.charCodeAt(i)
      if (withoutSoft[i] === '=' && i + 2 < withoutSoft.length) {
        const hex = withoutSoft.slice(i + 1, i + 3)
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16))
          i += 2
          continue
        }
      }
      // Non-ASCII char: keep its raw UTF-8 bytes via TextEncoder to preserve encoding
      if (c < 128) {
        bytes.push(c)
      } else {
        const enc = new TextEncoder().encode(withoutSoft[i])
        enc.forEach((b) => bytes.push(b))
      }
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
  } catch {
    return s
  }
}

function parseAmount(text: string): { amount: number | null; currency: string | null } {
  // Iterate manually because /g regex needs a fresh state each call
  const re = new RegExp(RE_AMOUNT.source, RE_AMOUNT.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    // Look at the last 20 chars up to (but not across) a newline: a noise
    // phrase in a different paragraph doesn't apply to this match.
    const preStart = Math.max(0, m.index - 20)
    const preFull = text.slice(preStart, m.index)
    const nl = preFull.lastIndexOf('\n')
    const pre = (nl >= 0 ? preFull.slice(nl + 1) : preFull).toLowerCase()
    if (AMOUNT_NOISE_PHRASES.some((p) => pre.includes(p))) continue

    const groups = m.groups || {}
    let raw = groups.num || ''
    // Normalize decimal separator: last "," or "." is the decimal
    if (raw.includes(',') && raw.includes('.')) {
      if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
        raw = raw.replace(/\./g, '').replace(',', '.')
      } else {
        raw = raw.replace(/,/g, '')
      }
    } else if (raw.includes(',') && raw.split(',').length === 2 && raw.split(',')[1].length === 2) {
      raw = raw.replace(',', '.')
    } else {
      raw = raw.replace(/,/g, '')
    }
    const amt = parseFloat(raw)
    if (isNaN(amt)) continue

    const code = (groups.code || '').toUpperCase()
    const sym = groups.sym || ''
    if (code && CURRENCY_CODES.has(code)) return { amount: amt, currency: code }
    if (sym && CURRENCY_BY_SYMBOL[sym]) return { amount: amt, currency: CURRENCY_BY_SYMBOL[sym] }
    // No currency signal — keep looking
  }
  return { amount: null, currency: null }
}

function parseMerchant(html: string, text: string): string | null {
  if (html) {
    const m = html.match(RE_MERCHANT_HTML_BLUE)
    if (m) {
      const name = decodeHtmlEntities(m[1]).trim().replace(/^[ .]+|[ .]+$/g, '')
      if (name) return name
    }
  }
  const m2 = (text || '').match(RE_MERCHANT_PROSE)
  return m2 ? m2[1].trim().replace(/^[ .]+|[ .]+$/g, '') : null
}

function parseLast4(text: string): string | null {
  const m = text.match(RE_ACCOUNT_ENDING)
  if (m) return m[1].slice(-4)
  const m2 = text.match(RE_LAST4_FALLBACK)
  return m2 ? m2[1] : null
}

function parseDate(text: string, receivedIso: string): string {
  const m = text.match(RE_DATE)
  if (m) {
    const iso = tryParseDate(m[1], receivedIso)
    if (iso) return iso
  }
  try {
    const d = new Date(receivedIso)
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    }
  } catch { /* noop */ }
  return ''
}

function labelFromLast4(last4: string): string {
  // Known account labels (see project memory carryover).
  if (last4 === '3240') return 'Amex 3240'
  return last4 ? `Amex ${last4}` : ''
}

function parseCloudMailin(
  payload: CloudMailinShape,
  meta: { receivedAtUtc: string; from: string; subject: string; messageId: string; plainSnippet?: string },
): ParsedAmex {
  const base: ParsedAmex = {
    message_id: meta.messageId || '',
    received_at_utc: meta.receivedAtUtc || '',
    email_from: meta.from || '',
    email_subject: meta.subject || '',
    txn_date: '',
    merchant: '',
    local_amount: '',
    local_currency: '',
    account_last4: '',
    account_label: '',
    usd_amount: '',
    plaid_txn_id: '',
    plaid_matched_at: '',
    match_confidence: '',
    parse_status: '',
    notes: '',
  }

  const isAmex = /americanexpress\.com/i.test(meta.from || '')
  if (!isAmex) {
    base.parse_status = 'not_amex'
    base.notes = `skipped: from=${JSON.stringify(meta.from || '')}`
    return base
  }

  const html = maybeDecodeQP(String(payload.html || ''))
  const plain = maybeDecodeQP(String(payload.plain || ''))
  const htmlText = stripHtmlToText(html)
  const searchText = [meta.subject || '', meta.plainSnippet || '', plain, htmlText]
    .filter((s) => s && s.length)
    .join('\n')

  const { amount, currency } = parseAmount(searchText)
  const merchant = parseMerchant(html, searchText)
  const last4 = parseLast4(searchText)
  const txnDate = parseDate(searchText, meta.receivedAtUtc || '')

  base.txn_date = txnDate
  base.merchant = merchant || ''
  base.local_amount = amount != null ? amount.toFixed(2) : ''
  base.local_currency = currency || ''
  base.account_last4 = last4 || ''
  base.account_label = labelFromLast4(last4 || '')

  const missing: string[] = []
  if (amount == null) missing.push('amount')
  if (!merchant) missing.push('merchant')
  if (!last4) missing.push('last4')
  if (!txnDate) missing.push('date')
  base.parse_status = missing.length === 0 ? 'ok' : 'parse_failed'
  if (missing.length) base.notes = 'missing: ' + missing.join(',')
  return base
}

const PARSED_HEADERS = [
  'message_id', 'received_at_utc', 'email_from', 'email_subject',
  'txn_date', 'merchant', 'local_amount', 'local_currency',
  'account_last4', 'account_label',
  'usd_amount', 'plaid_txn_id', 'plaid_matched_at', 'match_confidence',
  'parse_status', 'notes',
] as const

function parsedToRow(p: ParsedAmex): string[] {
  return PARSED_HEADERS.map((h) => (p as any)[h] ?? '')
}


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
