// Expense intake — role-split.
//
// Admin sees a hub with three surfaces:
//   1. Plaid queue      — daily-pulled card charges awaiting categorisation.
//   2. Orphan receipts  — OCR'd receipts that never matched a Plaid charge.
//   3. Scan (my own)    — same scan flow crews use, for admin-owned expenses.
//
// Crew sees the scan flow only. On scan: compress → Drive upload → OCR →
// try to match against the Plaid backlog. If no match, automatically trigger a
// crew-scoped 14-day Plaid sync and re-match. Still no match → orphan queue.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'
import { getCrewName, getRole, canWrite, getToken } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import { useLocation } from 'wouter'

type Account = 'Amex 3240' | 'Bilt'

type Trip = {
  name: string
  start_date: string  // '' or YYYY-MM-DD, inclusive
  end_date: string    // '' or YYYY-MM-DD, inclusive
  active: boolean
}

type DefRow = {
  project: string
  category: string
  subcategory: string
  showToUser: boolean
  chrissy?: string
}

type ReceiptRead = {
  merchant: string | null
  date: string | null
  eur: number | null
  usd: number | null
  currency_hint: 'EUR' | 'USD' | 'OTHER' | null
  category_hint: 'grocery' | 'fuel' | 'restaurant' | 'hardware' | 'pharmacy' | 'other' | null
  notes: string | null
}

type PlaidMatch = {
  plaid_txn_id?: string
  txn_id: string
  date: string
  merchant: string
  amount_usd: number
  currency: string
  category: string
  account_mask: string
  account_label: string
  account_matches_selection: boolean
  source?: 'cache' | 'live'
  // True when this Plaid txn was already categorized by admin. Crew flow
  // shows a 'already logged' state and does NOT create a duplicate expense.
  already_submitted?: boolean
  submitted_at?: string
} | null

type Photo = {
  id: string
  base64: string
  thumbDataUrl: string
  file?: File
  driveFileId?: string
  driveViewUrl?: string
  driveThumbUrl?: string
  read?: ReceiptRead
  plaidMatch?: PlaidMatch
  date: string
  merchant: string
  eur: string
  usd: string
  guestTrip: boolean
  guestTripName: string
  project: string
  expenseType: string
  category: string
  description: string
  refunded: string
  specificRepair: string
  statement: string
  uploading?: boolean
  uploadError?: string
  reading?: boolean
  syncing?: boolean          // auto-sync fallback in progress
  submitting?: boolean
  submitted?: boolean
  submitError?: string
  submittedRow?: number
  submittedAs?: 'matched' | 'orphan' | 'duplicate'
}

type PendingQueueTxn = {
  row: number
  txn_id: string
  date: string
  merchant: string
  amount_usd: number
  account: string
  account_mask: string
  account_queue_label: string
  category: string
  currency: string
}

type OrphanRow = {
  row: number
  id: string
  added_at: string
  receipt_url: string
  receipt_thumb_url: string
  ocr_merchant: string
  ocr_date: string
  ocr_eur: number | null
  ocr_usd: number | null
  added_by: string
  status: string
}

// Editable card state shared between Plaid-queue and Orphan-queue admin views.
type CardEdit = {
  // identity
  key: string           // txn_id for plaid, orphan.id for orphan
  source: 'plaid' | 'orphan'
  // pre-fill from source
  origDate: string
  origMerchant: string
  origUsd: number | null
  origEur: number | null
  account: Account
  receiptUrl?: string
  receiptThumbUrl?: string
  // editable fields
  date: string
  merchant: string
  usd: string
  eur: string
  project: string
  expenseType: string
  category: string
  guestTrip: boolean
  guestTripName: string
  description: string
  // optional receipt upload (Plaid queue admin can attach a photo they just took)
  photoBase64?: string
  photoThumb?: string
  uploading?: boolean
  uploadError?: string
  selectedForSkip: boolean
  // Marked for admin bulk edit: apply the same category/subcategory/project/guest-trip
  // to every card with this flag. Independent from selectedForSkip.
  selectedForBulk?: boolean
  submitting?: boolean
  submitted?: boolean
  submitError?: string
  submittedRow?: number
}

function newPhotoId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function autoClassify(
  category_hint: ReceiptRead['category_hint'],
  isGuestTrip: boolean,
): { project: string; expenseType: string; category: string } | null {
  if (!category_hint) return null
  if (category_hint === 'grocery') {
    return isGuestTrip
      ? { project: 'Operating', expenseType: 'Guest trip', category: 'Provisions / Guest meals' }
      : { project: 'Operating', expenseType: 'Recurrent', category: 'Boat provisions' }
  }
  if (category_hint === 'fuel') {
    return isGuestTrip
      ? { project: 'Operating', expenseType: 'Guest trip', category: 'Fuel' }
      : { project: 'Operating', expenseType: 'Recurrent', category: 'Automobile Fuel' }
  }
  if (category_hint === 'restaurant') {
    return isGuestTrip
      ? { project: 'Operating', expenseType: 'Guest trip', category: 'Provisions / Guest meals' }
      : { project: 'Operating', expenseType: 'Recurrent', category: 'Crew Meals' }
  }
  if (category_hint === 'hardware') {
    return { project: 'Operating', expenseType: 'Repairs', category: 'Tools / Hardware' }
  }
  if (category_hint === 'pharmacy') {
    return { project: 'Operating', expenseType: 'Recurrent', category: 'Medicine / Pharmacy' }
  }
  return null
}

function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...init, headers, credentials: 'include' })
}

// ══════════════════════════════════════════════════════════════════════
// Top-level page
// ══════════════════════════════════════════════════════════════════════
export function ExpenseIntakePage() {
  const role = getRole()
  const isAdmin = role === 'admin'

  if (!canWrite()) {
    return (
      <MenuLayout title="Expense intake" showBack backHref="/menu">
        <p className="text-sm text-muted-foreground">You need crew or admin access to file expenses.</p>
      </MenuLayout>
    )
  }

  if (isAdmin) return <AdminIntake />
  return <CrewIntake />
}

export default ExpenseIntakePage

// ══════════════════════════════════════════════════════════════════════
// Admin — hub + Plaid queue + Orphan queue + Scan (my own)
// ══════════════════════════════════════════════════════════════════════
type AdminView = 'hub' | 'plaid' | 'orphan' | 'scan' | 'oneoff'

function AdminIntake() {
  const [view, setView] = useState<AdminView>('hub')
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [orphanCount, setOrphanCount] = useState<number | null>(null)
  const [countsError, setCountsError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const syncFromPlaid = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      const resp = await authFetch('/api/plaid/cron-pull', { method: 'POST', body: JSON.stringify({}) })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || 'Sync failed')
      const added = data.new ?? data.added ?? 0
      const pulled = data.pulled ?? 0
      setSyncMsg(added > 0
        ? `Synced — ${added} new charge${added === 1 ? '' : 's'} added (${pulled} scanned).`
        : `Synced — no new charges (${pulled} scanned).`)
      await loadCounts()
    } catch (err: any) {
      setSyncMsg(`Sync failed: ${err?.message || String(err)}`)
    } finally {
      setSyncing(false)
    }
  }

  const loadCounts = async () => {
    setCountsError(null)
    try {
      const [q, o] = await Promise.all([
        authFetch('/api/plaid/queue-list').then(r => r.json()),
        authFetch('/api/expenses/orphan-list').then(r => r.json()),
      ])
      if (q?.ok) setPendingCount(q.count)
      if (o?.ok) setOrphanCount(o.count)
      if (!q?.ok) setCountsError(q?.error || 'Queue load failed')
      if (!o?.ok && q?.ok) setCountsError(o?.error || 'Orphan load failed')
    } catch (err: any) {
      setCountsError(err?.message || String(err))
    }
  }

  useEffect(() => { loadCounts() }, [view])

  if (view === 'plaid') return <AdminPlaidQueue onBack={() => setView('hub')} />
  if (view === 'orphan') return <AdminOrphanQueue onBack={() => setView('hub')} />
  if (view === 'scan') return <CrewIntake adminScanBack={() => setView('hub')} />
  if (view === 'oneoff') return <AdminOneOff onBack={() => setView('hub')} />

  return (
    <MenuLayout title="Expense intake" showBack backHref="/menu">
      <div className="space-y-3">
        {countsError && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm p-3">
            {countsError}
          </div>
        )}
        <button
          onClick={() => setView('plaid')}
          className="w-full h-16 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-left px-4 flex items-center justify-between"
        >
          <div>
            <div className="font-semibold">Plaid queue</div>
            <div className="text-xs text-neutral-400">Categorise daily card charges</div>
          </div>
          <div className="text-red-500 font-bold text-lg">
            {pendingCount ?? '…'} →
          </div>
        </button>
        <button
          onClick={() => setView('orphan')}
          className="w-full h-16 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-left px-4 flex items-center justify-between"
        >
          <div>
            <div className="font-semibold">Orphan receipts</div>
            <div className="text-xs text-neutral-400">Receipts with no Plaid match</div>
          </div>
          <div className="text-red-500 font-bold text-lg">
            {orphanCount ?? '…'} →
          </div>
        </button>
        <button
          onClick={() => setView('scan')}
          className="w-full h-16 rounded-xl border border-neutral-800 bg-red-600 hover:bg-red-700 text-white text-left px-4 flex items-center gap-3"
        >
          <span className="text-2xl">📷</span>
          <div>
            <div className="font-semibold">Scan receipt (my own)</div>
            <div className="text-xs opacity-80">Same flow crew uses</div>
          </div>
        </button>
        <button
          onClick={() => setView('oneoff')}
          className="w-full h-16 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-left px-4 flex items-center gap-3"
        >
          <span className="text-2xl">➕</span>
          <div>
            <div className="font-semibold">One-off expense</div>
            <div className="text-xs text-neutral-400">Any account — Gabe’s Visa, Wise, Cash…</div>
          </div>
        </button>

        <button
          onClick={syncFromPlaid}
          disabled={syncing}
          className="w-full h-12 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-wait text-neutral-200 text-left px-4 flex items-center gap-3"
        >
          <span className={`text-lg ${syncing ? 'animate-spin' : ''}`}>↻</span>
          <div className="flex-1">
            <div className="font-semibold text-sm">{syncing ? 'Syncing with credit card company…' : 'Sync from Plaid now'}</div>
            <div className="text-xs text-neutral-400">Pull latest charges without waiting for daily cron</div>
          </div>
        </button>
        {syncMsg && (
          <div className={`text-xs px-3 py-2 rounded-lg border ${syncMsg.startsWith('Sync failed') ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-neutral-800 bg-neutral-900 text-neutral-300'}`}>
            {syncMsg}
          </div>
        )}
      </div>
    </MenuLayout>
  )
}

// ── Shared definitions loader ────────────────────────────────────────
function useDefinitions() {
  const [definitions, setDefinitions] = useState<DefRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/expense-definitions')
      .then(r => r.json())
      .then((data) => {
        if (cancelled) return
        if (!data?.ok) throw new Error(data?.error || 'Failed to load definitions')
        setDefinitions(data.rows as DefRow[])
      })
      .catch(err => { if (!cancelled) setError(err?.message || String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { definitions, loading, error }
}

function useCategoryTree(defs: DefRow[], isAdmin: boolean) {
  return useMemo(() => {
    const visible = isAdmin ? defs.filter(r => r.project === 'Operating') : defs.filter(r => r.showToUser)
    const tree = new Map<string, string[]>()
    for (const r of visible) {
      if (!tree.has(r.category)) tree.set(r.category, [])
      const arr = tree.get(r.category)!
      if (!arr.includes(r.subcategory)) arr.push(r.subcategory)
    }
    return tree
  }, [defs, isAdmin])
}

// ══════════════════════════════════════════════════════════════════════
// Admin — Plaid queue
// ══════════════════════════════════════════════════════════════════════
function AdminPlaidQueue({ onBack }: { onBack: () => void }) {
  const [txns, setTxns] = useState<PendingQueueTxn[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cards, setCards] = useState<Record<string, CardEdit>>({})
  const { definitions, error: defsError } = useDefinitions()
  const catTree = useCategoryTree(definitions, true)
  const crewName = getCrewName() || 'Admin'
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [submittingBatch, setSubmittingBatch] = useState(false)
  const [skippingBatch, setSkippingBatch] = useState(false)
  // Bulk-edit state (admin selects several rows, picks one category, applies to all)
  const [bulkExpenseType, setBulkExpenseType] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkGuestTrip, setBulkGuestTrip] = useState<'none' | 'no' | 'yes'>('none')
  // Bulk-edit trip: '' means unchanged, '__auto__' means pre-fill each card from its date, '__none__' means clear.
  const [bulkTrip, setBulkTrip] = useState<string>('')
  const [trips, setTrips] = useState<Trip[]>([])
  const [showCreateTrip, setShowCreateTrip] = useState(false)
  const [creatingTrip, setCreatingTrip] = useState(false)
  const [newTripName, setNewTripName] = useState('')
  const [newTripStart, setNewTripStart] = useState('')
  const [newTripEnd, setNewTripEnd] = useState('')
  const [newTripError, setNewTripError] = useState<string | null>(null)

  const loadTrips = async () => {
    try {
      const r = await authFetch('/api/expenses/trips')
      const d = await r.json()
      if (d?.ok) setTrips(d.trips || [])
    } catch {
      // Non-fatal — dropdown will just show the current selection with no options.
    }
  }
  useEffect(() => { loadTrips() }, [])

  const tripForDate = (isoDate: string): string => {
    if (!isoDate) return ''
    const active = trips.filter(t => t.active !== false)
    // Prefer the most-recent-start trip whose window contains the date.
    const matches = active.filter(t => {
      if (t.start_date && isoDate < t.start_date) return false
      if (t.end_date && isoDate > t.end_date) return false
      return true
    })
    matches.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    return matches[0]?.name || ''
  }

  const createTrip = async () => {
    setNewTripError(null)
    const name = newTripName.trim()
    if (!name) { setNewTripError('Name is required'); return }
    setCreatingTrip(true)
    try {
      const r = await authFetch('/api/expenses/trips', {
        method: 'POST',
        body: JSON.stringify({ name, start_date: newTripStart, end_date: newTripEnd }),
      })
      const d = await r.json()
      if (!d?.ok) throw new Error(d?.error || 'create failed')
      setTrips(prev => [...prev, d.trip])
      setBulkTrip(d.trip.name)
      setNewTripName(''); setNewTripStart(''); setNewTripEnd('')
      setShowCreateTrip(false)
    } catch (err: any) {
      setNewTripError(err?.message || String(err))
    } finally {
      setCreatingTrip(false)
    }
  }

  const load = async () => {
    setLoading(true); setLoadError(null)
    try {
      const r = await authFetch('/api/plaid/queue-list')
      const d = await r.json()
      if (!d?.ok) throw new Error(d?.error || 'load failed')
      setTxns(d.pending || [])
      // Initialise editable cards for any new txn (preserve existing edits).
      setCards(prev => {
        const next: Record<string, CardEdit> = { ...prev }
        for (const t of d.pending || []) {
          if (!next[t.txn_id]) {
            const account: Account = t.account_mask === '0540' ? 'Bilt' : 'Amex 3240'
            next[t.txn_id] = {
              key: t.txn_id,
              source: 'plaid',
              origDate: t.date,
              origMerchant: t.merchant,
              origUsd: t.amount_usd,
              origEur: null,
              account,
              date: t.date,
              merchant: t.merchant,
              usd: String(t.amount_usd ?? ''),
              eur: '',
              project: 'Operating',
              expenseType: '',
              category: '',
              guestTrip: false,
              guestTripName: '',
              description: '',
              selectedForSkip: false,
            }
          }
        }
        return next
      })
    } catch (err: any) {
      setLoadError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const setCard = (key: string, patch: Partial<CardEdit>) => {
    setCards(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const bulkSelectedIds = useMemo(
    () => txns.filter(t => cards[t.txn_id]?.selectedForBulk).map(t => t.txn_id),
    [txns, cards],
  )
  const applyBulk = () => {
    if (bulkSelectedIds.length === 0) return
    setCards(prev => {
      const next = { ...prev }
      for (const id of bulkSelectedIds) {
        if (!next[id]) continue
        const patch: Partial<CardEdit> = {}
        if (bulkExpenseType) {
          patch.expenseType = bulkExpenseType
          // Clear subcategory when the category changes, unless we're also setting it
          patch.category = bulkCategory || ''
        } else if (bulkCategory) {
          patch.category = bulkCategory
        }
        if (bulkGuestTrip === 'yes') {
          patch.guestTrip = true
          if (!bulkExpenseType) patch.expenseType = 'Guest trip'
        } else if (bulkGuestTrip === 'no') {
          patch.guestTrip = false
          patch.guestTripName = ''
        }
        // Trip name: '' = leave unchanged, '__auto__' = date-lookup per card,
        // '__none__' = clear, anything else = literal name.
        if (bulkTrip === '__auto__') {
          const auto = tripForDate(next[id].date)
          if (auto) {
            patch.guestTripName = auto
            patch.guestTrip = true
            if (!patch.expenseType && !next[id].expenseType) patch.expenseType = 'Guest trip'
          }
        } else if (bulkTrip === '__none__') {
          patch.guestTripName = ''
        } else if (bulkTrip) {
          patch.guestTripName = bulkTrip
          patch.guestTrip = true
          if (!patch.expenseType && !next[id].expenseType) patch.expenseType = 'Guest trip'
        }
        next[id] = { ...next[id], ...patch }
      }
      return next
    })
  }
  const clearBulkSelection = () => {
    setCards(prev => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (next[id].selectedForBulk) next[id] = { ...next[id], selectedForBulk: false }
      }
      return next
    })
  }
  const selectAllForBulk = () => {
    setCards(prev => {
      const next = { ...prev }
      for (const t of txns) {
        if (next[t.txn_id] && !next[t.txn_id].selectedForSkip) {
          next[t.txn_id] = { ...next[t.txn_id], selectedForBulk: true }
        }
      }
      return next
    })
  }

  const attachReceipt = async (card: CardEdit, file: File) => {
    setCard(card.key, { uploading: true, uploadError: undefined })
    try {
      const b64 = await compressImageToJpegBase64(file, { maxDim: 1800, quality: 0.85 })
      const thumb = `data:image/jpeg;base64,${b64}`
      setCard(card.key, { photoBase64: b64, photoThumb: thumb })
      // Upload to Drive immediately so submit is instant.
      const resp = await authFetch('/api/expense-drive-upload', {
        method: 'POST',
        body: JSON.stringify({ base64: b64, account: card.account, date: card.date }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || data?.detail || 'Upload failed')
      setCard(card.key, { uploading: false, receiptUrl: data.viewUrl, receiptThumbUrl: data.thumbUrl })
    } catch (err: any) {
      setCard(card.key, { uploading: false, uploadError: err?.message || String(err) })
    }
  }

  const filled = useMemo(
    () => txns.filter(t => {
      const c = cards[t.txn_id]
      return c && !c.selectedForSkip && c.expenseType && c.category && (c.usd || c.eur)
    }),
    [txns, cards],
  )
  const selectedForSkip = useMemo(
    () => txns.filter(t => cards[t.txn_id]?.selectedForSkip),
    [txns, cards],
  )

  const submitFilled = async () => {
    if (filled.length === 0) return
    setSubmittingBatch(true); setGlobalError(null)
    try {
      const allSubmissions = filled.map(t => {
        const c = cards[t.txn_id]
        return {
          txn_id: t.txn_id,
          date: c.date,
          account: c.account,
          project: c.project || 'Operating',
          expenseType: c.expenseType,
          category: c.category,
          guestTrip: c.guestTrip ? (c.guestTripName || 'Yes') : '',
          store: c.merchant,
          usd: c.usd ? Number(c.usd) : null,
          eur: c.eur ? Number(c.eur) : null,
          refunded: '',
          description: c.description,
          specificRepair: '',
          statement: '',
          inputBy: crewName,
          receiptUrl: c.receiptUrl || '',
          driveViewUrl: c.receiptUrl || '',
        }
      })
      // Server caps at 100 per POST; chunk to 25 to stay well under Vercel's 45s function timeout on wide batches.
      // Wait between batches to stay under the Sheets 60-writes/min/user quota (each batch does append+status updates).
      const CHUNK = 25
      const BATCH_DELAY_MS = 5000
      const allResults: Array<{ txn_id: string; ok: boolean; error?: string; row?: number }> = []
      for (let i = 0; i < allSubmissions.length; i += CHUNK) {
        if (i > 0) await new Promise(res => setTimeout(res, BATCH_DELAY_MS))
        const submissions = allSubmissions.slice(i, i + CHUNK)
        const resp = await authFetch('/api/plaid/queue-submit', {
          method: 'POST',
          body: JSON.stringify({ submissions }),
        })
        const data = await resp.json()
        if (!resp.ok || (!data?.ok && !Array.isArray(data?.results))) {
          throw new Error(data?.error || `Submit failed on batch ${Math.floor(i / CHUNK) + 1}`)
        }
        const batchResults: Array<{ txn_id: string; ok: boolean; error?: string; row?: number }> = data.results || []
        allResults.push(...batchResults)
        // Flush each batch's successes to the UI so the queue shrinks live.
        const batchOkIds = new Set(batchResults.filter(r => r.ok).map(r => r.txn_id))
        setTxns(prev => prev.filter(t => !batchOkIds.has(t.txn_id)))
        setCards(prev => {
          const next = { ...prev }
          for (const r of batchResults) {
            if (r.ok) delete next[r.txn_id]
            else if (r.error && next[r.txn_id]) next[r.txn_id] = { ...next[r.txn_id], submitError: r.error }
          }
          return next
        })
      }
      const failed = allResults.filter(r => !r.ok)
      if (failed.length > 0) setGlobalError(`${failed.length} of ${allResults.length} failed. Fix the highlighted cards and retry.`)
    } catch (err: any) {
      setGlobalError(err?.message || String(err))
    } finally {
      setSubmittingBatch(false)
    }
  }

  const skipSelected = async () => {
    if (selectedForSkip.length === 0) return
    setSkippingBatch(true); setGlobalError(null)
    try {
      const ids = selectedForSkip.map(t => t.txn_id)
      const resp = await authFetch('/api/plaid/queue-skip', {
        method: 'POST',
        body: JSON.stringify({ txn_ids: ids }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || 'Skip failed')
      const skipped = new Set(ids)
      setTxns(prev => prev.filter(t => !skipped.has(t.txn_id)))
      setCards(prev => {
        const next = { ...prev }
        for (const id of skipped) delete next[id]
        return next
      })
    } catch (err: any) {
      setGlobalError(err?.message || String(err))
    } finally {
      setSkippingBatch(false)
    }
  }

  return (
    <MenuLayout title="Plaid queue" showBack backHref="/expenses">
      <div className="space-y-3">
        <button onClick={onBack} className="text-xs text-red-400 hover:underline">← Hub</button>
        {/* Floating scroll-to-top: appears whenever any cards are bulk-selected. */}
        {bulkSelectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Scroll to top"
            className="fixed bottom-4 right-4 z-50 h-11 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg shadow-black/50 flex items-center gap-1"
          >
            <span aria-hidden="true">↑</span> Top
          </button>
        )}
        {defsError && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-200 text-sm p-3">
            Categories failed to load: {defsError}
          </div>
        )}
        {loadError && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm p-3">{loadError}</div>
        )}
        {globalError && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm p-3">{globalError}</div>
        )}
        {loading && <div className="text-sm text-neutral-400">Loading queue…</div>}
        {!loading && txns.length === 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            Nothing pending. New card charges appear here after the daily 03:00 pull.
          </div>
        )}

        {/* Submit button — top of page, submits every card the admin has filled in */}
        {!loading && txns.length > 0 && (
          <button
            onClick={submitFilled}
            disabled={submittingBatch || filled.length === 0}
            className="w-full h-11 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold"
          >
            {submittingBatch
              ? 'Submitting…'
              : filled.length === 0
                ? 'Submit — fill category first'
                : `Submit ${filled.length} of ${txns.length}`}
          </button>
        )}

        {/* Bulk edit toolbar — shown when queue has rows */}
        {!loading && txns.length > 0 && (() => {
          const bulkCats = Array.from(catTree.keys())
          const bulkSubs = catTree.get(bulkExpenseType) || []
          const n = bulkSelectedIds.length
          return (
            <div className={`rounded-xl border p-3 space-y-2 ${n > 0 ? 'border-red-600/60 bg-red-950/20' : 'border-neutral-800 bg-neutral-900/60'}`}>
              <div className="flex items-center justify-between text-xs">
                <div className="font-semibold text-neutral-200">Bulk edit · {n} selected</div>
                <div className="flex gap-2">
                  <button onClick={selectAllForBulk} className="text-red-400 hover:underline">Select all</button>
                  {n > 0 && <button onClick={clearBulkSelection} className="text-neutral-400 hover:underline">Clear</button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2">
                  <label className="text-xs text-neutral-400">Category</label>
                  <select
                    value={bulkExpenseType}
                    onChange={(e) => { setBulkExpenseType(e.target.value); setBulkCategory('') }}
                    className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                  >
                    <option value="">— leave unchanged —</option>
                    {bulkCats.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-400">Subcategory</label>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    disabled={!bulkExpenseType}
                    className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 disabled:opacity-50"
                  >
                    <option value="">{bulkExpenseType ? '— pick —' : 'Pick category first'}</option>
                    {bulkSubs.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-400">Guest trip?</label>
                  <div className="flex gap-1 mt-1">
                    {(['none','no','yes'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setBulkGuestTrip(v)}
                        className={`flex-1 h-9 rounded border font-semibold text-xs capitalize ${bulkGuestTrip === v ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                      >{v === 'none' ? 'unchanged' : v}</button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-neutral-400">Trip name</label>
                  <select
                    value={bulkTrip}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '__new__') { setShowCreateTrip(true); return }
                      setBulkTrip(v)
                    }}
                    className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                  >
                    <option value="">— leave unchanged —</option>
                    <option value="__auto__">Auto (match trip by date)</option>
                    <option value="__none__">Clear (no trip)</option>
                    {trips.length > 0 && <option disabled>──────────</option>}
                    {trips.filter(t => t.active !== false).map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                    <option value="__new__">+ Create new trip…</option>
                  </select>
                </div>
              </div>
              <button
                onClick={applyBulk}
                disabled={n === 0 || (!bulkExpenseType && !bulkCategory && bulkGuestTrip === 'none' && !bulkTrip)}
                className="w-full h-9 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold"
              >Apply to {n} selected</button>
              {showCreateTrip && (
                <div className="rounded-lg border border-red-600/60 bg-neutral-950 p-3 space-y-2 mt-2">
                  <div className="text-xs font-semibold text-neutral-200">New guest trip</div>
                  <input
                    value={newTripName}
                    onChange={e => setNewTripName(e.target.value)}
                    placeholder="Trip name (e.g. Enrico's Med Summer)"
                    className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-neutral-400 uppercase">Start</label>
                      <input type="date" value={newTripStart} onChange={e => setNewTripStart(e.target.value)} className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 uppercase">End</label>
                      <input type="date" value={newTripEnd} onChange={e => setNewTripEnd(e.target.value)} className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 text-sm" />
                    </div>
                  </div>
                  {newTripError && <div className="text-xs text-red-400">{newTripError}</div>}
                  <div className="flex gap-2">
                    <button onClick={createTrip} disabled={creatingTrip} className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold">
                      {creatingTrip ? 'Creating…' : 'Create'}
                    </button>
                    <button onClick={() => { setShowCreateTrip(false); setNewTripError(null) }} className="px-3 h-9 rounded-lg border border-neutral-800 text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {txns.map(t => {
          const c = cards[t.txn_id]
          if (!c) return null
          const cats = Array.from(catTree.keys())
          const subs = catTree.get(c.expenseType) || []
          return (
            <div
              key={t.txn_id}
              className={`rounded-xl border p-3 space-y-3 ${
                c.submitError
                  ? 'border-red-600/60 bg-red-950/30'
                  : c.selectedForSkip
                    ? 'border-neutral-700 bg-neutral-900/50 opacity-70'
                    : 'border-neutral-800 bg-neutral-900'
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{t.merchant || '(no merchant)'}</div>
                  <div className="text-xs text-neutral-400">
                    {t.date} · ${t.amount_usd?.toFixed?.(2) ?? t.amount_usd} · {t.account_queue_label}
                  </div>
                  {t.category && <div className="text-xs text-neutral-500">{t.category}</div>}
                </div>
                <label className="text-xs flex items-center gap-1 select-none">
                  <input
                    type="checkbox"
                    checked={!!c.selectedForBulk}
                    onChange={(e) => setCard(t.txn_id, { selectedForBulk: e.target.checked })}
                    className="accent-red-600"
                  />
                  Bulk
                </label>
              </div>

              {!c.selectedForSkip && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Store / merchant</label>
                    <input
                      type="text"
                      value={c.merchant}
                      onChange={(e) => setCard(t.txn_id, { merchant: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Date</label>
                    <input
                      type="date"
                      value={c.date}
                      onChange={(e) => setCard(t.txn_id, { date: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">USD</label>
                    <input
                      type="number" step="0.01"
                      value={c.usd}
                      onChange={(e) => setCard(t.txn_id, { usd: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">EUR (optional)</label>
                    <input
                      type="number" step="0.01"
                      value={c.eur}
                      onChange={(e) => setCard(t.txn_id, { eur: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Guest trip?</label>
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => setCard(t.txn_id, { guestTrip: false })}
                        className={`flex-1 h-9 rounded border font-semibold text-xs ${!c.guestTrip ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                      >No</button>
                      <button
                        onClick={() => setCard(t.txn_id, {
                          guestTrip: true,
                          // Auto-fill category to 'Guest trip' when the guest
                          // trip flag is turned on (blank subcategory so admin picks one).
                          expenseType: 'Guest trip',
                          category: c.expenseType === 'Guest trip' ? c.category : '',
                        })}
                        className={`flex-1 h-9 rounded border font-semibold text-xs ${c.guestTrip ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                      >Yes</button>
                    </div>
                  </div>
                  {c.guestTrip && (
                    <div className="col-span-2">
                      <label className="text-xs text-neutral-400">Guest trip name</label>
                      <input
                        type="text"
                        value={c.guestTripName}
                        onChange={(e) => setCard(t.txn_id, { guestTripName: e.target.value })}
                        className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Category</label>
                    <select
                      value={c.expenseType}
                      onChange={(e) => setCard(t.txn_id, { expenseType: e.target.value, category: '' })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    >
                      <option value="">— pick —</option>
                      {cats.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Subcategory</label>
                    <select
                      value={c.category}
                      onChange={(e) => setCard(t.txn_id, { category: e.target.value })}
                      disabled={!c.expenseType}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 disabled:opacity-50"
                    >
                      <option value="">{c.expenseType ? '— pick —' : 'Pick category first'}</option>
                      {subs.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Description (optional)</label>
                    <input
                      type="text"
                      value={c.description}
                      onChange={(e) => setCard(t.txn_id, { description: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Receipt photo (optional)</label>
                    <div className="flex items-center gap-2">
                      {c.photoThumb && (
                        <img src={c.photoThumb} alt="receipt" className="h-12 w-12 object-cover rounded border border-neutral-800" />
                      )}
                      <label className="text-xs px-3 h-9 flex items-center rounded border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 cursor-pointer">
                        {c.uploading ? 'Uploading…' : c.receiptUrl ? '✓ Attached — replace' : '+ Attach'}
                        <input
                          type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) attachReceipt(c, f) }}
                        />
                      </label>
                      {c.uploadError && <span className="text-xs text-red-400">{c.uploadError}</span>}
                    </div>
                  </div>
                  {c.submitError && <div className="col-span-2 text-xs text-red-400">Submit error: {c.submitError}</div>}
                </div>
              )}
            </div>
          )
        })}

      </div>
    </MenuLayout>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Admin — Orphan queue
// ══════════════════════════════════════════════════════════════════════
function AdminOrphanQueue({ onBack }: { onBack: () => void }) {
  const [orphans, setOrphans] = useState<OrphanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cards, setCards] = useState<Record<string, CardEdit>>({})
  const { definitions, error: defsError } = useDefinitions()
  const catTree = useCategoryTree(definitions, true)
  const crewName = getCrewName() || 'Admin'
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [submittingBatch, setSubmittingBatch] = useState(false)
  const [skippingBatch, setSkippingBatch] = useState(false)

  const load = async () => {
    setLoading(true); setLoadError(null)
    try {
      const r = await authFetch('/api/expenses/orphan-list')
      const d = await r.json()
      if (!d?.ok) throw new Error(d?.error || 'load failed')
      setOrphans(d.orphans || [])
      setCards(prev => {
        const next: Record<string, CardEdit> = { ...prev }
        for (const o of (d.orphans || []) as OrphanRow[]) {
          if (!next[o.id]) {
            next[o.id] = {
              key: o.id,
              source: 'orphan',
              origDate: o.ocr_date || todayISO(),
              origMerchant: o.ocr_merchant,
              origUsd: o.ocr_usd,
              origEur: o.ocr_eur,
              account: 'Amex 3240',
              receiptUrl: o.receipt_url,
              receiptThumbUrl: o.receipt_thumb_url,
              date: o.ocr_date || todayISO(),
              merchant: o.ocr_merchant || '',
              usd: o.ocr_usd != null ? String(o.ocr_usd) : '',
              eur: o.ocr_eur != null ? String(o.ocr_eur) : '',
              project: 'Operating',
              expenseType: '',
              category: '',
              guestTrip: false,
              guestTripName: '',
              description: '',
              selectedForSkip: false,
            }
          }
        }
        return next
      })
    } catch (err: any) {
      setLoadError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const setCard = (key: string, patch: Partial<CardEdit>) => {
    setCards(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const filled = useMemo(
    () => orphans.filter(o => {
      const c = cards[o.id]
      return c && !c.selectedForSkip && c.expenseType && c.category && (c.usd || c.eur)
    }),
    [orphans, cards],
  )
  const selectedForSkip = useMemo(
    () => orphans.filter(o => cards[o.id]?.selectedForSkip),
    [orphans, cards],
  )

  const submitFilled = async () => {
    if (filled.length === 0) return
    setSubmittingBatch(true); setGlobalError(null)
    try {
      const expenses = filled.map(o => {
        const c = cards[o.id]
        return {
          date: c.date,
          account: c.account,
          project: c.project || 'Operating',
          expenseType: c.expenseType,
          category: c.category,
          guestTrip: c.guestTrip ? (c.guestTripName || 'Yes') : '',
          store: c.merchant,
          usd: c.usd ? Number(c.usd) : null,
          eur: c.eur ? Number(c.eur) : null,
          refunded: '',
          description: c.description,
          specificRepair: '',
          statement: '',
          inputBy: crewName,
          receiptUrl: c.receiptUrl || '',
          crosscheck: 'orphan-resolved',
        }
      })
      // Server caps at 100/POST; chunk to 25 to stay well under function timeout.
      const CHUNK = 25
      const errors: Array<{ index: number; error: string }> = []
      for (let i = 0; i < expenses.length; i += CHUNK) {
        const slice = expenses.slice(i, i + CHUNK)
        const resp = await authFetch('/api/expense-submit', {
          method: 'POST',
          body: JSON.stringify({ expenses: slice }),
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error || `Submit failed on batch ${Math.floor(i / CHUNK) + 1}`)
        const batchErrs: Array<{ index: number; error: string }> = data?.errors || []
        // Re-index batch errors to the outer array index.
        for (const e of batchErrs) errors.push({ index: i + e.index, error: e.error })
      }
      const okIds: string[] = []
      const nextCards: Record<string, CardEdit> = { ...cards }
      for (let i = 0; i < filled.length; i++) {
        const o = filled[i]
        const errHit = errors.find(e => e.index === i)
        if (errHit) {
          nextCards[o.id] = { ...nextCards[o.id], submitError: errHit.error }
        } else {
          okIds.push(o.id)
          delete nextCards[o.id]
        }
      }
      setCards(nextCards)
      if (okIds.length > 0) {
        // Mark resolved on the sheet, then drop from view.
        try {
          await authFetch('/api/expenses/orphan-resolve', {
            method: 'POST',
            body: JSON.stringify({ ids: okIds, status: 'resolved' }),
          })
        } catch (e: any) {
          console.warn('orphan-resolve failed:', e?.message)
        }
        const okSet = new Set(okIds)
        setOrphans(prev => prev.filter(o => !okSet.has(o.id)))
      }
      if (errors.length > 0) setGlobalError(`${errors.length} of ${filled.length} failed.`)
    } catch (err: any) {
      setGlobalError(err?.message || String(err))
    } finally {
      setSubmittingBatch(false)
    }
  }

  const skipSelected = async () => {
    if (selectedForSkip.length === 0) return
    setSkippingBatch(true); setGlobalError(null)
    try {
      const ids = selectedForSkip.map(o => o.id)
      const resp = await authFetch('/api/expenses/orphan-resolve', {
        method: 'POST',
        body: JSON.stringify({ ids, status: 'skipped' }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || 'Skip failed')
      const skipped = new Set(ids)
      setOrphans(prev => prev.filter(o => !skipped.has(o.id)))
      setCards(prev => {
        const next = { ...prev }
        for (const id of skipped) delete next[id]
        return next
      })
    } catch (err: any) {
      setGlobalError(err?.message || String(err))
    } finally {
      setSkippingBatch(false)
    }
  }

  return (
    <MenuLayout title="Orphan receipts" showBack backHref="/expenses">
      <div className="space-y-3">
        <button onClick={onBack} className="text-xs text-red-400 hover:underline">← Hub</button>
        {defsError && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-200 text-sm p-3">
            Categories failed to load: {defsError}
          </div>
        )}
        {loadError && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm p-3">{loadError}</div>
        )}
        {globalError && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm p-3">{globalError}</div>
        )}
        {loading && <div className="text-sm text-neutral-400">Loading orphan queue…</div>}
        {!loading && orphans.length === 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            No orphan receipts.
          </div>
        )}

        {orphans.map(o => {
          const c = cards[o.id]
          if (!c) return null
          const cats = Array.from(catTree.keys())
          const subs = catTree.get(c.expenseType) || []
          return (
            <div
              key={o.id}
              className={`rounded-xl border p-3 space-y-3 ${
                c.submitError
                  ? 'border-red-600/60 bg-red-950/30'
                  : c.selectedForSkip
                    ? 'border-neutral-700 bg-neutral-900/50 opacity-70'
                    : 'border-neutral-800 bg-neutral-900'
              }`}
            >
              <div className="flex gap-3">
                <a href={o.receipt_url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                  <img
                    src={o.receipt_thumb_url || o.receipt_url}
                    alt="receipt"
                    className="h-24 w-24 object-cover rounded-lg border border-neutral-800"
                  />
                </a>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-neutral-400">
                    Added {o.added_at ? o.added_at.slice(0, 10) : ''} by {o.added_by || '?'}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    OCR: {o.ocr_merchant || '?'} · {o.ocr_date || '?'} · {o.ocr_eur != null ? `€${o.ocr_eur}` : ''} {o.ocr_usd != null ? `$${o.ocr_usd}` : ''}
                  </div>
                </div>
                <label className="text-xs flex items-center gap-1 select-none">
                  <input
                    type="checkbox"
                    checked={c.selectedForSkip}
                    onChange={(e) => setCard(o.id, { selectedForSkip: e.target.checked })}
                    className="accent-red-600"
                  />
                  Skip
                </label>
              </div>

              {!c.selectedForSkip && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <label className="text-xs text-neutral-400">Account</label>
                    <div className="flex gap-1 mt-1">
                      {(['Amex 3240', 'Bilt'] as Account[]).map(a => (
                        <button
                          key={a}
                          onClick={() => setCard(o.id, { account: a })}
                          className={`flex-1 h-9 rounded border font-semibold text-xs ${c.account === a ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                        >{a}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Date</label>
                    <input
                      type="date"
                      value={c.date}
                      onChange={(e) => setCard(o.id, { date: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Store / merchant</label>
                    <input
                      type="text"
                      value={c.merchant}
                      onChange={(e) => setCard(o.id, { merchant: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">EUR</label>
                    <input
                      type="number" step="0.01"
                      value={c.eur}
                      onChange={(e) => setCard(o.id, { eur: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">USD</label>
                    <input
                      type="number" step="0.01"
                      value={c.usd}
                      onChange={(e) => setCard(o.id, { usd: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Guest trip?</label>
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => setCard(o.id, { guestTrip: false })}
                        className={`flex-1 h-9 rounded border font-semibold text-xs ${!c.guestTrip ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                      >No</button>
                      <button
                        onClick={() => setCard(o.id, {
                          guestTrip: true,
                          expenseType: 'Guest trip',
                          category: c.expenseType === 'Guest trip' ? c.category : '',
                        })}
                        className={`flex-1 h-9 rounded border font-semibold text-xs ${c.guestTrip ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                      >Yes</button>
                    </div>
                  </div>
                  {c.guestTrip && (
                    <div className="col-span-2">
                      <label className="text-xs text-neutral-400">Guest trip name</label>
                      <input
                        type="text"
                        value={c.guestTripName}
                        onChange={(e) => setCard(o.id, { guestTripName: e.target.value })}
                        className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Category</label>
                    <select
                      value={c.expenseType}
                      onChange={(e) => setCard(o.id, { expenseType: e.target.value, category: '' })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    >
                      <option value="">— pick —</option>
                      {cats.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Subcategory</label>
                    <select
                      value={c.category}
                      onChange={(e) => setCard(o.id, { category: e.target.value })}
                      disabled={!c.expenseType}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 disabled:opacity-50"
                    >
                      <option value="">{c.expenseType ? '— pick —' : 'Pick category first'}</option>
                      {subs.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-neutral-400">Description (optional)</label>
                    <input
                      type="text"
                      value={c.description}
                      onChange={(e) => setCard(o.id, { description: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                    />
                  </div>
                  {c.submitError && <div className="col-span-2 text-xs text-red-400">Submit error: {c.submitError}</div>}
                </div>
              )}
            </div>
          )
        })}

        {!loading && (filled.length > 0 || selectedForSkip.length > 0) && (
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-neutral-950/95 border-t border-neutral-800 flex gap-2">
            <button
              onClick={submitFilled}
              disabled={submittingBatch || filled.length === 0}
              className="flex-1 h-11 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
            >
              {submittingBatch ? 'Submitting…' : `Submit ${filled.length} filled`}
            </button>
            <button
              onClick={skipSelected}
              disabled={skippingBatch || selectedForSkip.length === 0}
              className="flex-1 h-11 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 font-semibold"
            >
              {skippingBatch ? 'Skipping…' : `Skip ${selectedForSkip.length}`}
            </button>
          </div>
        )}
      </div>
    </MenuLayout>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Crew — scan flow (also used by admin "scan my own")
// ══════════════════════════════════════════════════════════════════════
function AdminOneOff({ onBack }: { onBack: () => void }) {
  const { definitions, error: defsError } = useDefinitions()
  const catTree = useCategoryTree(definitions, true)
  const crewName = getCrewName() || 'Admin'
  const cats = Array.from(catTree.keys())

  // Preset accounts + free-form 'Other' for anything not in the list.
  const presetAccounts = ['Gabe’s Visa', 'Gabe’s Wise', 'Amex 3240', 'Bilt', 'Cash', 'Enrico’s Bilt', 'Other']

  const [account, setAccount] = useState<string>('Gabe’s Visa')
  const [accountOther, setAccountOther] = useState('')
  const [date, setDate] = useState(todayISO())
  const [merchant, setMerchant] = useState('')
  const [usd, setUsd] = useState('')
  const [eur, setEur] = useState('')
  const [expenseType, setExpenseType] = useState('')
  const [category, setCategory] = useState('')
  const [guestTrip, setGuestTrip] = useState(false)
  const [guestTripName, setGuestTripName] = useState('')
  const [description, setDescription] = useState('')

  const [photoBase64, setPhotoBase64] = useState<string>('')
  const [photoThumb, setPhotoThumb] = useState<string>('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submittedRow, setSubmittedRow] = useState<number | null>(null)

  const subs = catTree.get(expenseType) || []
  const finalAccount = account === 'Other' ? (accountOther.trim() || 'Other') : account

  const resetAll = () => {
    setMerchant(''); setUsd(''); setEur(''); setExpenseType(''); setCategory('')
    setGuestTrip(false); setGuestTripName(''); setDescription('')
    setPhotoBase64(''); setPhotoThumb(''); setReceiptUrl('')
    setSubmittedRow(null); setSubmitError(''); setReadError(''); setUploadError('')
  }

  const attachFile = async (file: File) => {
    setUploading(true); setUploadError('')
    try {
      const b64 = await compressImageToJpegBase64(file, { maxDim: 1800, quality: 0.85 })
      setPhotoBase64(b64)
      setPhotoThumb(`data:image/jpeg;base64,${b64}`)
      // Upload to Drive. Server-side folder routing accepts free-form account.
      const resp = await authFetch('/api/expense-drive-upload', {
        method: 'POST',
        body: JSON.stringify({ base64: b64, account: finalAccount, date }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || data?.detail || 'Upload failed')
      setReceiptUrl(data.viewUrl || '')
    } catch (err: any) {
      setUploadError(err?.message || String(err))
    } finally {
      setUploading(false)
    }
  }

  const readReceipt = async () => {
    if (!photoBase64) return
    setReading(true); setReadError('')
    try {
      const resp = await authFetch('/api/expense-read-receipts', {
        method: 'POST',
        body: JSON.stringify({ images: [{ base64: photoBase64, mime: 'image/jpeg' }] }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || 'Read failed')
      const r = (data.receipts || [])[0]
      if (r) {
        if (r.merchant) setMerchant(r.merchant)
        if (r.date) setDate(r.date)
        if (r.eur != null) setEur(String(r.eur))
        if (r.usd != null) setUsd(String(r.usd))
        const cls = autoClassify(r.category_hint || null, guestTrip)
        if (cls) {
          setExpenseType(cls.expenseType)
          setCategory(cls.category)
        }
      }
    } catch (err: any) {
      setReadError(err?.message || String(err))
    } finally {
      setReading(false)
    }
  }

  const canSubmit = !!(finalAccount && date && merchant && (usd || eur) && expenseType && category)

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true); setSubmitError('')
    try {
      const expense = {
        date,
        account: finalAccount,
        project: 'Operating',
        expenseType,
        category,
        guestTrip: guestTrip ? (guestTripName || 'Yes') : '',
        store: merchant,
        usd: usd ? Number(usd) : null,
        eur: eur ? Number(eur) : null,
        refunded: '',
        description,
        specificRepair: '',
        statement: '',
        inputBy: crewName,
        receiptUrl,
        driveViewUrl: receiptUrl,
        crosscheck: 'one-off',
      }
      const resp = await authFetch('/api/expense-submit', {
        method: 'POST',
        body: JSON.stringify({ expenses: [expense] }),
      })
      const data = await resp.json()
      const errors: Array<{ index: number; error: string }> = data?.errors || []
      const inserted: Array<{ row: number }> = data?.inserted || []
      if (errors.length > 0) throw new Error(errors[0].error)
      const row = inserted[0]?.row ?? null
      setSubmittedRow(row)
    } catch (err: any) {
      setSubmitError(err?.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MenuLayout title="One-off expense" showBack backHref="/expenses">
      <div className="space-y-3">
        <button onClick={onBack} className="text-xs text-red-400 hover:underline">← Hub</button>
        {defsError && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-200 text-sm p-3">
            Categories failed to load: {defsError}
          </div>
        )}

        {submittedRow != null ? (
          <div className="rounded-xl border border-green-600/50 bg-green-950/30 p-4 space-y-3 text-sm">
            <div className="font-semibold text-green-300">✓ Filed as expense (row {submittedRow})</div>
            <div className="text-xs text-neutral-300">{merchant} · {date} · {finalAccount}</div>
            <button
              onClick={resetAll}
              className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
            >Enter another one-off</button>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 space-y-3">
            <div>
              <label className="text-xs text-neutral-400">Account</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {presetAccounts.map(a => (
                  <button
                    key={a}
                    onClick={() => setAccount(a)}
                    className={`h-9 px-2 rounded border text-xs font-semibold ${account === a ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950 text-neutral-200'}`}
                  >{a}</button>
                ))}
              </div>
              {account === 'Other' && (
                <input
                  type="text"
                  placeholder="Type account name (e.g. Iridium prepaid)"
                  value={accountOther}
                  onChange={(e) => setAccountOther(e.target.value)}
                  className="mt-2 w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 text-sm"
                />
              )}
              <div className="text-[11px] text-neutral-500 mt-1">Writes ‘{finalAccount}’ to the Expenses sheet.</div>
            </div>

            <div>
              <label className="text-xs text-neutral-400">Receipt photo (optional)</label>
              <div className="flex items-center gap-2 mt-1">
                {photoThumb && (
                  <img src={photoThumb} alt="receipt" className="h-12 w-12 object-cover rounded border border-neutral-800" />
                )}
                <label className="text-xs px-3 h-9 flex items-center rounded border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 cursor-pointer">
                  {uploading ? 'Uploading…' : receiptUrl ? '✓ Attached — replace' : '+ Attach'}
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFile(f) }}
                  />
                </label>
                {photoBase64 && !reading && (
                  <button
                    onClick={readReceipt}
                    disabled={reading}
                    className="text-xs px-3 h-9 rounded border border-neutral-800 bg-neutral-950 hover:bg-neutral-900"
                  >{reading ? 'Reading…' : 'Auto-fill from photo'}</button>
                )}
              </div>
              {uploadError && <div className="text-xs text-red-400 mt-1">{uploadError}</div>}
              {readError && <div className="text-xs text-red-400 mt-1">{readError}</div>}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2">
                <label className="text-xs text-neutral-400">Store / merchant</label>
                <input
                  type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400">Date</label>
                <input
                  type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400">USD</label>
                <input
                  type="number" step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-neutral-400">EUR (optional)</label>
                <input
                  type="number" step="0.01" value={eur} onChange={(e) => setEur(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-neutral-400">Guest trip?</label>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => { setGuestTrip(false); setGuestTripName('') }}
                    className={`flex-1 h-9 rounded border font-semibold text-xs ${!guestTrip ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                  >No</button>
                  <button
                    onClick={() => {
                      setGuestTrip(true)
                      if (expenseType !== 'Guest trip') { setExpenseType('Guest trip'); setCategory('') }
                    }}
                    className={`flex-1 h-9 rounded border font-semibold text-xs ${guestTrip ? 'bg-red-600 border-red-600 text-white' : 'border-neutral-800 bg-neutral-950'}`}
                  >Yes</button>
                </div>
              </div>
              {guestTrip && (
                <div className="col-span-2">
                  <label className="text-xs text-neutral-400">Guest trip name</label>
                  <input
                    type="text" value={guestTripName} onChange={(e) => setGuestTripName(e.target.value)}
                    className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                  />
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs text-neutral-400">Category</label>
                <select
                  value={expenseType}
                  onChange={(e) => { setExpenseType(e.target.value); setCategory('') }}
                  className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                >
                  <option value="">— pick —</option>
                  {cats.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-neutral-400">Subcategory</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={!expenseType}
                  className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950 disabled:opacity-50"
                >
                  <option value="">{expenseType ? '— pick —' : 'Pick category first'}</option>
                  {subs.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-neutral-400">Description (optional)</label>
                <input
                  type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-neutral-800 bg-neutral-950"
                />
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-xs p-2">{submitError}</div>
            )}
            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="w-full h-11 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold"
            >{submitting ? 'Filing…' : 'File expense'}</button>
          </div>
        )}
      </div>
    </MenuLayout>
  )
}

function CrewIntake({ adminScanBack }: { adminScanBack?: () => void }) {
  const [, setLocation] = useLocation()
  // Card is auto-detected from the Plaid match — no picker.
  // Drive uploads before match happens, so we tag them with a neutral folder.
  const uploadAccount: Account = 'Amex 3240'
  const [photos, setPhotos] = useState<Photo[]>([])
  const [readingAll, setReadingAll] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const crewName = getCrewName() || 'Unknown'

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setGlobalError(null)
    const newPhotos: Photo[] = []
    for (const file of Array.from(files)) {
      try {
        const b64 = await compressImageToJpegBase64(file, { maxDim: 1800, quality: 0.85 })
        newPhotos.push({
          id: newPhotoId(),
          base64: b64,
          thumbDataUrl: `data:image/jpeg;base64,${b64}`,
          file,
          date: todayISO(),
          merchant: '',
          eur: '',
          usd: '',
          guestTrip: false,
          guestTripName: '',
          project: '',
          expenseType: '',
          category: '',
          description: '',
          refunded: '',
          specificRepair: '',
          statement: '',
        })
      } catch (err: any) {
        setGlobalError(err?.message || 'Failed to read image')
      }
    }
    if (newPhotos.length === 0) return
    setPhotos(prev => [...prev, ...newPhotos])
    for (const p of newPhotos) uploadPhotoToDrive(p)
  }

  const updatePhoto = (id: string, patch: Partial<Photo>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  const uploadPhotoToDrive = async (photo: Photo) => {
    updatePhoto(photo.id, { uploading: true, uploadError: undefined })
    try {
      const resp = await authFetch('/api/expense-drive-upload', {
        method: 'POST',
        body: JSON.stringify({ base64: photo.base64, account: uploadAccount, date: photo.date }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || data?.detail || 'Upload failed')
      updatePhoto(photo.id, {
        uploading: false,
        driveFileId: data.fileId,
        driveViewUrl: data.viewUrl,
        driveThumbUrl: data.thumbUrl,
      })
    } catch (err: any) {
      updatePhoto(photo.id, { uploading: false, uploadError: err?.message || String(err) })
    }
  }

  const removePhoto = (id: string) => setPhotos(prev => prev.filter(p => p.id !== id))

  // Try to match a single receipt against the Plaid backlog (cache + live).
  const runMatchFor = async (p: Photo, r: ReceiptRead): Promise<PlaidMatch> => {
    try {
      // Do NOT send account — match across all cards, let Plaid identify it.
      const resp = await authFetch('/api/plaid/match', {
        method: 'POST',
        body: JSON.stringify({
          queries: [{
            date: r.date || p.date,
            eur: r.eur ?? null,
            usd: r.usd ?? null,
            merchant: r.merchant ?? null,
          }],
        }),
      })
      const data = await resp.json()
      if (data?.ok && Array.isArray(data.matches)) return data.matches[0] || null
    } catch (err: any) {
      console.warn('match failed:', err?.message)
    }
    return null
  }

  // Submit one photo as a matched expense (auto-submits via /api/expense-submit).
  const submitMatched = async (p: Photo, m: NonNullable<PlaidMatch>): Promise<{ ok: boolean; row?: number; error?: string }> => {
    try {
      const usd = Number.isFinite(m.amount_usd) ? m.amount_usd : (p.usd ? Number(p.usd) : null)
      // Use the receipt EUR when we have it; otherwise blank.
      const eur = p.read?.eur ?? (p.eur ? Number(p.eur) : null)
      const cls = autoClassify(p.read?.category_hint || null, p.guestTrip)
      // Account comes from the Plaid match — no more manual selection.
      const resolvedAccount = m.account_label || 'Amex 3240'
      const expense = {
        date: m.date,
        account: resolvedAccount,
        project: cls?.project || 'Operating',
        expenseType: cls?.expenseType || 'Recurrent',
        category: cls?.category || '',
        guestTrip: p.guestTrip ? (p.guestTripName || 'Yes') : '',
        store: m.merchant || p.read?.merchant || p.merchant,
        usd,
        eur,
        refunded: '',
        description: p.read?.notes || '',
        specificRepair: '',
        statement: '',
        inputBy: crewName,
        receiptUrl: p.driveViewUrl || '',
        crosscheck: `matched:${m.txn_id}`,
      }
      const resp = await authFetch('/api/expense-submit', {
        method: 'POST',
        body: JSON.stringify({ expenses: [expense] }),
      })
      const data = await resp.json()
      if (!data?.ok) {
        const err = data?.errors?.[0]?.error || data?.error || 'Submit failed'
        return { ok: false, error: err }
      }
      const row = data.inserted?.[0]?.row
      // Mark the Plaid txn as submitted (idempotent, admin-only endpoint would be
      // needed for full write; here we rely on the daily reconciliation to skip.
      // We flag via crosscheck so admin can see the link.
      return { ok: true, row }
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) }
    }
  }

  const addOrphan = async (p: Photo): Promise<{ ok: boolean; error?: string }> => {
    try {
      const resp = await authFetch('/api/expenses/orphan-add', {
        method: 'POST',
        body: JSON.stringify({
          receipt_url: p.driveViewUrl,
          receipt_thumb_url: p.driveThumbUrl,
          ocr: {
            merchant: p.read?.merchant ?? null,
            date: p.read?.date ?? p.date,
            eur: p.read?.eur ?? null,
            usd: p.read?.usd ?? null,
          },
          addedBy: crewName,
        }),
      })
      const data = await resp.json()
      if (!data?.ok) return { ok: false, error: data?.error || 'orphan-add failed' }
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) }
    }
  }

  const runScanFlow = async () => {
    if (photos.length === 0) return
    if (photos.some(p => p.uploading)) { setGlobalError('Wait for uploads to finish.'); return }
    setReadingAll(true); setGlobalError(null)
    setPhotos(prev => prev.map(p => ({ ...p, reading: true })))

    try {
      // 1) OCR all in one batch
      const resp = await authFetch('/api/expense-read-receipts', {
        method: 'POST',
        body: JSON.stringify({ images: photos.map(p => ({ base64: p.base64, mime: 'image/jpeg' })) }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || 'Read failed')
      const reads: ReceiptRead[] = data.receipts || []

      // 2) Apply reads and mark reading:false
      let snapshot: Photo[] = []
      setPhotos(prev => {
        snapshot = prev.map((p, i) => {
          const r = reads[i]
          if (!r) return { ...p, reading: false }
          return {
            ...p,
            reading: false,
            read: r,
            merchant: r.merchant || p.merchant,
            date: r.date || p.date,
            eur: r.eur != null ? String(r.eur) : p.eur,
            usd: r.usd != null ? String(r.usd) : p.usd,
          }
        })
        return snapshot
      })

      // 3) First-pass match against Plaid backlog (cache + live), per photo
      let didAnyMiss = false
      for (let i = 0; i < snapshot.length; i++) {
        const p = snapshot[i]
        const r = reads[i]
        if (!r) continue
        const match = await runMatchFor(p, r)
        snapshot[i] = { ...snapshot[i], plaidMatch: match }
        if (!match) didAnyMiss = true
      }
      setPhotos([...snapshot])

      // 4) If any miss, auto-run a crew Plaid sync then re-match those.
      if (didAnyMiss) {
        setPhotos(prev => prev.map(p => p.plaidMatch ? p : { ...p, syncing: true }))
        try {
          await authFetch('/api/plaid/crew-sync', { method: 'POST', body: JSON.stringify({}) })
        } catch (err: any) {
          console.warn('crew-sync failed:', err?.message)
        }
        for (let i = 0; i < snapshot.length; i++) {
          if (snapshot[i].plaidMatch) continue
          const r = reads[i]
          if (!r) continue
          const match = await runMatchFor(snapshot[i], r)
          snapshot[i] = { ...snapshot[i], plaidMatch: match, syncing: false }
        }
        setPhotos([...snapshot])
      }

      // 5) For each photo: matched → auto-submit; already-logged → skip (no duplicate); else → orphan-add
      for (let i = 0; i < snapshot.length; i++) {
        const p = snapshot[i]
        if (p.plaidMatch?.already_submitted) {
          // Admin already categorized this charge from the Plaid queue —
          // don't create a duplicate expense row. Keep admin edits intact but
          // attach the crew photo to the existing row if col O is empty.
          const plaidTxnId = p.plaidMatch.plaid_txn_id || p.plaidMatch.txn_id
          const receiptUrl = p.driveViewUrl || ''
          if (plaidTxnId && receiptUrl) {
            try {
              await authFetch('/api/expense-attach-receipt', {
                method: 'POST',
                body: JSON.stringify({ plaid_txn_id: plaidTxnId, receiptUrl }),
              })
            } catch (err: any) {
              console.warn('attach-receipt failed:', err?.message)
            }
          }
          setPhotos(prev => prev.map(x => x.id === p.id ? {
            ...x,
            submitting: false,
            submitted: true,
            submittedAs: 'duplicate',
          } : x))
          snapshot[i] = { ...snapshot[i], submitted: true, submittedAs: 'duplicate' }
        } else if (p.plaidMatch) {
          setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, submitting: true } : x))
          const r = await submitMatched(p, p.plaidMatch as NonNullable<PlaidMatch>)
          setPhotos(prev => prev.map(x => x.id === p.id ? {
            ...x,
            submitting: false,
            submitted: r.ok,
            submittedRow: r.row,
            submitError: r.error,
            submittedAs: 'matched',
          } : x))
          snapshot[i] = { ...snapshot[i], submitted: r.ok, submittedRow: r.row, submitError: r.error, submittedAs: 'matched' }
        } else {
          setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, submitting: true } : x))
          const r = await addOrphan(p)
          setPhotos(prev => prev.map(x => x.id === p.id ? {
            ...x,
            submitting: false,
            submitted: r.ok,
            submitError: r.error,
            submittedAs: 'orphan',
          } : x))
          snapshot[i] = { ...snapshot[i], submitted: r.ok, submitError: r.error, submittedAs: 'orphan' }
        }
      }
    } catch (err: any) {
      setGlobalError(err?.message || String(err))
      setPhotos(prev => prev.map(p => ({ ...p, reading: false, syncing: false })))
    } finally {
      setReadingAll(false)
    }
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk/edit#gid=734695797`
  const allDone = photos.length > 0 && photos.every(p => p.submitted)
  const anyUploading = photos.some(p => p.uploading)
  const anyBusy = readingAll || photos.some(p => p.reading || p.syncing || p.submitting)

  const backHref = adminScanBack ? undefined : '/menu'

  return (
    <MenuLayout title="Scan receipts" showBack backHref={backHref || '/menu'}>
      <div className="space-y-4">
        {adminScanBack && (
          <button onClick={adminScanBack} className="text-xs text-red-400 hover:underline">← Hub</button>
        )}

        {/* Card auto-detected from Plaid match — no picker */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 text-xs text-neutral-400">
          Card is auto-detected from the Plaid match — just scan the receipt.
        </div>

        {/* Capture */}
        <div>
          <label className="text-sm font-semibold block mb-2">Receipts</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="h-11 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-sm font-semibold"
            >📷 Take picture</button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="h-11 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-sm font-semibold"
            >📎 Upload files</button>
          </div>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
          <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
        </div>

        {photos.length > 0 && !allDone && (
          <button
            onClick={runScanFlow}
            disabled={readingAll || anyUploading || anyBusy}
            className="w-full h-11 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
          >
            {readingAll
              ? 'Reading receipts…'
              : anyUploading
                ? 'Uploading photos…'
                : `Process ${photos.length} receipt${photos.length === 1 ? '' : 's'}`}
          </button>
        )}

        {globalError && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm p-3">{globalError}</div>
        )}

        {/* Photo cards */}
        <div className="space-y-3">
          {photos.map((p, idx) => (
            <div
              key={p.id}
              className={`rounded-xl border p-3 space-y-2 ${
                p.submitted && p.submittedAs === 'matched' ? 'border-green-600/50 bg-green-950/20'
                : p.submitted && p.submittedAs === 'duplicate' ? 'border-blue-500/50 bg-blue-950/20'
                : p.submitted && p.submittedAs === 'orphan' ? 'border-amber-600/50 bg-amber-950/20'
                : p.submitError ? 'border-red-600/50 bg-red-950/30'
                : 'border-neutral-800 bg-neutral-900'
              }`}
            >
              <div className="flex gap-3">
                <a href={p.driveViewUrl || '#'} target="_blank" rel="noreferrer" className="flex-shrink-0" onClick={(e) => { if (!p.driveViewUrl) e.preventDefault() }}>
                  <img src={p.thumbDataUrl} alt="receipt" className="h-24 w-24 object-cover rounded-lg border border-neutral-800" />
                </a>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-semibold truncate">Receipt {idx + 1}</div>
                  {p.uploading && <div className="text-neutral-400 text-xs">Uploading to Drive…</div>}
                  {p.uploadError && <div className="text-red-400 text-xs">Upload error: {p.uploadError}</div>}
                  {p.driveViewUrl && !p.uploading && <div className="text-green-400 text-xs">✓ Saved to Drive</div>}
                  {p.reading && <div className="text-neutral-400 text-xs">Reading receipt…</div>}
                  {p.syncing && <div className="text-neutral-400 text-xs">Syncing with credit card company…</div>}
                  {p.submitting && !p.syncing && <div className="text-neutral-400 text-xs">Filing expense…</div>}
                  {p.read && p.plaidMatch && (
                    <div className="text-xs text-green-400 mt-1">
                      ✓ Matched {p.plaidMatch.merchant} · ${p.plaidMatch.amount_usd?.toFixed?.(2)} · {p.plaidMatch.date}
                      {p.plaidMatch.source === 'cache' && <span className="text-neutral-400"> (cached)</span>}
                    </div>
                  )}
                  {p.read && !p.plaidMatch && !p.syncing && !p.submitting && (
                    <div className="text-xs text-amber-400 mt-1">
                      No Plaid match — will be filed as orphan for admin review.
                    </div>
                  )}
                  {p.submitted && p.submittedAs === 'matched' && (
                    <div className="text-green-400 text-xs mt-1">✓ Filed as expense (row {p.submittedRow})</div>
                  )}
                  {p.submitted && p.submittedAs === 'duplicate' && (
                    <div className="text-blue-300 text-xs mt-1">
                      ℹ️ Already logged by admin — no duplicate created.
                      {p.plaidMatch?.submitted_at && (
                        <span className="text-neutral-400"> ({String(p.plaidMatch.submitted_at).slice(0,10)})</span>
                      )}
                    </div>
                  )}
                  {p.submitted && p.submittedAs === 'orphan' && (
                    <div className="text-amber-300 text-xs mt-1">📥 Saved to orphan queue for admin</div>
                  )}
                  {p.submitError && <div className="text-red-400 text-xs mt-1">Error: {p.submitError}</div>}
                  {!p.submitted && !p.reading && !p.syncing && !p.submitting && (
                    <button
                      onClick={() => removePhoto(p.id)}
                      className="text-xs text-red-400 hover:underline mt-1"
                    >Remove</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {allDone && (
          <div className="rounded-lg border border-green-600/50 bg-green-950/30 p-3 space-y-2 text-sm">
            <div className="font-semibold text-green-300">All receipts processed</div>
            <div className="text-xs text-neutral-400">
              Matched: {photos.filter(p => p.submittedAs === 'matched').length} · Already logged: {photos.filter(p => p.submittedAs === 'duplicate').length} · Orphaned: {photos.filter(p => p.submittedAs === 'orphan').length}
            </div>
            <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="block text-red-400 hover:underline">
              Open Expenses spreadsheet →
            </a>
            <button
              onClick={() => { setPhotos([]); if (adminScanBack) adminScanBack(); else setLocation('/menu') }}
              className="w-full h-10 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-sm"
            >Done</button>
          </div>
        )}
      </div>
    </MenuLayout>
  )
}
