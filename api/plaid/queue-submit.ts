// POST /api/plaid/queue-submit — admin only.
// Submits filled Plaid-queue cards to the Expenses sheet by delegating to
// the existing expense-submit handler (invoked in-process). On success we
// mark each Plaid_Transactions row as 'submitted'.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from '../_plaid.js'
import { findRowByTxnId, readAllPlaidTxns, updatePlaidTxnStatus } from '../_plaid-txns.js'
import expenseSubmitHandler, { SubmitExpense } from '../expense-submit.js'

export const config = { maxDuration: 60 }

type Submission = SubmitExpense & { txn_id: string; driveFileId?: string; driveViewUrl?: string }

// Minimal mock req/res so we can call expense-submit's default export in-process.
function invokeExpenseSubmit(expenses: SubmitExpense[]): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const fakeReq: any = { method: 'POST', body: { expenses } }
    let statusCode = 200
    const fakeRes: any = {
      status(code: number) { statusCode = code; return this },
      json(body: any) { resolve({ status: statusCode, body }) },
      setHeader() { return this },
      end() { resolve({ status: statusCode, body: {} }) },
    }
    // fire & forget — resolver above completes the promise
    Promise.resolve(expenseSubmitHandler(fakeReq, fakeRes as any)).catch((err: any) => {
      resolve({ status: 500, body: { error: err?.message || String(err) } })
    })
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAdmin(req, res)) return
  const body = req.body as { submissions?: Submission[] }
  const subs = Array.isArray(body?.submissions) ? body!.submissions! : []
  if (subs.length === 0) return res.status(400).json({ error: 'submissions[] required' })
  if (subs.length > 100) return res.status(400).json({ error: 'Max 100 submissions per request' })

  try {
    // Server-side dedupe: read current Plaid_Transactions rows once and drop
    // any submission whose txn is already marked 'submitted'. This is the
    // definitive fix for the duplicate-in-Expenses bug when a bulk-submit
    // and an auto-drain race on the same txn_id. Duplicates are returned as
    // ok:true, duplicate:true so the client still removes them from the queue.
    const allTxns = await readAllPlaidTxns()
    const statusByTxn = new Map(allTxns.map(r => [r.txn_id, r.queue_status]))
    const dupResults: Array<{ txn_id: string; ok: boolean; row?: number; duplicate?: boolean; error?: string }> = []
    const subsFresh: Submission[] = []
    for (const s of subs) {
      const prev = statusByTxn.get(s.txn_id)
      if (prev === 'submitted') {
        dupResults.push({ txn_id: s.txn_id, ok: true, duplicate: true })
      } else {
        subsFresh.push(s)
      }
    }
    if (subsFresh.length === 0) {
      return res.status(200).json({ ok: true, results: dupResults, duplicates: dupResults.length })
    }
    // Attach crosscheck (matched:<txn_id>) so the Expenses sheet's audit col S captures the link.
    const expenses: SubmitExpense[] = subsFresh.map(s => ({
      date: s.date,
      account: s.account,
      project: s.project,
      expenseType: s.expenseType,
      category: s.category,
      guestTrip: s.guestTrip,
      store: s.store,
      usd: s.usd,
      eur: s.eur,
      refunded: s.refunded,
      description: s.description,
      specificRepair: s.specificRepair,
      statement: s.statement,
      inputBy: s.inputBy,
      receiptUrl: s.receiptUrl || s.driveViewUrl || '',
      crosscheck: `matched:${s.txn_id}`,
    }))

    const inner = await invokeExpenseSubmit(expenses)
    if (inner.status !== 200) {
      return res.status(inner.status).json({ ok: false, error: inner.body?.error || 'expense-submit failed', detail: inner.body })
    }
    const inserted: Array<{ row: number; receiptUrl?: string }> = inner.body?.inserted || []
    const innerErrors: Array<{ index: number; error: string }> = inner.body?.errors || []

    const nowIso = new Date().toISOString()
    const results: Array<{ txn_id: string; ok: boolean; error?: string; row?: number; duplicate?: boolean }> = []
    for (let i = 0; i < subsFresh.length; i++) {
      const s = subsFresh[i]
      const errHit = innerErrors.find(e => e.index === i)
      if (errHit) {
        results.push({ txn_id: s.txn_id, ok: false, error: errHit.error })
        continue
      }
      const row = inserted[i]?.row
      try {
        const txnRow = await findRowByTxnId(s.txn_id)
        if (txnRow) await updatePlaidTxnStatus(txnRow, 'submitted', nowIso)
      } catch (e: any) {
        console.warn('queue-submit: could not mark txn', s.txn_id, 'submitted:', e?.message)
      }
      results.push({ txn_id: s.txn_id, ok: true, row })
    }
    // Merge in the duplicates (already-submitted rows) so the client removes them.
    const merged = [...results, ...dupResults]
    return res.status(200).json({
      ok: merged.every(r => r.ok),
      results: merged,
      duplicates: dupResults.length,
      spreadsheetUrl: inner.body?.spreadsheetUrl,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
