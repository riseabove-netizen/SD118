// Smoke test for the Amex parser. Run with: npx tsx api/_amex-parser.test.ts
// Tests both modern HTML template ("Large Purchase Approved") and legacy prose.

import { parseCloudMailin } from './_amex-parser'
import fs from 'node:fs'

function assert(cond: any, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
}

// ---------- Test 1: modern HTML template ----------
// Extract HTML from the uploaded .eml (crude but portable — the tsx runner can
// read a file synchronously). Skips gracefully if the file isn't present.
const EML_PATH = '/home/user/workspace/uploaded_attachments/adfd3d5f0c814539abfab590a90f0cc5/Large-Purchase-Approved.eml'
if (fs.existsSync(EML_PATH)) {
  const raw = fs.readFileSync(EML_PATH, 'utf-8')
  // Extract the text/html part naively: find the last "Content-Type: text/html"
  // block and grab everything up to the next boundary.
  const htmlStart = raw.indexOf('Content-Type: text/html')
  const bodyStart = raw.indexOf('\r\n\r\n', htmlStart) + 4
  // Boundary lines start with --. Find the next one.
  const rest = raw.slice(bodyStart)
  const boundaryIdx = rest.search(/\r?\n--/)
  let htmlBody = boundaryIdx > 0 ? rest.slice(0, boundaryIdx) : rest
  // Decode quoted-printable directly here (mirrors what maybeDecodeQP does).
  htmlBody = htmlBody.replace(/=\r?\n/g, '')
  // Byte-level QP decode
  const bytes: number[] = []
  for (let i = 0; i < htmlBody.length; i++) {
    if (htmlBody[i] === '=' && i + 2 < htmlBody.length && /^[0-9A-Fa-f]{2}$/.test(htmlBody.slice(i + 1, i + 3))) {
      bytes.push(parseInt(htmlBody.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      const c = htmlBody.charCodeAt(i)
      if (c < 128) bytes.push(c)
      else {
        const enc = new TextEncoder().encode(htmlBody[i])
        enc.forEach((b) => bytes.push(b))
      }
    }
  }
  htmlBody = new TextDecoder('utf-8').decode(new Uint8Array(bytes))

  const parsed = parseCloudMailin(
    { html: htmlBody, plain: '', headers: {}, envelope: {} },
    {
      receivedAtUtc: '2026-08-21T05:00:00Z',
      from: 'American Express <AmericanExpress@welcome.americanexpress.com>',
      subject: 'Large Purchase Approved',
      messageId: 'test-modern-001',
      plainSnippet: '',
    },
  )

  console.log('=== Modern HTML template ===')
  console.log(parsed)
  assert(parsed.merchant === 'CHALET CIMMINO', `merchant expected CHALET CIMMINO, got ${parsed.merchant}`)
  assert(parsed.local_amount === '32.60', `amount expected 32.60, got ${parsed.local_amount}`)
  assert(parsed.local_currency === 'EUR', `currency expected EUR, got ${parsed.local_currency}`)
  assert(parsed.txn_date === '2026-08-20', `date expected 2026-08-20, got ${parsed.txn_date}`)
  assert(parsed.account_last4 === '3240', `last4 expected 3240, got ${parsed.account_last4}`)
  assert(parsed.account_label === 'Amex 3240', `label expected Amex 3240, got ${parsed.account_label}`)
  assert(parsed.parse_status === 'ok', `status expected ok, got ${parsed.parse_status}`)
  console.log('MODERN OK\n')
} else {
  console.log('skip modern test: .eml not present')
}

// ---------- Test 2: legacy prose ----------
{
  const parsed = parseCloudMailin(
    { html: '', plain: 'A charge of $50.00 at COFFEE SHOP was authorized on your account ending in 1234 on 08/20/2026.', headers: {}, envelope: {} },
    {
      receivedAtUtc: '2026-08-21T00:00:00Z',
      from: 'alerts@americanexpress.com',
      subject: 'Charge of $50.00 at COFFEE SHOP',
      messageId: 'test-legacy-001',
      plainSnippet: '',
    },
  )
  console.log('=== Legacy prose ===')
  console.log(parsed)
  assert(parsed.merchant === 'COFFEE SHOP', `merchant expected COFFEE SHOP, got ${parsed.merchant}`)
  assert(parsed.local_amount === '50.00', `amount expected 50.00, got ${parsed.local_amount}`)
  assert(parsed.local_currency === 'USD', `currency expected USD, got ${parsed.local_currency}`)
  assert(parsed.txn_date === '2026-08-20', `date expected 2026-08-20, got ${parsed.txn_date}`)
  assert(parsed.account_last4 === '1234', `last4 expected 1234, got ${parsed.account_last4}`)
  assert(parsed.parse_status === 'ok', `status expected ok, got ${parsed.parse_status}`)
  console.log('LEGACY OK\n')
}

// ---------- Test 3: non-Amex sender ----------
{
  const parsed = parseCloudMailin(
    { html: '<p>random spam</p>', plain: '', headers: {}, envelope: {} },
    { receivedAtUtc: '2026-08-21T00:00:00Z', from: 'someone@example.com', subject: 'hi', messageId: 'x', plainSnippet: '' },
  )
  assert(parsed.parse_status === 'not_amex', `expected not_amex, got ${parsed.parse_status}`)
  console.log('NOT-AMEX OK\n')
}

// ---------- Test 4: "more than $1.00" noise filter ----------
{
  const html = '<div style="color:#006fcf"><p>TEST MERCHANT</p></div>'
    + '<p>Account Ending: 53240</p>'
    + '<p>You know this purchase was more than $1.00</p>'
    + '<p>€100.00*</p>'
    + '<p>Thu, Aug 20, 2026</p>'
  const parsed = parseCloudMailin(
    { html, plain: '', headers: {}, envelope: {} },
    { receivedAtUtc: '2026-08-21T00:00:00Z', from: 'AmericanExpress@welcome.americanexpress.com', subject: 'Large Purchase Approved', messageId: 'noise-1', plainSnippet: '' },
  )
  console.log('=== Noise filter ===')
  console.log(parsed)
  assert(parsed.local_amount === '100.00', `expected 100.00, got ${parsed.local_amount}`)
  assert(parsed.local_currency === 'EUR', `expected EUR, got ${parsed.local_currency}`)
  console.log('NOISE OK\n')
}

console.log('All tests passed.')
