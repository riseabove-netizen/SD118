import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'
import { getCrewName, getRole, canWrite } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import { useLocation } from 'wouter'

type Account = 'Amex 3240' | 'Bilt'

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
  txn_id: string
  date: string
  merchant: string
  amount_usd: number
  currency: string
  category: string
  account_mask: string
  account_label: string
  account_matches_selection: boolean
} | null

type DuplicateHit = {
  isDuplicate: boolean
  matchedRow?: number
  matchedStore?: string
  matchedDate?: string
  matchedAccount?: string
  matchedUsd?: number | null
  matchedEur?: number | null
} | null

type Photo = {
  id: string
  base64: string        // no data: prefix
  thumbDataUrl: string  // data:image/jpeg;base64,... for preview
  file?: File
  // After upload:
  driveFileId?: string
  driveViewUrl?: string
  driveThumbUrl?: string
  // After OCR:
  read?: ReceiptRead
  plaidMatch?: PlaidMatch
  duplicate?: DuplicateHit
  // Editable form fields (populated from `read`, user can adjust)
  date: string          // YYYY-MM-DD
  merchant: string
  eur: string           // string so blank is allowed
  usd: string
  guestTrip: boolean    // toggle
  guestTripName: string // free text if guestTrip
  project: string       // e.g. Operating
  expenseType: string   // Category column D
  category: string      // Subcategory column E
  description: string
  refunded: string
  specificRepair: string
  statement: string
  // Status flags
  uploading?: boolean
  uploadError?: string
  reading?: boolean
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

// Determine default project/category/subcategory triple from Claude's coarse hint.
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

export function ExpenseIntakePage() {
  const [, setLocation] = useLocation()
  const role = getRole()
  const isAdmin = role === 'admin'
  const crewName = getCrewName() || ''

  // Not authenticated to write? Gate out.
  if (!canWrite()) {
    return (
      <MenuLayout title="Expense intake" showBack backHref="/menu">
        <p className="text-sm text-muted-foreground">You need crew or admin access to file expenses.</p>
      </MenuLayout>
    )
  }

  const [account, setAccount] = useState<Account>('Amex 3240')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [definitions, setDefinitions] = useState<DefRow[]>([])
  const [defsLoading, setDefsLoading] = useState(true)
  const [defsError, setDefsError] = useState<string | null>(null)
  const [readingAll, setReadingAll] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Load Definitions once.
  useEffect(() => {
    let cancelled = false
    fetch('/api/expense-definitions')
      .then(r => r.json())
      .then((data) => {
        if (cancelled) return
        if (!data?.ok) throw new Error(data?.error || 'Failed to load definitions')
        setDefinitions(data.rows as DefRow[])
      })
      .catch(err => { if (!cancelled) setDefsError(err?.message || String(err)) })
      .finally(() => { if (!cancelled) setDefsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Available definitions for this role.
  const visibleDefs = useMemo(() => {
    if (isAdmin) return definitions.filter(r => r.project === 'Operating')
    return definitions.filter(r => r.showToUser)
  }, [definitions, isAdmin])

  // Category tree for the picker: category → subcategories.
  const categoryTree = useMemo(() => {
    const tree = new Map<string, string[]>()
    for (const r of visibleDefs) {
      if (!tree.has(r.category)) tree.set(r.category, [])
      const arr = tree.get(r.category)!
      if (!arr.includes(r.subcategory)) arr.push(r.subcategory)
    }
    return tree
  }, [visibleDefs])

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
    // Kick off Drive upload in the background for each new one.
    for (const p of newPhotos) {
      uploadPhotoToDrive(p)
    }
  }

  const uploadPhotoToDrive = async (photo: Photo) => {
    updatePhoto(photo.id, { uploading: true, uploadError: undefined })
    try {
      const resp = await fetch('/api/expense-drive-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: photo.base64,
          account,
          date: photo.date,
        }),
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

  const updatePhoto = (id: string, patch: Partial<Photo>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const readAllReceipts = async () => {
    if (photos.length === 0) return
    setReadingAll(true)
    setGlobalError(null)
    // Mark all as reading
    setPhotos(prev => prev.map(p => ({ ...p, reading: true })))
    try {
      // Batch: send all base64 in one call so Claude can OCR them in one shot.
      const resp = await fetch('/api/expense-read-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: photos.map(p => ({ base64: p.base64, mime: 'image/jpeg' })),
        }),
      })
      const data = await resp.json()
      if (!data?.ok) throw new Error(data?.error || 'Read failed')
      const reads: ReceiptRead[] = data.receipts || []

      // Match every read receipt against Plaid cache AND check duplicates in parallel
      let matches: PlaidMatch[] = new Array(photos.length).fill(null)
      let duplicates: DuplicateHit[] = new Array(photos.length).fill(null)
      const matchQueries = photos.map((p, i) => {
        const r = reads[i]
        return {
          account,
          date: r?.date || p.date,
          eur: r?.eur ?? null,
          usd: r?.usd ?? null,
          merchant: r?.merchant ?? p.merchant ?? null,
        }
      })
      const dupQueries = photos.map((p, i) => {
        const r = reads[i]
        return {
          date: r?.date || p.date,
          store: r?.merchant || p.merchant || '',
          eur: r?.eur ?? null,
          usd: r?.usd ?? null,
        }
      })
      try {
        const [matchResp, dupResp] = await Promise.all([
          fetch('/api/expense-plaid-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: matchQueries }),
          }),
          fetch('/api/expense-duplicate-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: dupQueries }),
          }),
        ])
        const matchData = await matchResp.json()
        if (matchData?.ok && Array.isArray(matchData.matches)) matches = matchData.matches
        const dupData = await dupResp.json()
        if (dupData?.ok && Array.isArray(dupData.results)) duplicates = dupData.results
      } catch (matchErr: any) {
        console.warn('Plaid match / duplicate check failed:', matchErr?.message)
      }

      // Apply per-photo; blank USD when there is no Plaid match (no ECB fallback)
      const next: Photo[] = []
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]
        const r = reads[i]
        const m = matches[i]
        const dup = duplicates[i]
        if (!r) { next.push({ ...p, reading: false, plaidMatch: m, duplicate: dup }); continue }
        const cls = autoClassify(r.category_hint, false)
        // USD source of truth: Plaid match if any (even if it posted on the
        // OTHER card — the amount is still authoritative), else if receipt is
        // already printed in USD use that, else blank (per user rule).
        let usd: number | null = null
        if (m && Number.isFinite(m.amount_usd)) usd = m.amount_usd
        else if (r.usd != null) usd = r.usd
        next.push({
          ...p,
          reading: false,
          read: r,
          plaidMatch: m,
          duplicate: dup,
          merchant: r.merchant || p.merchant,
          date: r.date || p.date,
          eur: r.eur != null ? String(r.eur) : p.eur,
          usd: usd != null ? String(usd) : '',
          project: cls?.project || p.project,
          expenseType: cls?.expenseType || p.expenseType,
          category: cls?.category || p.category,
          description: r.notes || p.description,
        })
      }
      setPhotos(next)
    } catch (err: any) {
      setGlobalError(err?.message || String(err))
      setPhotos(prev => prev.map(p => ({ ...p, reading: false })))
    } finally {
      setReadingAll(false)
    }
  }

  const setPhotoField = (id: string, field: keyof Photo, value: any) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const setPhotoGuestTrip = (id: string, isGuest: boolean) => {
    setPhotos(prev => prev.map(p => {
      if (p.id !== id) return p
      // Re-run auto-classify with new guest-trip flag if we have a category_hint
      const hint = p.read?.category_hint || null
      const cls = autoClassify(hint, isGuest)
      return {
        ...p,
        guestTrip: isGuest,
        project: cls?.project || p.project,
        expenseType: cls?.expenseType || p.expenseType,
        category: cls?.category || p.category,
      }
    }))
  }

  // Subcategories for a given photo's expenseType
  const subsForPhoto = (p: Photo): string[] => {
    return categoryTree.get(p.expenseType) || []
  }

  const submitAll = async () => {
    // Validate all photos have driveViewUrl + expenseType + category + at least one amount
    setGlobalError(null)
    const invalid = photos.find(p => !p.driveViewUrl || !p.expenseType || !p.category || (!p.usd && !p.eur))
    if (invalid) {
      setGlobalError('Every receipt needs a category, subcategory and an amount before submitting.')
      return
    }
    setPhotos(prev => prev.map(p => ({ ...p, submitting: true, submitError: undefined })))
    try {
      const payload = {
        expenses: photos.map(p => ({
          date: p.date,
          account,
          project: p.project || 'Operating',
          expenseType: p.expenseType,
          category: p.category,
          guestTrip: p.guestTrip ? (p.guestTripName || 'Yes') : '',
          store: p.merchant,
          usd: p.usd ? Number(p.usd) : null,
          eur: p.eur ? Number(p.eur) : null,
          refunded: p.refunded,
          description: p.description,
          specificRepair: p.specificRepair,
          statement: p.statement,
          inputBy: crewName || 'Unknown',
          receiptUrl: p.driveViewUrl || '',
        })),
      }
      const resp = await fetch('/api/expense-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      if (!data?.ok) {
        // Partial success possible
        const errs = data?.errors || []
        setPhotos(prev => prev.map((p, i) => ({
          ...p,
          submitting: false,
          submitted: !errs.find((e: any) => e.index === i),
          submittedRow: data?.inserted?.find((r: any, idx: number) => idx === i)?.row,
          submitError: errs.find((e: any) => e.index === i)?.error,
        })))
        setGlobalError(data?.error || 'Some rows failed to submit')
        return
      }
      // All good
      setPhotos(prev => prev.map((p, i) => ({
        ...p,
        submitting: false,
        submitted: true,
        submittedRow: data.inserted?.[i]?.row,
      })))
    } catch (err: any) {
      setPhotos(prev => prev.map(p => ({ ...p, submitting: false, submitError: err?.message || String(err) })))
      setGlobalError(err?.message || String(err))
    }
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk/edit#gid=734695797`
  const allSubmitted = photos.length > 0 && photos.every(p => p.submitted)

  return (
    <MenuLayout title="Expense intake" showBack backHref="/menu">
      <div className="space-y-4">
        {/* Account */}
        <div>
          <label className="text-sm font-semibold block mb-2">Card / Account</label>
          <div className="grid grid-cols-2 gap-2">
            {(['Amex 3240', 'Bilt'] as Account[]).map(a => (
              <button
                key={a}
                onClick={() => setAccount(a)}
                className={`h-11 rounded-lg border font-semibold transition-colors ${
                  account === a
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-card border-border text-foreground hover:bg-secondary'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Capture / Upload */}
        <div>
          <label className="text-sm font-semibold block mb-2">Receipts</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="h-11 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-semibold"
            >
              📷 Take picture
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="h-11 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-semibold"
            >
              📎 Upload files
            </button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>

        {/* Read receipts button */}
        {photos.length > 0 && !allSubmitted && (
          <button
            onClick={readAllReceipts}
            disabled={readingAll || photos.some(p => p.uploading)}
            className="w-full h-11 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
          >
            {readingAll
              ? 'Reading…'
              : photos.some(p => p.uploading)
                ? 'Uploading photos…'
                : `Read ${photos.length} receipt${photos.length === 1 ? '' : 's'}`}
          </button>
        )}

        {globalError && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 text-red-200 text-sm p-3">
            {globalError}
          </div>
        )}

        {defsError && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-200 text-sm p-3">
            Categories failed to load: {defsError}
          </div>
        )}

        {/* Photo cards */}
        <div className="space-y-4">
          {photos.map((p, idx) => {
            const subs = subsForPhoto(p)
            const categories = Array.from(categoryTree.keys())
            return (
              <div key={p.id} className={`rounded-xl border p-3 space-y-3 ${p.submitted ? 'border-green-600/50 bg-green-950/20' : 'border-border bg-card'}`}>
                <div className="flex gap-3">
                  <a
                    href={p.driveViewUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block flex-shrink-0"
                    onClick={(e) => { if (!p.driveViewUrl) e.preventDefault() }}
                  >
                    <img src={p.thumbDataUrl} alt="receipt" className="h-24 w-24 object-cover rounded-lg border border-border" />
                  </a>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-semibold truncate">Receipt {idx + 1}</div>
                    {p.uploading && <div className="text-muted-foreground text-xs">Uploading to Drive…</div>}
                    {p.uploadError && <div className="text-red-400 text-xs">Upload error: {p.uploadError}</div>}
                    {p.driveViewUrl && <div className="text-green-400 text-xs">✓ Saved to Drive</div>}
                    {p.reading && <div className="text-muted-foreground text-xs">Reading…</div>}
                    {p.read && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {p.plaidMatch
                          ? (p.plaidMatch.account_matches_selection
                              ? <span className="text-green-400">✓ Matched {p.plaidMatch.merchant} ${p.plaidMatch.amount_usd.toFixed(2)} on {p.plaidMatch.date}</span>
                              : <span className="text-red-400 font-semibold">⚠ Charge posted on {p.plaidMatch.account_label} (not {account}) — ${p.plaidMatch.amount_usd.toFixed(2)} at {p.plaidMatch.merchant}. Switch account above.</span>)
                          : p.read.currency_hint === 'USD' && p.read.usd != null
                            ? 'Priced in USD (no Plaid match)'
                            : <span className="text-amber-400">No Plaid match — fill USD manually or reconcile later</span>}
                      </div>
                    )}
                    {p.duplicate?.isDuplicate && (
                      <div className="text-xs mt-1 rounded bg-red-950/40 border border-red-800 text-red-300 px-2 py-1">
                        ⚠ Possible duplicate of row {p.duplicate.matchedRow} ({p.duplicate.matchedStore} · {p.duplicate.matchedDate} · {p.duplicate.matchedAccount}
                        {p.duplicate.matchedUsd != null ? ` · $${p.duplicate.matchedUsd.toFixed(2)}` : ''}
                        {p.duplicate.matchedEur != null ? ` · €${p.duplicate.matchedEur.toFixed(2)}` : ''}
                        ). Confirm before submitting.
                      </div>
                    )}
                    {p.submitted && <div className="text-green-400 text-xs">✓ Submitted (row {p.submittedRow})</div>}
                    {p.submitError && <div className="text-red-400 text-xs">Submit error: {p.submitError}</div>}
                    {!p.submitted && (
                      <button
                        onClick={() => removePhoto(p.id)}
                        className="text-xs text-red-400 hover:underline mt-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Fields */}
                {!p.submitted && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Merchant</label>
                      <input
                        type="text"
                        value={p.merchant}
                        onChange={(e) => setPhotoField(p.id, 'merchant', e.target.value)}
                        className="w-full h-10 px-2 rounded border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Date</label>
                      <input
                        type="date"
                        value={p.date}
                        onChange={(e) => setPhotoField(p.id, 'date', e.target.value)}
                        className="w-full h-10 px-2 rounded border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Guest trip?</label>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => setPhotoGuestTrip(p.id, false)}
                          className={`flex-1 h-10 rounded border font-semibold ${!p.guestTrip ? 'bg-red-600 text-white border-red-600' : 'border-border bg-card'}`}
                        >No</button>
                        <button
                          onClick={() => setPhotoGuestTrip(p.id, true)}
                          className={`flex-1 h-10 rounded border font-semibold ${p.guestTrip ? 'bg-red-600 text-white border-red-600' : 'border-border bg-card'}`}
                        >Yes</button>
                      </div>
                    </div>
                    {p.guestTrip && (
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Guest trip name</label>
                        <input
                          type="text"
                          value={p.guestTripName}
                          onChange={(e) => setPhotoField(p.id, 'guestTripName', e.target.value)}
                          className="w-full h-10 px-2 rounded border border-border bg-background"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground">EUR</label>
                      <input
                        type="number"
                        step="0.01"
                        value={p.eur}
                        onChange={(e) => setPhotoField(p.id, 'eur', e.target.value)}
                        className="w-full h-10 px-2 rounded border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">USD</label>
                      <input
                        type="number"
                        step="0.01"
                        value={p.usd}
                        onChange={(e) => setPhotoField(p.id, 'usd', e.target.value)}
                        className="w-full h-10 px-2 rounded border border-border bg-background"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Category</label>
                      <select
                        value={p.expenseType}
                        onChange={(e) => setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, expenseType: e.target.value, category: '' } : x))}
                        className="w-full h-10 px-2 rounded border border-border bg-background"
                      >
                        <option value="">— pick —</option>
                        {categories.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Subcategory</label>
                      <select
                        value={p.category}
                        onChange={(e) => setPhotoField(p.id, 'category', e.target.value)}
                        disabled={!p.expenseType}
                        className="w-full h-10 px-2 rounded border border-border bg-background disabled:opacity-50"
                      >
                        <option value="">{p.expenseType ? '— pick —' : 'Pick category first'}</option>
                        {subs.map(s => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Description (optional)</label>
                      <input
                        type="text"
                        value={p.description}
                        onChange={(e) => setPhotoField(p.id, 'description', e.target.value)}
                        className="w-full h-10 px-2 rounded border border-border bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Submit */}
        {photos.length > 0 && !allSubmitted && photos.some(p => p.read) && (
          <button
            onClick={submitAll}
            disabled={photos.some(p => p.submitting || p.uploading)}
            className="w-full h-12 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
          >
            {photos.some(p => p.submitting) ? 'Submitting…' : `Submit ${photos.length} expense${photos.length === 1 ? '' : 's'} to sheet`}
          </button>
        )}

        {allSubmitted && (
          <div className="rounded-lg border border-green-600/50 bg-green-950/30 p-3 space-y-2 text-sm">
            <div className="font-semibold text-green-300">All expenses submitted ✓</div>
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-red-400 hover:underline"
            >
              Open SD118 Expenses spreadsheet →
            </a>
            <button
              onClick={() => { setPhotos([]); setLocation('/menu') }}
              className="w-full h-10 rounded-lg border border-border bg-card hover:bg-secondary text-sm"
            >
              Back to menu
            </button>
          </div>
        )}
      </div>
    </MenuLayout>
  )
}

export default ExpenseIntakePage
