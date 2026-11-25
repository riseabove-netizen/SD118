// POST /api/plaid/bilt-email-backfill  { since?: 'YYYY-MM-DD', retire_plaid_pending?: boolean, dry_run?: boolean }
// Admin-only. Re-parses every archived Bilt alert (Bilt_Emails_Raw) with the
// current parser, fills in amounts the old parser missed on Bilt_Emails, and
// queues alerts on/after `since` that are not already on Expenses.
// retire_plaid_pending: marks still-pending Plaid-sourced Bilt rows as
// 'replaced_by_email' (Bilt now comes from email alerts only).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { requireAdmin, sheetsAuth, SPREADSHEET_ID } from '../_plaid.js'
import { parseBiltCloudMailin } from '../amex-webhook.js'
import { queueBiltAlerts, type BiltAlert } from '../_bilt-email-queue.js'
import { readAllPlaidTxns, updatePlaidTxnStatus } from '../_plaid-txns.js'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  try {
    const body = (req.body || {}) as { since?: string; retire_plaid_pending?: boolean; dry_run?: boolean }
    const since = body.since || '2026-11-01'
    const sheets = google.sheets({ version: 'v4', auth: sheetsAuth(true) })
    const [rawResp, parsedResp] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Bilt_Emails_Raw!A2:F' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Bilt_Emails!A2:P' }),
    ])
    const parsedRows = parsedResp.data.values || []
    const rowByMsg = new Map<string, number>()
    parsedRows.forEach((r, i) => rowByMsg.set(String(r[0] || ''), i + 2))

    const alerts: BiltAlert[] = []
    const fixes: Array<{ range: string; values: any[][] }> = []
    for (const r of rawResp.data.values || []) {
      let payload: any
      try { payload = JSON.parse(String(r[5] || '')) } catch { continue }
      const p = parseBiltCloudMailin(payload, {
        receivedAtUtc: String(r[0] || ''), from: String(r[1] || ''), subject: String(r[2] || ''),
        messageId: String(r[3] || ''), plainSnippet: '',
      })
      if (p.parse_status === 'not_bilt') continue
      const row = rowByMsg.get(p.message_id)
      if (row && p.parse_status === 'ok') {
        const cur = parsedRows[row - 2]
        if (!cur[6] || cur[14] !== 'ok') {
          fixes.push({ range: `Bilt_Emails!G${row}:H${row}`, values: [[p.local_amount, p.local_currency]] })
          fixes.push({ range: `Bilt_Emails!K${row}`, values: [[p.usd_amount]] })
          fixes.push({ range: `Bilt_Emails!O${row}:P${row}`, values: [['ok', 'reparsed']] })
        }
      }
      if (p.parse_status === 'ok' && p.txn_date >= since) {
        alerts.push({ message_id: p.message_id, txn_date: p.txn_date, merchant: p.merchant, usd_amount: p.usd_amount })
      }
    }
    if (body.dry_run) return res.status(200).json({ ok: true, dry_run: true, fixes: fixes.length / 3, alerts })

    for (let i = 0; i < fixes.length; i += 90) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'RAW', data: fixes.slice(i, i + 90) },
      })
    }
    const results = await queueBiltAlerts(alerts)

    let retired = 0
    if (body.retire_plaid_pending) {
      const txns = await readAllPlaidTxns()
      for (const t of txns) {
        if (t.account_mask === '0540' && t.queue_status === 'pending' && !t.txn_id.startsWith('bilt-email:')) {
          await updatePlaidTxnStatus(t.rowIndex, 'replaced_by_email', new Date().toISOString())
          retired++
        }
      }
    }
    return res.status(200).json({
      ok: true, fixed: fixes.length / 3, retired,
      results: results.map((r, i) => ({ ...r, ...alerts[i] })),
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
