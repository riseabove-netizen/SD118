import React, { useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useQueryClient } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getCrewName } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import {
  SPARE_SYSTEMS,
  SPARE_SUB_LOCATIONS,
  CONSUMABLE_CATEGORIES,
  CONSUMABLE_SUB_LOCATIONS,
} from '@/lib/inventory'

type Stage = 'input' | 'extracting' | 'review' | 'saving' | 'done'

type SpareDraft = {
  type: 'Spare'
  'Part Number': string
  Description: string
  Manufacturer: string
  System: string
  'Sub-Location': string
  Qty: string
  Notes: string
}

type ConsumableDraft = {
  type: 'Consumable'
  Item: string
  Category: string
  'Sub-Location': string
  Qty: string
  Unit: string
  Notes: string
}

type DraftItem = SpareDraft | ConsumableDraft

function emptySpare(): SpareDraft {
  return {
    type: 'Spare', 'Part Number': '', Description: '', Manufacturer: '',
    System: '', 'Sub-Location': 'Other', Qty: '1', Notes: '',
  }
}
function emptyConsumable(): ConsumableDraft {
  return {
    type: 'Consumable', Item: '', Category: '', 'Sub-Location': '',
    Qty: '1', Unit: 'ea', Notes: '',
  }
}

function draftToAi(d: DraftItem): any {
  if (d.type === 'Spare') {
    return {
      type: 'Spare',
      part_number: d['Part Number'],
      description: d.Description,
      manufacturer: d.Manufacturer,
      system: d.System,
      sub_location: d['Sub-Location'],
      qty: parseInt(d.Qty || '1', 10) || 1,
      notes: d.Notes,
    }
  }
  return {
    type: 'Consumable',
    item: d.Item,
    category: d.Category,
    sub_location: d['Sub-Location'],
    qty: parseInt(d.Qty || '1', 10) || 1,
    unit: d.Unit,
    notes: d.Notes,
  }
}

function aiToDraft(item: any): DraftItem | null {
  if (!item || typeof item !== 'object') return null
  if (item.type === 'Spare') {
    return {
      type: 'Spare',
      'Part Number': String(item.part_number || ''),
      Description: String(item.description || ''),
      Manufacturer: String(item.manufacturer || ''),
      System: String(item.system || ''),
      'Sub-Location': String(item.sub_location || 'Other'),
      Qty: String(item.qty ?? 1),
      Notes: String(item.notes || ''),
    }
  }
  if (item.type === 'Consumable') {
    return {
      type: 'Consumable',
      Item: String(item.item || ''),
      Category: String(item.category || ''),
      'Sub-Location': String(item.sub_location || ''),
      Qty: String(item.qty ?? 1),
      Unit: String(item.unit || 'ea'),
      Notes: String(item.notes || ''),
    }
  }
  return null
}

export function BulkAddPage() {
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('input')
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<{ base64: string; previewUrl: string }[]>([])
  const [summary, setSummary] = useState('')
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [savedInfo, setSavedInfo] = useState<{ spares: number; consumables: number } | null>(null)

  // AI revise on the review page
  const [reviseInstruction, setReviseInstruction] = useState('')
  const [revising, setRevising] = useState(false)
  const [reviseError, setReviseError] = useState<string | null>(null)

  async function handlePhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    try {
      const added: { base64: string; previewUrl: string }[] = []
      for (const file of Array.from(files).slice(0, 12)) {
        const b64 = await compressImageToJpegBase64(file, { maxDim: 1600, quality: 0.78 })
        added.push({ base64: b64, previewUrl: `data:image/jpeg;base64,${b64}` })
      }
      setPhotos(prev => [...prev, ...added].slice(0, 12))
    } catch (e: any) {
      setError(e?.message || 'Could not load photo')
    }
  }

  function removePhoto(i: number) {
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  async function runExtraction() {
    setError(null)
    if (!text.trim() && photos.length === 0) {
      setError('Add text, photos, or both before processing.')
      return
    }
    setStage('extracting')
    try {
      const res = await fetch('/api/inventory-bulk-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imagesBase64: photos.map(p => p.base64) }),
      })
      const raw = await res.text()
      let data: any = {}
      try { data = raw ? JSON.parse(raw) : {} } catch {}
      if (!res.ok) throw new Error(data?.detail || data?.error || res.statusText)

      const items = Array.isArray(data.items) ? data.items.map(aiToDraft).filter(Boolean) as DraftItem[] : []
      if (items.length === 0) {
        setError('AI did not detect any items. Try adding more detail in the text or take clearer photos.')
        setStage('input')
        return
      }
      setDrafts(items)
      setSummary(String(data.summary || ''))
      setStage('review')
    } catch (e: any) {
      setError(e?.message || 'Extraction failed')
      setStage('input')
    }
  }

  function updateDraft(i: number, key: string, value: string) {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, [key]: value } as DraftItem : d))
  }

  function removeDraft(i: number) {
    setDrafts(prev => prev.filter((_, idx) => idx !== i))
  }

  function toggleType(i: number) {
    setDrafts(prev => prev.map((d, idx) => {
      if (idx !== i) return d
      if (d.type === 'Spare') {
        return { ...emptyConsumable(), Notes: d.Notes, Qty: d.Qty, Item: d.Description }
      } else {
        return { ...emptySpare(), Notes: d.Notes, Qty: d.Qty, Description: d.Item }
      }
    }))
  }

  function addBlankSpare() { setDrafts(prev => [...prev, emptySpare()]) }
  function addBlankConsumable() { setDrafts(prev => [...prev, emptyConsumable()]) }

  async function runRevise() {
    setReviseError(null)
    if (!reviseInstruction.trim()) {
      setReviseError('Type an instruction first.')
      return
    }
    if (drafts.length === 0) {
      setReviseError('Nothing to revise.')
      return
    }
    setRevising(true)
    try {
      const res = await fetch('/api/inventory-bulk-revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: reviseInstruction,
          items: drafts.map(draftToAi),
        }),
      })
      const raw = await res.text()
      let data: any = {}
      try { data = raw ? JSON.parse(raw) : {} } catch {}
      if (!res.ok) throw new Error(data?.detail || data?.error || res.statusText)

      const items = Array.isArray(data.items) ? data.items.map(aiToDraft).filter(Boolean) as DraftItem[] : []
      if (items.length === 0) {
        setReviseError('AI returned no items. Try rewording the instruction.')
        return
      }
      setDrafts(items)
      setSummary(String(data.summary || ''))
      setReviseInstruction('')
    } catch (e: any) {
      setReviseError(e?.message || 'Revision failed')
    } finally {
      setRevising(false)
    }
  }

  async function saveAll() {
    setError(null)
    setStage('saving')
    try {
      const spares = drafts.filter(d => d.type === 'Spare' && (d['Part Number'].trim() || d.Description.trim())) as SpareDraft[]
      const consumables = drafts.filter(d => d.type === 'Consumable' && d.Item.trim()) as ConsumableDraft[]

      if (spares.length === 0 && consumables.length === 0) {
        setError('Nothing to save. Spares need a Part Number or Description; Consumables need an Item name.')
        setStage('review')
        return
      }

      // Strip the `type` discriminator before sending
      const sparePayload = spares.map(({ type, ...rest }) => { void type; return rest })
      const consumablePayload = consumables.map(({ type, ...rest }) => { void type; return rest })

      const res = await fetch('/api/inventory-bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spares: sparePayload,
          consumables: consumablePayload,
          user: getCrewName() || 'crew',
        }),
      })
      const raw = await res.text()
      let data: any = {}
      try { data = raw ? JSON.parse(raw) : {} } catch {}
      if (!res.ok) throw new Error(data?.detail || data?.error || res.statusText)

      await queryClient.invalidateQueries({ queryKey: ['spares'] })
      await queryClient.invalidateQueries({ queryKey: ['consumables'] })
      setSavedInfo({ spares: data.savedSpares || 0, consumables: data.savedConsumables || 0 })
      setStage('done')
    } catch (e: any) {
      setError(e?.message || 'Save failed')
      setStage('review')
    }
  }

  // ===== Render =====

  if (stage === 'done') {
    return (
      <MenuLayout title="Saved" showBack backHref="/inventory">
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/30">
            <div className="text-emerald-400 font-medium mb-1">Items saved</div>
            <div className="text-sm">
              {savedInfo?.spares ?? 0} spare(s), {savedInfo?.consumables ?? 0} consumable(s).
            </div>
          </div>
          <Button onClick={() => setLocation('/inventory/spares')} className="w-full">
            View Spares
          </Button>
          <Button variant="secondary" onClick={() => setLocation('/inventory/consumables')} className="w-full">
            View Consumables
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setText('')
              setPhotos([])
              setDrafts([])
              setSummary('')
              setSavedInfo(null)
              setStage('input')
            }}
            className="w-full"
          >
            Add more items
          </Button>
        </div>
      </MenuLayout>
    )
  }

  if (stage === 'review' || stage === 'saving') {
    const spareCount = drafts.filter(d => d.type === 'Spare').length
    const consumableCount = drafts.filter(d => d.type === 'Consumable').length
    return (
      <MenuLayout title="Review items" showBack backHref="/inventory/bulk-add">
        <div className="space-y-4">
          {summary && (
            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground mb-1">AI summary</div>
              <div className="text-sm">{summary}</div>
            </div>
          )}

          {/* AI revise all */}
          <div className="p-3 rounded-xl border border-primary/40 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <div className="text-sm font-medium">Bulk edit with AI</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Describe changes to apply across all items below. Examples: “all of these are CAT spares”, “set system to Main Engines”, “move everything to a new sub-location called Bin#1-STBD Gen”, “remove duplicates”.
            </div>
            <textarea
              value={reviseInstruction}
              onChange={e => setReviseInstruction(e.target.value)}
              rows={2}
              placeholder="Tell AI what to change…"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm"
              disabled={revising || stage === 'saving'}
            />
            {reviseError && (
              <div className="text-red-500 text-xs">{reviseError}</div>
            )}
            <Button
              variant="secondary"
              onClick={runRevise}
              disabled={revising || stage === 'saving' || !reviseInstruction.trim()}
              className="w-full"
            >
              {revising ? 'Applying…' : 'Apply changes'}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            {drafts.length} item(s) ready · {spareCount} spare · {consumableCount} consumable
          </div>

          {error && (
            <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">{error}</div>
          )}

          {drafts.map((d, i) => (
            <div key={i} className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleType(i)}
                  className={`px-2 h-7 rounded-md text-xs font-medium border ${d.type === 'Spare' ? 'bg-primary text-primary-foreground border-primary' : 'bg-emerald-700 text-white border-emerald-700'}`}
                  title="Tap to switch between Spare and Consumable"
                >
                  {d.type === 'Spare' ? '🔧 Spare' : '📦 Consumable'}
                </button>
                <button onClick={() => removeDraft(i)} className="text-xs text-red-400 underline">Remove</button>
              </div>

              {d.type === 'Spare' ? (
                <>
                  <Field label="Part Number" value={d['Part Number']} onChange={v => updateDraft(i, 'Part Number', v)} />
                  <Field label="Description" value={d.Description} onChange={v => updateDraft(i, 'Description', v)} />
                  <Field label="Manufacturer" value={d.Manufacturer} onChange={v => updateDraft(i, 'Manufacturer', v)} />
                  <FieldSelect label="System" value={d.System} options={SPARE_SYSTEMS} onChange={v => updateDraft(i, 'System', v)} />
                  <FieldCombo label="Sub-Location" value={d['Sub-Location']} options={SPARE_SUB_LOCATIONS} onChange={v => updateDraft(i, 'Sub-Location', v)} listId={`spare-sublocs-${i}`} />
                  <Field label="Qty" value={d.Qty} type="number" onChange={v => updateDraft(i, 'Qty', v)} />
                  <FieldArea label="Notes" value={d.Notes} onChange={v => updateDraft(i, 'Notes', v)} />
                </>
              ) : (
                <>
                  <Field label="Item *" value={d.Item} onChange={v => updateDraft(i, 'Item', v)} />
                  <FieldSelect label="Category" value={d.Category} options={CONSUMABLE_CATEGORIES} onChange={v => updateDraft(i, 'Category', v)} />
                  <FieldCombo label="Sub-Location" value={d['Sub-Location']} options={CONSUMABLE_SUB_LOCATIONS} onChange={v => updateDraft(i, 'Sub-Location', v)} listId={`cons-sublocs-${i}`} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Qty" value={d.Qty} type="number" onChange={v => updateDraft(i, 'Qty', v)} />
                    <Field label="Unit" value={d.Unit} onChange={v => updateDraft(i, 'Unit', v)} />
                  </div>
                  <FieldArea label="Notes" value={d.Notes} onChange={v => updateDraft(i, 'Notes', v)} />
                </>
              )}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={addBlankSpare} className="h-10 rounded-lg border border-dashed border-border text-sm text-muted-foreground">+ Add spare</button>
            <button onClick={addBlankConsumable} className="h-10 rounded-lg border border-dashed border-border text-sm text-muted-foreground">+ Add consumable</button>
          </div>

          <Button onClick={saveAll} disabled={stage === 'saving' || drafts.length === 0} className="w-full h-12 text-base">
            {stage === 'saving' ? 'Saving…' : `Save ${drafts.length} item(s)`}
          </Button>
        </div>
      </MenuLayout>
    )
  }

  // stage === 'input' or 'extracting'
  return (
    <MenuLayout title="Bulk Add" showBack backHref="/inventory">
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Dictate or type a list, attach photos, or both. AI will read everything, classify each item as a spare or consumable, and let you review before saving.
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">What did you find / add?</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            placeholder="e.g. 3 Racor 2010PM-OR filters in port locker, 2 Jabsco 920-0001 impellers in STBD locker, 12 bottles of dish soap in galley, 4 rolls of paper towels…"
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border"
          />
          <div className="text-xs text-muted-foreground mt-1">Tip: tap the microphone on your keyboard to dictate.</div>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-2">Photos (optional, up to 12)</label>
          <div className="flex gap-2 mb-2">
            <Button variant="secondary" onClick={() => cameraRef.current?.click()} className="flex-1">📷 Take photo</Button>
            <Button variant="secondary" onClick={() => libraryRef.current?.click()} className="flex-1">🖼️ Choose</Button>
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.previewUrl} alt={`photo ${i + 1}`} className="w-full aspect-square object-cover rounded-md" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white text-xs"
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={e => { handlePhotos(e.target.files); e.target.value = '' }}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { handlePhotos(e.target.files); e.target.value = '' }}
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">{error}</div>
        )}

        <Button onClick={runExtraction} disabled={stage === 'extracting'} className="w-full h-12 text-base">
          {stage === 'extracting' ? 'Processing with AI…' : 'Process with AI'}
        </Button>
      </div>
    </MenuLayout>
  )
}

function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        inputMode={type === 'number' ? 'decimal' : undefined}
        className="w-full h-10 px-3 rounded-lg bg-secondary border border-border"
      />
    </div>
  )
}

function FieldCombo({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void; listId?: string }) {
  // value matches a preset → show dropdown; doesn't match (custom/new) → show text input.
  const isCustom = value !== '' && !options.includes(value)
  const [customMode, setCustomMode] = React.useState(isCustom)

  // If parent value changes to a preset, drop custom mode
  React.useEffect(() => {
    if (value && options.includes(value)) setCustomMode(false)
  }, [value, options])

  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {customMode ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Type a new value"
            autoFocus
            className="flex-1 h-10 px-3 rounded-lg bg-secondary border border-primary"
          />
          <button
            type="button"
            onClick={() => { onChange(''); setCustomMode(false) }}
            className="h-10 px-3 rounded-lg bg-secondary border border-border text-xs text-muted-foreground"
            title="Pick from list instead"
          >
            ✕
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={e => {
            const v = e.target.value
            if (v === '__new__') {
              onChange('')
              setCustomMode(true)
            } else {
              onChange(v)
            }
          }}
          className="w-full h-10 px-3 rounded-lg bg-secondary border border-border"
        >
          <option value="">— pick one —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="__new__">+ New custom value…</option>
        </select>
      )}
    </div>
  )
}

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border">
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border" />
    </div>
  )
}