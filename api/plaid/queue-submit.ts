// POST /api/plaid/queue-submit — admin only.
// Submits filled Plaid-queue cards to the Expenses sheet by delegating to
// the existing expense-submit handler (invoked in-process). On success we
// mark each Plaid_Transactions row as 'submitted'.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin } from '../_plaid.js'
import { findRowByTxnId, updatePlaidTxnStatus } from '../_plaid-txns.js'
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
    // Attach crosscheck (matched:<txn_id>) so the Expenses sheet's audit col S captures the link.
    const expenses: SubmitExpense[] = subs.map(s => ({
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
    const results: Array<{ txn_id: string; ok: boolean; error?: string; row?: number }> = []
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i]
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

    return res.status(200).json({ ok: results.every(r => r.ok), results, spreadsheetUrl: inner.body?.spreadsheetUrl })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
