// "Perform maintenance" flow.
//
// Two-step wizard:
//   Step 1: pick system + one-or-more kits (multi-select checkbox).
//           When the URL carries ?systemId=..., that system is preselected.
//   Step 2: fill out the unified checklist, pick inventory items used
//           (searchable across the Spares + Consumables tabs), attach
//           photos and optional sub-contractor PDF, then submit.
//
// On submit, the backend builds a PDF, uploads to Drive under the
// system's driveFolderPath, and appends a row to MaintenanceLog.

import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { getCrewName } from '@/lib/auth'
import {
  MAINTENANCE_SYSTEMS,
  MaintenanceSystem,
  MaintenanceKit,
  unionChecklists,
  UnifiedChecklistItem,
} from '@/data/maintenance-systems'
import { fetchSystemState, submitMaintenanceLog, fileToBase64 } from '@/lib/maintenance-api'

// ---------------- inventory search ----------------

interface InventoryItem {
  rowIndex: number
  Item?: string
  Name?: string
  Description?: string
  PartNumber?: string
  'Part Number'?: string
  Location?: string
  Quantity?: string
  Qty?: string
  Category?: string
  [key: string]: any
}

async function loadInventoryTab(tab: 'Spares' | 'Consumables'): Promise<InventoryItem[]> {
  try {
    const r = await fetch(`/api/inventory-list?tab=${tab}`, { credentials: 'include' })
    if (!r.ok) return []
    const j = await r.json()
    const items: InventoryItem[] = j.items || []
    return items.map(it => ({ ...it, _tab: tab }))
  } catch {
    return []
  }
}

function displayName(it: InventoryItem): string {
  return String(it.Item || it.Name || it.Description || '(unnamed)')
}
function partNumber(it: InventoryItem): string {
  return String(it.PartNumber || it['Part Number'] || '')
}

// ---------------- component ----------------

interface SelectedInventory {
  key: string
  name: string
  partNumber?: string
  qty: number
}

interface PhotoDraft {
  base64: string
  preview: string
  label: string
}

export function PerformMaintenancePage() {
  const [location, setLocation] = useLocation()
  const crewName = getCrewName() || ''

  // Query param -> initial systemId
  const initialSystemId = useMemo(() => {
    const q = new URLSearchParams(location.split('?')[1] || '')
    return q.get('systemId') || ''
  }, [location])

  const [step, setStep] = useState<'pick' | 'perform'>(initialSystemId ? 'perform' : 'pick')
  const [systemId, setSystemId] = useState<string>(initialSystemId)
  const [selectedKits, setSelectedKits] = useState<string[]>([])
  const [currentHours, setCurrentHours] = useState<number | null>(null)

  const system = useMemo(() => MAINTENANCE_SYSTEMS.find(s => s.id === systemId), [systemId])
  const activeSystems = MAINTENANCE_SYSTEMS.filter(s => s.kits.length > 0)

  // Fetch current hours when a system is picked, so the "hours at service"
  // field pre-fills. Only active systems (with kits) actually go to the
  // API — others get 0 as a placeholder.
  useEffect(() => {
    let cancelled = false
    if (!system) { setCurrentHours(null); return }
    async function load() {
      try {
        const state = await fetchSystemState(system!.id)
        if (!cancelled) {
          setCurrentHours(state.currentHours ?? system!.initialHoursHint ?? 0)
        }
      } catch {
        if (!cancelled) setCurrentHours(system!.initialHoursHint ?? 0)
      }
    }
    load()
    return () => { cancelled = true }
  }, [system?.id])

  return (
    <MenuLayout title="Perform maintenance" showBack backHref="/maintenance">
      {step === 'pick' ? (
        <PickStep
          activeSystems={activeSystems}
          systemId={systemId}
          setSystemId={setSystemId}
          selectedKits={selectedKits}
          setSelectedKits={setSelectedKits}
          onContinue={() => {
            if (!systemId) return
            if (selectedKits.length === 0) return
            setStep('perform')
          }}
        />
      ) : system ? (
        <PerformStep
          system={system}
          selectedKits={selectedKits}
          setSelectedKits={setSelectedKits}
          currentHours={currentHours}
          crewName={crewName}
          onBack={() => setStep('pick')}
          onDone={eventId => {
            setLocation(`/maintenance/generator/${system.side || ''}`.replace(/\/$/, '') || `/maintenance/system/${system.id}`)
          }}
        />
      ) : (
        <div className="text-sm text-muted-foreground">System not selected.</div>
      )}
    </MenuLayout>
  )
}

// ---------------- pick step ----------------

interface PickProps {
  activeSystems: MaintenanceSystem[]
  systemId: string
  setSystemId(id: string): void
  selectedKits: string[]
  setSelectedKits(k: string[]): void
  onContinue(): void
}

function PickStep({ activeSystems, systemId, setSystemId, selectedKits, setSelectedKits, onContinue }: PickProps) {
  const system = activeSystems.find(s => s.id === systemId)

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          1. Select system
        </div>
        <div className="space-y-2">
          {activeSystems.map(s => (
            <label
              key={s.id}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                systemId === s.id ? 'border-red-500 bg-red-500/5' : 'border-border bg-card hover:bg-secondary'
              }`}
            >
              <input
                type="radio"
                className="accent-red-600"
                checked={systemId === s.id}
                onChange={() => { setSystemId(s.id); setSelectedKits([]) }}
              />
              <span className="text-lg">{s.icon}</span>
              <span className="text-sm font-medium flex-1">{s.label}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          More systems will unlock as we fill in their service intervals.
        </p>
      </div>

      {system && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            2. Which kit(s)?
          </div>
          <div className="space-y-2">
            {system.kits.map(kit => (
              <label
                key={kit.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-red-600"
                  checked={selectedKits.includes(kit.id)}
                  onChange={e => {
                    if (e.target.checked) setSelectedKits([...selectedKits, kit.id])
                    else setSelectedKits(selectedKits.filter(k => k !== kit.id))
                  }}
                />
                <span className="flex-1">
                  <span className="text-sm font-semibold block">{kit.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {kit.checklist.length} item{kit.checklist.length === 1 ? '' : 's'}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Pick more than one when multiple kits fall on the same milestone (e.g. 2000 h = 250 + 500 + 2000).
          </p>
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={!systemId || selectedKits.length === 0}
        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-sm"
      >
        Continue
      </button>
    </div>
  )
}

// ---------------- perform step ----------------

interface PerformProps {
  system: MaintenanceSystem
  selectedKits: string[]
  setSelectedKits(k: string[]): void
  currentHours: number | null
  crewName: string
  onBack(): void
  onDone(eventId: string): void
}

function PerformStep({ system, selectedKits, setSelectedKits, currentHours, crewName, onBack, onDone }: PerformProps) {
  const kits = system.kits.filter(k => selectedKits.includes(k.id))
  const unified: UnifiedChecklistItem[] = useMemo(
    () => unionChecklists(system, selectedKits),
    [system.id, selectedKits.join(',')]
  )
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [hoursAtService, setHoursAtService] = useState<string>(String(currentHours ?? ''))
  const [technician, setTechnician] = useState<string>(crewName)
  const [notes, setNotes] = useState('')
  const [inventoryPicked, setInventoryPicked] = useState<SelectedInventory[]>([])
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [attachedPdf, setAttachedPdf] = useState<{ base64: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (hoursAtService === '' && currentHours != null) {
      setHoursAtService(String(currentHours))
    }
  }, [currentHours])

  function toggleItem(id: string) {
    const next = new Set(checkedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCheckedIds(next)
  }

  async function onPickPhotos(fileList: FileList | null) {
    if (!fileList) return
    const drafts: PhotoDraft[] = []
    for (const f of Array.from(fileList)) {
      if (!f.type.startsWith('image/')) continue
      try {
        const base64 = await fileToBase64(f)
        drafts.push({ base64, preview: `data:${f.type};base64,${base64}`, label: f.name })
      } catch {}
    }
    setPhotos(prev => [...prev, ...drafts])
  }

  async function onPickPdf(f: File | null) {
    if (!f) return
    try {
      const base64 = await fileToBase64(f)
      setAttachedPdf({ base64, name: f.name })
    } catch {}
  }

  async function submit() {
    if (!hoursAtService) { setErrorMsg('Hours at service is required.'); return }
    if (!technician.trim()) { setErrorMsg('Technician name is required.'); return }
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const checklist = unified.map(u => ({
        label: u.label,
        kitShortLabel: u.kitShortLabel,
        done: checkedIds.has(`${u.kitId}:${u.id}`),
        notes: itemNotes[`${u.kitId}:${u.id}`] || undefined,
      }))
      const resp = await submitMaintenanceLog({
        systemId: system.id,
        systemLabel: system.label,
        driveFolderPath: system.driveFolderPath,
        kitIds: selectedKits,
        kitLabels: kits.map(k => k.label),
        hoursAtService: Number(hoursAtService),
        technician: technician.trim(),
        notes: notes.trim(),
        checklist,
        inventory: inventoryPicked.map(i => ({ name: i.name, qty: i.qty, partNumber: i.partNumber })),
        photos: photos.map(p => ({ base64: p.base64, label: p.label })),
        attachedPdfBase64: attachedPdf?.base64 || null,
        attachedPdfFileName: attachedPdf?.name || null,
      })
      setSuccessMsg(`Saved ${resp.eventId}. PDF uploaded.`)
      setTimeout(() => onDone(resp.eventId), 800)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              System
            </div>
            <div className="text-sm font-semibold">{system.label}</div>
            <div className="text-xs text-muted-foreground">
              {kits.map(k => k.label).join(' + ') || '—'}
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary"
          >
            Change
          </button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Hours at service</span>
            <input
              type="number"
              inputMode="numeric"
              value={hoursAtService}
              onChange={e => setHoursAtService(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Technician</span>
            <input
              type="text"
              value={technician}
              onChange={e => setTechnician(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="text-xs block">
          <span className="block text-muted-foreground mb-1">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Anything the next tech should know…"
          />
        </label>
      </div>

      {/* Checklist */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">Checklist ({unified.length})</div>
        <div className="space-y-2">
          {unified.map(item => {
            const key = `${item.kitId}:${item.id}`
            const checked = checkedIds.has(key)
            return (
              <div key={key} className="rounded-md border border-border/60 p-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 accent-red-600"
                    checked={checked}
                    onChange={() => toggleItem(key)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm ${checked ? 'text-foreground' : 'text-foreground/90'}`}>
                        {item.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/40 text-red-300">
                        {item.kitShortLabel}
                      </span>
                    </div>
                    {item.detail && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.detail}</div>
                    )}
                  </div>
                </label>
                {checked && (
                  <input
                    type="text"
                    value={itemNotes[key] || ''}
                    onChange={e => setItemNotes({ ...itemNotes, [key]: e.target.value })}
                    placeholder="Notes for this step (optional)"
                    className="w-full mt-2 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Inventory picker */}
      <InventoryPicker picked={inventoryPicked} setPicked={setInventoryPicked} />

      {/* Photos */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">Photos</div>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={e => onPickPhotos(e.target.files)}
          className="text-xs"
        />
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img src={p.preview} className="w-full h-24 object-cover rounded-md border border-border" />
                <button
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-contractor PDF */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">Attach PDF (sub-contractor invoice, quote, etc.)</div>
        <input
          type="file"
          accept="application/pdf"
          onChange={e => onPickPdf(e.target.files?.[0] || null)}
          className="text-xs"
        />
        {attachedPdf && (
          <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>{attachedPdf.name}</span>
            <button
              onClick={() => setAttachedPdf(null)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary"
            >
              Remove
            </button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Merged as extra pages into the final maintenance PDF.
        </p>
      </div>

      {/* Errors + submit */}
      {errorMsg && <div className="text-xs text-red-400">{errorMsg}</div>}
      {successMsg && <div className="text-xs text-emerald-300">{successMsg}</div>}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-sm"
      >
        {submitting ? 'Saving…' : 'Save maintenance record'}
      </button>
    </div>
  )
}

// ---------------- inventory picker sub-component ----------------

function InventoryPicker({ picked, setPicked }: { picked: SelectedInventory[]; setPicked(p: SelectedInventory[]): void }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([loadInventoryTab('Spares'), loadInventoryTab('Consumables')])
      .then(([a, b]) => {
        if (cancelled) return
        setItems([...a, ...b])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return items
      .filter(it => {
        const hay = `${displayName(it)} ${partNumber(it)} ${it.Category || ''}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 12)
  }, [items, query])

  function addItem(it: InventoryItem) {
    const key = `${(it as any)._tab || ''}:${it.rowIndex}`
    if (picked.some(p => p.key === key)) return
    setPicked([
      ...picked,
      { key, name: displayName(it), partNumber: partNumber(it) || undefined, qty: 1 },
    ])
    setQuery('')
  }

  function updateQty(key: string, qty: number) {
    setPicked(picked.map(p => p.key === key ? { ...p, qty } : p))
  }

  function remove(key: string) {
    setPicked(picked.filter(p => p.key !== key))
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="text-sm font-semibold">Inventory used</div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={loading ? 'Loading inventory…' : 'Search spares & consumables…'}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {results.length > 0 && (
        <div className="border border-border rounded-md divide-y divide-border/60 max-h-56 overflow-y-auto">
          {results.map((it, i) => (
            <button
              key={`${(it as any)._tab}-${it.rowIndex}-${i}`}
              onClick={() => addItem(it)}
              className="w-full text-left px-3 py-2 hover:bg-secondary text-xs"
            >
              <div className="font-medium">{displayName(it)}</div>
              <div className="text-muted-foreground">
                {partNumber(it) ? `P/N ${partNumber(it)} · ` : ''}
                {(it as any)._tab}
                {it.Location ? ` · ${it.Location}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      {picked.length > 0 && (
        <ul className="space-y-1.5">
          {picked.map(p => (
            <li key={p.key} className="flex items-center gap-2 text-xs">
              <span className="flex-1 min-w-0 truncate">
                <span className="font-medium">{p.name}</span>
                {p.partNumber && <span className="text-muted-foreground"> · P/N {p.partNumber}</span>}
              </span>
              <input
                type="number"
                min={0}
                value={p.qty}
                onChange={e => updateQty(p.key, Number(e.target.value) || 0)}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <button
                onClick={() => remove(p.key)}
                className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
