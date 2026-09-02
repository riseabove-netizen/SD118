import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isAdmin, getToken, getCrewName } from '@/lib/auth'

type UnloadedTxn = {
  plaid_txn_id: string
  account_label: string
  account_mask: string
  date: string
  amount_usd: number
  currency: string
  merchant: string
  name: string
}

type CategoryTree = Map<string, string[]>  // expenseType -> subcategories
type ProjectTree = Map<string, string[]>   // project -> expenseTypes

function adminHeaders(): Record<string, string> {
  const token = getToken() || ''
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

type RowEdit = {
  project: string
  expenseType: string
  category: string
  description: string
  selected: boolean
  submitting?: boolean
  submitted?: boolean
  error?: string
  submittedRow?: number
}

export function PlaidUnloadedPage() {
  const [days, setDays] = useState(45)
  const [txns, setTxns] = useState<UnloadedTxn[]>([])
  const [edits, setEdits] = useState<Record<string, RowEdit>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projectTree, setProjectTree] = useState<ProjectTree>(new Map())
  const [categoryTree, setCategoryTree] = useState<CategoryTree>(new Map())

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [defs, unloaded] = await Promise.all([
        fetch('/api/expense-definitions', { headers: adminHeaders() }),
        fetch(`/api/plaid/unloaded?days=${days}`, { headers: adminHeaders() }),
      ])
      const dj = await defs.json()
      const uj = await unloaded.json()
      if (!defs.ok) throw new Error(dj?.error || `HTTP ${defs.status} on definitions`)
      if (!unloaded.ok) throw new Error(uj?.error || `HTTP ${unloaded.status} on unloaded`)
      // definitions format: {ok, rows: [{project, category, subcategory, showToUser}]}
      const pt: ProjectTree = new Map()
      const ct: CategoryTree = new Map()
      for (const row of (dj?.rows || []) as Array<{project: string; category: string; subcategory: string}>) {
        if (!pt.has(row.project)) pt.set(row.project, [])
        if (!pt.get(row.project)!.includes(row.category)) pt.get(row.project)!.push(row.category)
        if (!ct.has(row.category)) ct.set(row.category, [])
        if (!ct.get(row.category)!.includes(row.subcategory)) ct.get(row.category)!.push(row.subcategory)
      }
      setProjectTree(pt); setCategoryTree(ct)
      setTxns(uj.unloaded || [])
      // Seed edits map preserving existing state where possible
      setEdits(prev => {
        const next: Record<string, RowEdit> = {}
        for (const t of (uj.unloaded || [])) {
          next[t.plaid_txn_id] = prev[t.plaid_txn_id] || {
            project: '', expenseType: '', category: '',
            description: t.merchant || t.name || '',
            selected: false,
          }
        }
        return next
      })
    } catch (e: any) { setError(e?.message || String(e)) }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const patch = (id: string, p: Partial<RowEdit>) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...p } }))
  }

  const insertOne = async (t: UnloadedTxn) => {
    const e = edits[t.plaid_txn_id]
    if (!e) return
    patch(t.plaid_txn_id, { submitting: true, error: undefined })
    try {
      const payload = {
        expenses: [{
          date: t.date,
          account: t.account_label,
          project: e.project || 'Operating',
          expenseType: e.expenseType,
          category: e.category,
          guestTrip: '',
          store: t.merchant || t.name || '',
          usd: t.amount_usd,
          eur: null,
          refunded: '',
          description: e.description,
          specificRepair: '',
          statement: '',
          inputBy: getCrewName() || 'Admin (Plaid intake)',
          receiptUrl: '',
          crosscheck: `matched:${t.plaid_txn_id}`,
        }],
      }
      const r = await fetch('/api/expense-submit', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok || !j?.ok) {
        const err = j?.errors?.[0]?.error || j?.error || `HTTP ${r.status}`
        throw new Error(err)
      }
      patch(t.plaid_txn_id, { submitting: false, submitted: true, submittedRow: j.inserted?.[0]?.row })
    } catch (err: any) {
      patch(t.plaid_txn_id, { submitting: false, error: err?.message || String(err) })
    }
  }

  const insertSelected = async () => {
    const selected = txns.filter(t => edits[t.plaid_txn_id]?.selected && !edits[t.plaid_txn_id]?.submitted)
    for (const t of selected) {
      // eslint-disable-next-line no-await-in-loop
      await insertOne(t)
    }
  }

  const projects = useMemo(() => Array.from(projectTree.keys()), [projectTree])

  if (!isAdmin()) {
    return (
      <MenuLayout title="Plaid intake" showBack backHref="/menu">
        <div className="text-red-400">Admin only.</div>
      </MenuLayout>
    )
  }

  return (
    <MenuLayout title="Plaid intake — unloaded" showBack backHref="/menu">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-400">Last</label>
          <Input
            type="number" min={1} max={180} value={days}
            onChange={e => setDays(Math.max(1, Math.min(180, parseInt(e.target.value || '45', 10) || 45)))}
            className="w-24"
          />
          <span className="text-sm text-neutral-400">days</span>
          <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
          <Button onClick={insertSelected} variant="default">Insert selected</Button>
        </div>

        {error && <div className="text-red-400 text-sm whitespace-pre-wrap">{error}</div>}

        <div className="text-sm text-neutral-500">
          {txns.length} unloaded Plaid transaction{txns.length === 1 ? '' : 's'}
        </div>

        <div className="space-y-2">
          {txns.map(t => {
            const e = edits[t.plaid_txn_id] || { project: '', expenseType: '', category: '', description: '', selected: false }
            const subcats = categoryTree.get(e.expenseType) || []
            const cats = projectTree.get(e.project) || Array.from(new Set(Array.from(categoryTree.keys())))
            return (
              <div key={t.plaid_txn_id} className={`border rounded p-2 text-sm ${e.submitted ? 'border-green-800 bg-green-950/30' : 'border-neutral-800 bg-neutral-950'}`}>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox" checked={!!e.selected}
                    disabled={e.submitted}
                    onChange={ev => patch(t.plaid_txn_id, { selected: ev.target.checked })}
                    className="mt-2"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-semibold">{t.merchant || t.name}</span>
                        <span className="text-neutral-500 ml-2">${t.amount_usd.toFixed(2)}</span>
                        <span className="text-neutral-500 ml-2">{t.date}</span>
                        <span className="text-neutral-500 ml-2">{t.account_label}</span>
                      </div>
                      <div className="text-xs text-neutral-600">{t.plaid_txn_id.slice(-8)}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                      <select
                        value={e.project} onChange={ev => patch(t.plaid_txn_id, { project: ev.target.value, expenseType: '', category: '' })}
                        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                        disabled={e.submitted}
                      >
                        <option value="">Project…</option>
                        {projects.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <select
                        value={e.expenseType} onChange={ev => patch(t.plaid_txn_id, { expenseType: ev.target.value, category: '' })}
                        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                        disabled={e.submitted}
                      >
                        <option value="">Category…</option>
                        {cats.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        value={e.category} onChange={ev => patch(t.plaid_txn_id, { category: ev.target.value })}
                        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                        disabled={e.submitted}
                      >
                        <option value="">Subcategory…</option>
                        {subcats.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <Button size="sm"
                        onClick={() => insertOne(t)}
                        disabled={e.submitted || e.submitting}
                      >
                        {e.submitted ? `Row ${e.submittedRow || '✓'}` : e.submitting ? '…' : 'Insert (no cat OK)'}
                      </Button>
                    </div>

                    <Input
                      value={e.description} onChange={ev => patch(t.plaid_txn_id, { description: ev.target.value })}
                      className="mt-2" placeholder="Description"
                      disabled={e.submitted}
                    />
                    {e.error && <div className="text-red-400 text-xs mt-1">{e.error}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </MenuLayout>
  )
}
