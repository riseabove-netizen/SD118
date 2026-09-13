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
import {
  buildCustomPickerGroups,
  findPickerSystem,
  PickerGroup,
  PickerSystem,
} from '@/data/all-systems-picker'
import { fetchSystemState, submitMaintenanceLog, fileToBase64 } from '@/lib/maintenance-api'
import { ZincRodsGuide, isZincRodItem } from '@/components/ZincRodsGuide'

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
  addToPurchase: boolean
  sourceTab?: string
  sourceRow?: number
}

interface PhotoDraft {
  base64: string
  preview: string
  label: string
}

export function PerformMaintenancePage() {
  const [location, setLocation] = useLocation()
  const crewName = getCrewName() || ''

  // Query param -> initial systemId + optional ?mode=custom to jump
  // straight into the free-form repair form (used by the "Log custom
  // repair" button on each system detail page).
  const initialSystemId = useMemo(() => {
    const q = new URLSearchParams(location.split('?')[1] || '')
    return q.get('systemId') || ''
  }, [location])
  const initialCustom = useMemo(() => {
    const q = new URLSearchParams(location.split('?')[1] || '')
    return q.get('mode') === 'custom'
  }, [location])

  const [step, setStep] = useState<'pick' | 'perform'>(initialSystemId ? 'perform' : 'pick')
  const [systemId, setSystemId] = useState<string>(initialSystemId)
  const [selectedKits, setSelectedKits] = useState<string[]>(initialCustom ? ['custom'] : [])
  const [customTitle, setCustomTitle] = useState<string>('')
  const [currentHours, setCurrentHours] = useState<number | null>(null)

  const system = useMemo(() => MAINTENANCE_SYSTEMS.find(s => s.id === systemId), [systemId])
  const pickerGroups = useMemo(() => buildCustomPickerGroups(), [])
  // For custom repairs on calendar-only systems (jetski, tender, chillers…)
  // we don't have a MaintenanceSystem — synthesize a lightweight one so the
  // downstream PerformStep can render its header + submit to the log API.
  const pickerHit = useMemo(() => findPickerSystem(systemId), [systemId])
  const syntheticSystem: MaintenanceSystem | undefined = useMemo(() => {
    if (system) return undefined
    if (!pickerHit || pickerHit.kind !== 'calendar') return undefined
    return {
      id: pickerHit.id,
      parentId: pickerHit.id.split('#')[0],
      kind: 'ac' as any, // synthetic — not used for kit math since kits=[]
      label: pickerHit.label,
      driveFolderPath: pickerHit.driveFolderPath,
      icon: pickerHit.icon,
      kits: [],
    }
  }, [system, pickerHit])
  const effectiveSystem = system || syntheticSystem
  const isCalendarSystem = !system && !!syntheticSystem
  const activeSystems = MAINTENANCE_SYSTEMS.filter(s => s.kits.length > 0)
  const isCustom = selectedKits.length === 1 && selectedKits[0] === 'custom'

  // Fetch current hours when a system is picked, so the "hours at service"
  // field pre-fills. Only active hour-based systems actually go to the
  // API — calendar systems get null (the field is hidden).
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
          pickerGroups={pickerGroups}
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
      ) : effectiveSystem ? (
        <PerformStep
          system={effectiveSystem}
          selectedKits={selectedKits}
          setSelectedKits={setSelectedKits}
          isCustom={isCustom}
          isCalendarSystem={isCalendarSystem}
          customTitle={customTitle}
          setCustomTitle={setCustomTitle}
          currentHours={currentHours}
          crewName={crewName}
          onBack={() => setStep('pick')}
          onDone={eventId => {
            void eventId
            if (isCalendarSystem) {
              // Route back to the calendar system detail page. Strip any
              // #unit suffix — the CalendarSystem page keys off the base id.
              const baseId = effectiveSystem.id.split('#')[0]
              setLocation(`/maintenance/calendar/${baseId}`)
            } else if (system && system.kind === 'generator' && system.side) {
              setLocation(`/maintenance/generator/${system.side}`)
            } else if (system) {
              setLocation(`/maintenance/system/${system.id}`)
            } else {
              setLocation('/maintenance')
            }
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
  pickerGroups: PickerGroup[]
  systemId: string
  setSystemId(id: string): void
  selectedKits: string[]
  setSelectedKits(k: string[]): void
  onContinue(): void
}

function PickStep({ activeSystems, pickerGroups, systemId, setSystemId, selectedKits, setSelectedKits, onContinue }: PickProps) {
  const isCustom = selectedKits.length === 1 && selectedKits[0] === 'custom'

  // Which parent group is expanded (side picker) when in custom mode.
  // Defaults to whichever group owns the currently-selected systemId.
  const initialParent = useMemo(() => {
    if (!systemId) return ''
    for (const g of pickerGroups) {
      if (g.systems.some(s => s.id === systemId)) return g.parentId
    }
    return ''
  }, [systemId, pickerGroups])
  const [openParent, setOpenParent] = useState<string>(initialParent)
  useEffect(() => { if (initialParent && !openParent) setOpenParent(initialParent) }, [initialParent])

  // Non-custom (hour-based scheduled kits): keep the original flat list —
  // kits are what drive the picker in that mode.
  const system = activeSystems.find(s => s.id === systemId)

  if (!isCustom) {
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
          <KitPicker system={system} selectedKits={selectedKits} setSelectedKits={setSelectedKits} />
        )}

        <ContinueButtons
          isCustom={false}
          canContinue={!!systemId && selectedKits.length > 0}
          onContinue={onContinue}
          onToggleCustom={() => setSelectedKits(['custom'])}
        />
      </div>
    )
  }

  // Custom mode: hierarchical group -> side picker.
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          1. Select system
        </div>
        <div className="space-y-2">
          {pickerGroups.map(g => {
            const groupSelected = g.systems.some(s => s.id === systemId)
            const isOpen = openParent === g.parentId || groupSelected
            const atomic = g.systems.length === 1
            const only = g.systems[0]
            return (
              <div
                key={g.parentId}
                className={`rounded-xl border ${groupSelected ? 'border-red-500 bg-red-500/5' : 'border-border bg-card'}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (atomic) {
                      setSystemId(only.id)
                      setOpenParent(g.parentId)
                    } else {
                      setOpenParent(isOpen ? '' : g.parentId)
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <input
                    type="radio"
                    className="accent-red-600 pointer-events-none"
                    readOnly
                    checked={groupSelected}
                  />
                  <span className="text-lg">{g.icon}</span>
                  <span className="text-sm font-medium flex-1">{g.label}</span>
                  {!atomic && (
                    <span className="text-xs text-muted-foreground">
                      {isOpen ? '▾' : '▸'} {g.systems.length}
                    </span>
                  )}
                </button>
                {!atomic && isOpen && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {g.systems.map(s => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-md border cursor-pointer text-xs ${
                          systemId === s.id
                            ? 'border-red-500/60 bg-red-500/10 text-foreground'
                            : 'border-border bg-background hover:bg-secondary text-foreground/80'
                        }`}
                      >
                        <input
                          type="radio"
                          className="accent-red-600"
                          checked={systemId === s.id}
                          onChange={() => setSystemId(s.id)}
                        />
                        <span className="flex-1">{s.sideLabel || s.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Pick any system to log a one-off repair. Groups with multiple units
          (main engines, generators, watermakers, chillers…) expand to let you
          pick which side.
        </p>
      </div>

      <ContinueButtons
        isCustom={true}
        canContinue={!!systemId}
        onContinue={onContinue}
        onToggleCustom={() => setSelectedKits([])}
      />
    </div>
  )
}

function ContinueButtons({
  isCustom, canContinue, onContinue, onToggleCustom,
}: {
  isCustom: boolean
  canContinue: boolean
  onContinue(): void
  onToggleCustom(): void
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-sm"
      >
        Continue
      </button>
      <button
        type="button"
        onClick={onToggleCustom}
        className={`w-full py-2.5 rounded-xl border text-sm font-medium ${
          isCustom
            ? 'border-red-500 bg-red-500/10 text-red-300'
            : 'border-border bg-card hover:bg-secondary text-foreground'
        }`}
      >
        {isCustom ? '✓ Custom / one-off repair (tap to cancel)' : '🔧 Log custom / one-off repair'}
      </button>
    </div>
  )
}

function KitPicker({
  system, selectedKits, setSelectedKits,
}: {
  system: MaintenanceSystem
  selectedKits: string[]
  setSelectedKits(k: string[]): void
}) {
  return (
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
  )
}

// ---------------- perform step ----------------

interface PerformProps {
  system: MaintenanceSystem
  selectedKits: string[]
  setSelectedKits(k: string[]): void
  isCustom: boolean
  isCalendarSystem: boolean
  customTitle: string
  setCustomTitle(v: string): void
  currentHours: number | null
  crewName: string
  onBack(): void
  onDone(eventId: string): void
}

function PerformStep({ system, selectedKits, setSelectedKits, isCustom, isCalendarSystem, customTitle, setCustomTitle, currentHours, crewName, onBack, onDone }: PerformProps) {
  const kits = system.kits.filter(k => selectedKits.includes(k.id))
  const unified: UnifiedChecklistItem[] = useMemo(
    () => (isCustom ? [] : unionChecklists(system, selectedKits)),
    [system.id, selectedKits.join(','), isCustom]
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
  const [zincGuideOpen, setZincGuideOpen] = useState(false)

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
    if (!isCalendarSystem && !hoursAtService) { setErrorMsg('Hours at service is required.'); return }
    if (!technician.trim()) { setErrorMsg('Technician name is required.'); return }
    if (isCustom && !customTitle.trim()) { setErrorMsg('Please give this repair a short title.'); return }
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
        kitIds: isCustom ? ['custom'] : selectedKits,
        kitLabels: isCustom ? [`Custom repair: ${customTitle.trim()}`] : kits.map(k => k.label),
        hoursAtService: isCalendarSystem
          ? (hoursAtService ? Number(hoursAtService) : 0)
          : Number(hoursAtService),
        technician: technician.trim(),
        notes: isCustom
          ? (customTitle.trim() + (notes.trim() ? `\n\n${notes.trim()}` : ''))
          : notes.trim(),
        checklist: isCustom ? [] : checklist,
        inventory: inventoryPicked.map(i => ({ name: i.name, qty: i.qty, partNumber: i.partNumber })),
        photos: photos.map(p => ({ base64: p.base64, label: p.label })),
        attachedPdfBase64: attachedPdf?.base64 || null,
        attachedPdfFileName: attachedPdf?.name || null,
      })

      // Fire-and-forget: push flagged items to the purchase list. Non-fatal.
      const flagged = inventoryPicked.filter(i => i.addToPurchase)
      if (flagged.length > 0) {
        try {
          const { addToPurchaseList } = await import('@/lib/purchase-list-api')
          await addToPurchaseList(
            flagged.map(i => ({
              name: i.name,
              partNumber: i.partNumber,
              qty: i.qty,
              sourceTab: i.sourceTab,
              sourceRow: i.sourceRow,
            })),
            { addedBy: technician.trim() || crewName, sourceEventId: resp.eventId }
          )
        } catch (e) {
          console.warn('Purchase list add failed (non-fatal):', e)
        }
      }

      setSuccessMsg(
        `Saved ${resp.eventId}. PDF uploaded.` +
        (flagged.length > 0 ? ` ${flagged.length} item(s) queued for the purchase list.` : '')
      )
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
              {isCustom
                ? 'Custom / one-off repair'
                : kits.map(k => k.label).join(' + ') || '—'}
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

      {/* Custom repair title (only in custom mode) */}
      {isCustom && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 space-y-3">
          <label className="text-xs block">
            <span className="block text-muted-foreground mb-1 uppercase tracking-wider">
              Repair title *
            </span>
            <input
              type="text"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder="e.g. Replaced impeller on raw-water pump"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              maxLength={120}
            />
            <span className="block text-[10px] text-muted-foreground mt-1">
              Short summary. Full details go in Notes below.
            </span>
          </label>
        </div>
      )}

      {/* Meta fields */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">
              Hours at service{isCalendarSystem ? ' (optional)' : ''}
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={hoursAtService}
              onChange={e => setHoursAtService(e.target.value)}
              placeholder={isCalendarSystem ? 'e.g. 142' : ''}
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
          <span className="block text-muted-foreground mb-1">
            {isCustom ? 'Description' : 'Notes (optional)'}
          </span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={isCustom ? 5 : 3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder={isCustom
              ? 'What was wrong, what you did, parts used, follow-ups…'
              : 'Anything the next tech should know…'}
          />
        </label>
      </div>

      {/* Checklist — hidden in custom mode */}
      {!isCustom && (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">Checklist ({unified.length})</div>
        <div className="space-y-2">
          {unified.map(item => {
            const key = `${item.kitId}:${item.id}`
            const checked = checkedIds.has(key)
            const isZinc = system.kind === 'main-engine' && (isZincRodItem(item.id) || isZincRodItem(item.label))
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
                      {isZinc && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZincGuideOpen(true) }}
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/60 text-red-300 hover:bg-red-500/10"
                        >
                          📍 Show locations (10)
                        </button>
                      )}
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
      )}

      {/* Inventory picker */}
      <InventoryPicker picked={inventoryPicked} setPicked={setInventoryPicked} />

      {/* Photos */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">Photos</div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border bg-secondary hover:bg-secondary/80 cursor-pointer">
            <span>📷</span><span>Take photo</span>
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={e => onPickPhotos(e.target.files)}
              className="hidden"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border bg-secondary hover:bg-secondary/80 cursor-pointer">
            <span>🖼️</span><span>Upload from library</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={e => onPickPhotos(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
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

      <ZincRodsGuide open={zincGuideOpen} onClose={() => setZincGuideOpen(false)} />
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
      {
        key,
        name: displayName(it),
        partNumber: partNumber(it) || undefined,
        qty: 1,
        addToPurchase: true,
        sourceTab: (it as any)._tab,
        sourceRow: it.rowIndex,
      },
    ])
    setQuery('')
  }

  function updateQty(key: string, qty: number) {
    setPicked(picked.map(p => p.key === key ? { ...p, qty } : p))
  }

  function togglePurchase(key: string) {
    setPicked(picked.map(p => p.key === key ? { ...p, addToPurchase: !p.addToPurchase } : p))
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
        <ul className="space-y-2">
          {picked.map(p => (
            <li key={p.key} className="rounded-md border border-border/60 bg-background/50 p-2">
              <div className="flex items-center gap-2 text-xs">
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
              </div>
              <label className="flex items-center gap-2 text-[11px] mt-1.5 text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={p.addToPurchase}
                  onChange={() => togglePurchase(p.key)}
                />
                Add to purchase list
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
