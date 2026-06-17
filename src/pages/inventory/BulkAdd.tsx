import React, { useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { FieldCombo } from '@/components/FieldCombo'
import { getCrewName } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import {
  fetchInventory,
  mergeOptions,
  uploadInventoryPhoto,
  SPARE_SYSTEMS,
  SPARE_LOCATIONS,
  SPARE_SUB_LOCATIONS,
  CONSUMABLE_CATEGORIES,
  CONSUMABLE_LOCATIONS,
  CONSUMABLE_SUB_LOCATIONS,
  TOOL_CATEGORIES,
  TOOL_LOCATIONS,
  TOOL_SUB_LOCATIONS,
  TOOL_CONDITIONS,
} from '@/lib/inventory'

type Stage = 'input' | 'extracting' | 'review' | 'saving' | 'done'

type SpareDraft = {
  type: 'Spare'
  'Part Number': string
  Description: string
  Manufacturer: string
  System: string
  Location: string
  'Sub-Location': string
  Qty: string
  Notes: string
  'Photo URL': string
}

type ConsumableDraft = {
  type: 'Consumable'
  Item: string
  Category: string
  Location: string
  'Sub-Location': string
  Qty: string
  Unit: string
  Notes: string
  'Photo URL': string
}

type ToolDraft = {
  type: 'Tool'
  Name: string
  Category: string
  Brand: string
  'Model / Serial': string
  Location: string
  'Sub-Location': string
  Condition: string
  Notes: string
  'Photo URL': string
}

type DraftItem = SpareDraft | ConsumableDraft | ToolDraft

function emptySpare(): SpareDraft {
  return {
    type: 'Spare', 'Part Number': '', Description: '', Manufacturer: '',
    System: '', Location: 'Engine Room', 'Sub-Location': '', Qty: '1', Notes: '',
    'Photo URL': '',
  }
}
function emptyConsumable(): ConsumableDraft {
  return {
    type: 'Consumable', Item: '', Category: '', Location: 'Interior', 'Sub-Location': '',
    Qty: '1', Unit: 'ea', Notes: '',
    'Photo URL': '',
  }
}
function emptyTool(): ToolDraft {
  return {
    type: 'Tool', Name: '', Category: '', Brand: '', 'Model / Serial': '',
    Location: 'Engine Room', 'Sub-Location': '', Condition: 'Good', Notes: '',
    'Photo URL': '',
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
      location: d.Location,
      sub_location: d['Sub-Location'],
      qty: parseInt(d.Qty || '1', 10) || 1,
      notes: d.Notes,
      photo_url: d['Photo URL'],
    }
  }
  if (d.type === 'Tool') {
    return {
      type: 'Tool',
      name: d.Name,
      category: d.Category,
      brand: d.Brand,
      model_serial: d['Model / Serial'],
      location: d.Location,
      sub_location: d['Sub-Location'],
      condition: d.Condition,
      notes: d.Notes,
      photo_url: d['Photo URL'],
    }
  }
  return {
    type: 'Consumable',
    item: d.Item,
    category: d.Category,
    location: d.Location,
    sub_location: d['Sub-Location'],
    qty: parseInt(d.Qty || '1', 10) || 1,
    unit: d.Unit,
    notes: d.Notes,
    photo_url: d['Photo URL'],
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
      Location: String(item.location || 'Engine Room'),
      'Sub-Location': String(item.sub_location || ''),
      Qty: String(item.qty ?? 1),
      Notes: String(item.notes || ''),
      'Photo URL': String(item.photo_url || ''),
    }
  }
  if (item.type === 'Tool') {
    return {
      type: 'Tool',
      Name: String(item.name || ''),
      Category: String(item.category || ''),
      Brand: String(item.brand || ''),
      'Model / Serial': String(item.model_serial || ''),
      Location: String(item.location || 'Engine Room'),
      'Sub-Location': String(item.sub_location || ''),
      Condition: String(item.condition || 'Good'),
      Notes: String(item.notes || ''),
      'Photo URL': String(item.photo_url || ''),
    }
  }
  if (item.type === 'Consumable') {
    return {
      type: 'Consumable',
      Item: String(item.item || ''),
      Category: String(item.category || ''),
      Location: String(item.location || 'Interior'),
      'Sub-Location': String(item.sub_location || ''),
      Qty: String(item.qty ?? 1),
      Unit: String(item.unit || 'ea'),
      Notes: String(item.notes || ''),
      'Photo URL': String(item.photo_url || ''),
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
  const [savedInfo, setSavedInfo] = useState<{ spares: number; consumables: number; tools: number } | null>(null)

  // AI revise on the review page
  const [reviseInstruction, setReviseInstruction] = useState('')
  const [revising, setRevising] = useState(false)
  const [reviseError, setReviseError] = useState<string | null>(null)

  // Pull existing values for combo dropdowns
  const { data: existingSpares } = useQuery({ queryKey: ['spares'], queryFn: () => fetchInventory('Spares') })
  const { data: existingCons } = useQuery({ queryKey: ['consumables'], queryFn: () => fetchInventory('Consumables') })
  const { data: existingTools } = useQuery({ queryKey: ['tools'], queryFn: () => fetchInventory('Tools') })

  const usedSpareLocs = useMemo(() => new Set(((existingSpares || []) as any[]).map(it => (it.Location || '').trim()).filter(Boolean)), [existingSpares])
  const usedSpareSubs = useMemo(() => new Set(((existingSpares || []) as any[]).map(it => (it['Sub-Location'] || '').trim()).filter(Boolean)), [existingSpares])
  const usedConsLocs = useMemo(() => new Set(((existingCons || []) as any[]).map(it => (it.Location || '').trim()).filter(Boolean)), [existingCons])
  const usedConsSubs = useMemo(() => new Set(((existingCons || []) as any[]).map(it => (it['Sub-Location'] || '').trim()).filter(Boolean)), [existingCons])
  const usedToolLocs = useMemo(() => new Set(((existingTools || []) as any[]).map(it => (it.Location || '').trim()).filter(Boolean)), [existingTools])
  const usedToolSubs = useMemo(() => new Set(((existingTools || []) as any[]).map(it => (it['Sub-Location'] || '').trim()).filter(Boolean)), [existingTools])
  // Distinct Systems/Categories across existing items — lets bulk-add users pick
  // a previously-used System or type a brand new one (same rule as Location).
  const usedSpareSystems = useMemo(() => new Set(((existingSpares || []) as any[]).map(it => (it.System || '').trim()).filter(Boolean)), [existingSpares])
  const usedConsCats = useMemo(() => new Set(((existingCons || []) as any[]).map(it => (it.Category || '').trim()).filter(Boolean)), [existingCons])
  const usedToolCats = useMemo(() => new Set(((existingTools || []) as any[]).map(it => (it.Category || '').trim()).filter(Boolean)), [existingTools])

  const spareLocOpts = useMemo(() => mergeOptions(SPARE_LOCATIONS, usedSpareLocs), [usedSpareLocs])
  const spareSubOpts = useMemo(() => mergeOptions(SPARE_SUB_LOCATIONS, usedSpareSubs), [usedSpareSubs])
  const consLocOpts = useMemo(() => mergeOptions(CONSUMABLE_LOCATIONS, usedConsLocs), [usedConsLocs])
  const consSubOpts = useMemo(() => mergeOptions(CONSUMABLE_SUB_LOCATIONS, usedConsSubs), [usedConsSubs])
  const toolLocOpts = useMemo(() => mergeOptions(TOOL_LOCATIONS, usedToolLocs), [usedToolLocs])
  const toolSubOpts = useMemo(() => mergeOptions(TOOL_SUB_LOCATIONS, usedToolSubs), [usedToolSubs])
  const spareSystemOpts = useMemo(() => mergeOptions(SPARE_SYSTEMS, usedSpareSystems), [usedSpareSystems])
  const consCategoryOpts = useMemo(() => mergeOptions(CONSUMABLE_CATEGORIES, usedConsCats), [usedConsCats])
  const toolCategoryOpts = useMemo(() => mergeOptions(TOOL_CATEGORIES, usedToolCats), [usedToolCats])

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
      const allDrafts: DraftItem[] = []
      const summaries: string[] = []

      if (photos.length > 0) {
        // Process each photo individually so its uploaded Drive URL can be
        // attached to every item the AI extracts from THAT photo.
        // Photo upload + AI extraction run in parallel per photo, and all
        // photos run in parallel with each other.
        const photoTasks = photos.map(async (p, idx) => {
          const uploadPromise = uploadInventoryPhoto({
            base64: p.base64,
            tab: 'Spares',
            label: `bulk-${new Date().toISOString().slice(0, 10)}-${idx + 1}`,
          }).catch(err => {
            console.warn('Bulk photo upload failed:', err)
            return null
          })

          // Only feed the text prompt on the first photo so it isn't repeated
          const extractText = idx === 0 ? text : ''
          const extractPromise = fetch('/api/inventory-bulk-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: extractText, imagesBase64: [p.base64] }),
          }).then(async res => {
            const raw = await res.text()
            let data: any = {}
            try { data = raw ? JSON.parse(raw) : {} } catch {}
            if (!res.ok) throw new Error(data?.detail || data?.error || res.statusText)
            return data
          })

          const [uploadResult, extractData] = await Promise.all([uploadPromise, extractPromise])
          const photoUrl = uploadResult ? uploadResult.photoUrl : ''
          const items = Array.isArray(extractData.items)
            ? (extractData.items.map(aiToDraft).filter(Boolean) as DraftItem[])
            : []
          const tagged = items.map(it => ({ ...it, 'Photo URL': photoUrl }) as DraftItem)
          return { tagged, summary: String(extractData.summary || '') }
        })

        const results = await Promise.all(photoTasks)
        for (const r of results) {
          allDrafts.push(...r.tagged)
          if (r.summary) summaries.push(r.summary)
        }
      } else {
        // Text-only path: single extraction, no photo
        const res = await fetch('/api/inventory-bulk-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, imagesBase64: [] }),
        })
        const raw = await res.text()
        let data: any = {}
        try { data = raw ? JSON.parse(raw) : {} } catch {}
        if (!res.ok) throw new Error(data?.detail || data?.error || res.statusText)
        const items = Array.isArray(data.items)
          ? (data.items.map(aiToDraft).filter(Boolean) as DraftItem[])
          : []
        allDrafts.push(...items)
        if (data.summary) summaries.push(String(data.summary))
      }

      if (allDrafts.length === 0) {
        setError('AI did not detect any items. Try adding more detail in the text or take clearer photos.')
        setStage('input')
        return
      }
      setDrafts(allDrafts)
      setSummary(summaries.join(' · '))
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

  // Cycle Spare → Consumable → Tool → Spare
  function toggleType(i: number) {
    setDrafts(prev => prev.map((d, idx) => {
      if (idx !== i) return d
      if (d.type === 'Spare') {
        const next = emptyConsumable()
        next.Item = d.Description || d['Part Number']
        next.Qty = d.Qty
        next.Notes = d.Notes
        next.Location = d.Location || 'Interior'
        next['Sub-Location'] = d['Sub-Location']
        next['Photo URL'] = d['Photo URL']
        return next
      }
      if (d.type === 'Consumable') {
        const next = emptyTool()
        next.Name = d.Item
        next.Notes = d.Notes
        next.Location = d.Location || 'Engine Room'
        next['Sub-Location'] = d['Sub-Location']
        next['Photo URL'] = d['Photo URL']
        return next
      }
      // Tool → Spare
      const next = emptySpare()
      next.Description = d.Name
      next.Manufacturer = d.Brand
      next.Notes = d.Notes
      next.Location = d.Location || 'Engine Room'
      next['Sub-Location'] = d['Sub-Location']
      next['Photo URL'] = d['Photo URL']
      return next
    }))
  }

  function addBlankSpare() { setDrafts(prev => [...prev, emptySpare()]) }
  function addBlankConsumable() { setDrafts(prev => [...prev, emptyConsumable()]) }
  function addBlankTool() { setDrafts(prev => [...prev, emptyTool()]) }

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
      const spares = drafts.filter(d => d.type === 'Spare' && ((d as SpareDraft)['Part Number'].trim() || (d as SpareDraft).Description.trim())) as SpareDraft[]
      const consumables = drafts.filter(d => d.type === 'Consumable' && (d as ConsumableDraft).Item.trim()) as ConsumableDraft[]
      const tools = drafts.filter(d => d.type === 'Tool' && (d as ToolDraft).Name.trim()) as ToolDraft[]

      if (spares.length === 0 && consumables.length === 0 && tools.length === 0) {
        setError('Nothing to save. Spares need a Part Number or Description; Consumables need an Item name; Tools need a Name.')
        setStage('review')
        return
      }

      // Strip the `type` discriminator before sending
      const sparePayload = spares.map(({ type, ...rest }) => { void type; return rest })
      const consumablePayload = consumables.map(({ type, ...rest }) => { void type; return rest })
      const toolPayload = tools.map(({ type, ...rest }) => { void type; return rest })

      const res = await fetch('/api/inventory-bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spares: sparePayload,
          consumables: consumablePayload,
          tools: toolPayload,
          user: getCrewName() || 'crew',
        }),
      })
      const raw = await res.text()
      let data: any = {}
      try { data = raw ? JSON.parse(raw) : {} } catch {}
      if (!res.ok) throw new Error(data?.detail || data?.error || res.statusText)

      await queryClient.invalidateQueries({ queryKey: ['spares'] })
      await queryClient.invalidateQueries({ queryKey: ['consumables'] })
      await queryClient.invalidateQueries({ queryKey: ['tools'] })
      setSavedInfo({
        spares: data.savedSpares || 0,
        consumables: data.savedConsumables || 0,
        tools: data.savedTools || 0,
      })
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
              {savedInfo?.spares ?? 0} spare(s), {savedInfo?.consumables ?? 0} consumable(s), {savedInfo?.tools ?? 0} tool(s).
            </div>
          </div>
          <Button onClick={() => setLocation('/inventory/spares')} className="w-full">
            View Spares
          </Button>
          <Button variant="secondary" onClick={() => setLocation('/inventory/consumables')} className="w-full">
            View Consumables
          </Button>
          <Button variant="secondary" onClick={() => setLocation('/inventory/tools')} className="w-full">
            View Tools
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
    const toolCount = drafts.filter(d => d.type === 'Tool').length
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
              Describe changes to apply across all items below. Examples: “all of these are CAT spares”, “set system to Main Engines”, “the multimeter is a tool not a consumable”, “move everything to a new sub-location called Bin#1-STBD Gen”, “remove duplicates”.
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
            {drafts.length} item(s) ready · {spareCount} spare · {consumableCount} consumable · {toolCount} tool
          </div>

          {error && (
            <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">{error}</div>
          )}

          {drafts.map((d, i) => {
            const typeBtnCls =
              d.type === 'Spare'
                ? 'bg-primary text-primary-foreground border-primary'
                : d.type === 'Consumable'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-amber-600 text-white border-amber-600'
            const typeLabel =
              d.type === 'Spare' ? '🔧 Spare' : d.type === 'Consumable' ? '📦 Consumable' : '🛠️ Tool'
            return (
              <div key={i} className="p-3 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleType(i)}
                    className={`px-2 h-7 rounded-md text-xs font-medium border ${typeBtnCls}`}
                    title="Tap to cycle through Spare / Consumable / Tool"
                  >
                    {typeLabel}
                  </button>
                  {d['Photo URL'] ? (
                    <a
                      href={(() => {
                        const m = d['Photo URL'].match(/thumbnail\?id=([^&]+)/)
                        return m ? `https://drive.google.com/file/d/${m[1]}/view` : d['Photo URL']
                      })()}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                      title="Open photo in Drive"
                    >
                      <img src={d['Photo URL']} alt="item" className="w-10 h-10 object-cover rounded-md border border-border" />
                    </a>
                  ) : null}
                  <button onClick={() => removeDraft(i)} className="text-xs text-red-400 underline">Remove</button>
                </div>

                {d.type === 'Spare' ? (
                  <>
                    <Field label="Part Number" value={d['Part Number']} onChange={v => updateDraft(i, 'Part Number', v)} />
                    <Field label="Description" value={d.Description} onChange={v => updateDraft(i, 'Description', v)} />
                    <Field label="Manufacturer" value={d.Manufacturer} onChange={v => updateDraft(i, 'Manufacturer', v)} />
                    <FieldCombo h={10} label="System" value={d.System} options={spareSystemOpts} onChange={v => updateDraft(i, 'System', v)} />
                    <FieldCombo h={10} label="Location" value={d.Location} options={spareLocOpts} onChange={v => updateDraft(i, 'Location', v)} />
                    <FieldCombo h={10} label="Sub-Location" value={d['Sub-Location']} options={spareSubOpts} onChange={v => updateDraft(i, 'Sub-Location', v)} />
                    <Field label="Qty" value={d.Qty} type="number" onChange={v => updateDraft(i, 'Qty', v)} />
                    <FieldArea label="Notes" value={d.Notes} onChange={v => updateDraft(i, 'Notes', v)} />
                  </>
                ) : d.type === 'Consumable' ? (
                  <>
                    <Field label="Item *" value={d.Item} onChange={v => updateDraft(i, 'Item', v)} />
                    <FieldCombo h={10} label="Category" value={d.Category} options={consCategoryOpts} onChange={v => updateDraft(i, 'Category', v)} />
                    <FieldCombo h={10} label="Location" value={d.Location} options={consLocOpts} onChange={v => updateDraft(i, 'Location', v)} />
                    <FieldCombo h={10} label="Sub-Location" value={d['Sub-Location']} options={consSubOpts} onChange={v => updateDraft(i, 'Sub-Location', v)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Qty" value={d.Qty} type="number" onChange={v => updateDraft(i, 'Qty', v)} />
                      <Field label="Unit" value={d.Unit} onChange={v => updateDraft(i, 'Unit', v)} />
                    </div>
                    <FieldArea label="Notes" value={d.Notes} onChange={v => updateDraft(i, 'Notes', v)} />
                  </>
                ) : (
                  <>
                    <Field label="Name *" value={d.Name} onChange={v => updateDraft(i, 'Name', v)} />
                    <FieldCombo h={10} label="Category" value={d.Category} options={toolCategoryOpts} onChange={v => updateDraft(i, 'Category', v)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Brand" value={d.Brand} onChange={v => updateDraft(i, 'Brand', v)} />
                      <Field label="Model / Serial" value={d['Model / Serial']} onChange={v => updateDraft(i, 'Model / Serial', v)} />
                    </div>
                    <FieldCombo h={10} label="Location" value={d.Location} options={toolLocOpts} onChange={v => updateDraft(i, 'Location', v)} />
                    <FieldCombo h={10} label="Sub-Location" value={d['Sub-Location']} options={toolSubOpts} onChange={v => updateDraft(i, 'Sub-Location', v)} />
                    <FieldSelect label="Condition" value={d.Condition} options={TOOL_CONDITIONS} onChange={v => updateDraft(i, 'Condition', v)} />
                    <FieldArea label="Notes" value={d.Notes} onChange={v => updateDraft(i, 'Notes', v)} />
                  </>
                )}
              </div>
            )
          })}

          <div className="grid grid-cols-3 gap-2">
            <button onClick={addBlankSpare} className="h-10 rounded-lg border border-dashed border-border text-sm text-muted-foreground">+ Spare</button>
            <button onClick={addBlankConsumable} className="h-10 rounded-lg border border-dashed border-border text-sm text-muted-foreground">+ Consumable</button>
            <button onClick={addBlankTool} className="h-10 rounded-lg border border-dashed border-border text-sm text-muted-foreground">+ Tool</button>
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
          Dictate or type a list, attach photos, or both. AI will read everything, classify each item as a spare, consumable, or tool, and let you review before saving.
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">What did you find / add?</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            placeholder="e.g. 3 Racor 2010PM-OR filters in port locker, 2 Jabsco 920-0001 impellers in STBD locker, 12 bottles of dish soap in galley, 1 Fluke 117 multimeter on the workbench…"
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
