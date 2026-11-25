// GET /api/plaid/queue-list — admin only.
// Returns pending Plaid transactions for the admin queue, newest first.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from '../_plaid.js'
import { readAllPlaidTxns, maskToQueueLabel } from '../_plaid-txns.js'
import { sheetsAuth, SPREADSHEET_ID } from '../_plaid.js'
import { google } from 'googleapis'

// Bilt only emails transaction alerts to the cardholder who made the
// charge. Gabriel's inbox forwards those alerts into the Bilt_Emails tab,
// so a Bilt (0540) charge with NO matching alert email is almost always
// one of Enrico's authorized-user cards. Alerts were first captured on
// this date; older charges can't be judged this way.
const BILT_EMAILS_START = '2026-08-24'
const letters = (m: string) => (m || '').toLowerCase().replace(/[^a-z]+/g, '')
function merchantsMatch(a: string, b: string): boolean {
  const x = letters(a), y = letters(b)
  if (!x || !y) return false
  return x.slice(0, 6) === y.slice(0, 6) || x.includes(y) || y.includes(x)
}
function dayDiff(a: string, b: string): number {
  return Math.abs((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000)
}
async function readBiltAlertEmails(): Promise<Array<{ date: string; merchant: string }>> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: sheetsAuth(false) })
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Bilt_Emails!A2:F' })
    return (resp.data.values || [])
      .map(r => ({ date: String(r[4] ?? '').slice(0, 10), merchant: String(r[5] ?? '') }))
      .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.merchant)
  } catch {
    return [] // if the tab can't be read, fall back to merchant learning only
  }
}


export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  try {
    const [all, biltEmails] = await Promise.all([readAllPlaidTxns(), readBiltAlertEmails()])
    // Plaid's Bilt feed merges every cardholder (Gabriel + Enrico's
    // authorized-user cards) into ONE account (mask 0540) and returns no
    // account_owner, so there is no Plaid field that separates them.
    // Instead we learn from the admin: any merchant the admin has marked
    // as Enrico's ('enrico' status) flags future Bilt charges from the
    // same merchant as "Likely Enrico" so they are held back from
    // auto-submit until the admin decides.
    const norm = (m: string) => (m || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const enricoMerchants = new Set(
      all.filter(r => r.queue_status === 'enrico' && r.account_mask === '0540').map(r => norm(r.merchant)).filter(Boolean),
    )
    // Plaid's posted date is usually 0–2 days after the alert email.
    const hasBiltEmail = (date: string, merchant: string) =>
      biltEmails.some(e => dayDiff(e.date, date) <= 3 && merchantsMatch(e.merchant, merchant))
    const noEmailCheck = (r: { account_mask: string; date: string; amount_usd: number; merchant: string }) =>
      biltEmails.length > 0 &&
      r.account_mask === '0540' &&
      r.date >= BILT_EMAILS_START &&
      r.amount_usd > 0 &&
      !/^(bilt|payment)/i.test(r.merchant) &&
      !hasBiltEmail(r.date, r.merchant)
    const pending = all
      .filter(r => r.queue_status === 'pending')
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map(r => {
        // Email-sourced Bilt rows come from Gabriel's own alert emails, so they are never Enrico's.
        const fromEmail = r.txn_id.startsWith('bilt-email:')
        const byMerchant = !fromEmail && r.account_mask === '0540' && enricoMerchants.has(norm(r.merchant))
        const byNoEmail = !fromEmail && !byMerchant && noEmailCheck(r)
        return {
        row: r.rowIndex,
        txn_id: r.txn_id,
        date: r.date,
        merchant: r.merchant,
        amount_usd: r.amount_usd,
        account: r.account,
        account_mask: r.account_mask,
        account_queue_label: maskToQueueLabel(r.account_mask),
        category: r.category,
        currency: r.currency,
        source: fromEmail ? 'bilt_email' : 'plaid',
        likely_enrico: byMerchant || byNoEmail,
        enrico_reason: byMerchant ? 'merchant' : byNoEmail ? 'no_email' : '',
      }})
    return res.status(200).json({ ok: true, pending, count: pending.length })
  } catch (e: any) {
    const msg = e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}
