// Amex email parser — TypeScript port of amex_reconcile.py's parse_raw_row.
//
// Given a CloudMailin normalized-JSON payload (or the raw pieces of one),
// returns structured fields (merchant, amount, currency, txn_date, last-4).
// The account label ("Amex 3240") is derived from the last-4.
//
// Both the modern "Large Purchase Approved" HTML template and the legacy
// prose-format alerts are supported.

export type ParsedAmex = {
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

export type CloudMailinShape = {
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

export function parseCloudMailin(
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

export const PARSED_HEADERS = [
  'message_id', 'received_at_utc', 'email_from', 'email_subject',
  'txn_date', 'merchant', 'local_amount', 'local_currency',
  'account_last4', 'account_label',
  'usd_amount', 'plaid_txn_id', 'plaid_matched_at', 'match_confidence',
  'parse_status', 'notes',
] as const

export function parsedToRow(p: ParsedAmex): string[] {
  return PARSED_HEADERS.map((h) => (p as any)[h] ?? '')
}
