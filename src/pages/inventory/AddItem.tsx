import React, { useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { FieldCombo } from '@/components/FieldCombo'
import { getCrewName } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import {
  upsertInventoryItem,
  extractInventoryFromPhotos,
  fetchInventory,
  mergeOptions,
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
  type InventoryTab,
} from '@/lib/inventory'

type Draft = Record<string, string>

type FieldDef = {
  key: string
  label: string
  type?: string
  options?: string[]
  placeholder?: string
  combo?: 'location' | 'subLocation' // mark which use combo with distinct vals
}

const SPARE_FIELDS: FieldDef[] = [
  { key: 'Part Number', label: 'Part Number', placeholder: 'e.g. 1R-1808 (optional)' },
  { key: 'Description', label: 'Description', placeholder: 'e.g. Fuel filter element' },
  { key: 'Manufacturer', label: 'Manufacturer', placeholder: 'CAT, Racor, Jabsco…' },
  { key: 'System', label: 'System', options: SPARE_SYSTEMS },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Qty', label: 'Quantity', type: 'number' },
  { key: 'Min Qty', label: 'Min Qty', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const CONSUMABLE_FIELDS: FieldDef[] = [
  { key: 'Item', label: 'Item *', placeholder: 'e.g. Dish soap' },
  { key: 'Category', label: 'Category', options: CONSUMABLE_CATEGORIES },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Qty', label: 'Quantity', type: 'number' },
  { key: 'Unit', label: 'Unit', placeholder: 'ea, bottle, roll…' },
  { key: 'Min Qty', label: 'Min Qty', type: 'number' },
  { key: 'Max Qty', label: 'Max Qty', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const TOOL_FIELDS: FieldDef[] = [
  { key: 'Name', label: 'Name *', placeholder: 'e.g. Fluke 117 Multimeter' },
  { key: 'Category', label: 'Category', options: TOOL_CATEGORIES },
  { key: 'Brand', label: 'Brand', placeholder: 'e.g. Milwaukee, Fluke, Snap-on' },
  { key: 'Model / Serial', label: 'Model / Serial', placeholder: 'optional' },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Condition', label: 'Condition', options: TOOL_CONDITIONS },
  { key: 'Last Checked', label: 'Last Checked', type: 'date' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

function fieldsFor(tab: InventoryTab): FieldDef[] {
  if (tab === 'Spares') return SPARE_FIELDS
  if (tab === 'Tools') return TOOL_FIELDS
  return CONSUMABLE_FIELDS
}

function presetLocations(tab: InventoryTab): string[] {
  if (tab === 'Spares') return SPARE_LOCATIONS
  if (tab === 'Tools') return TOOL_LOCATIONS
  return CONSUMABLE_LOCATIONS
}

function presetSubLocations(tab: InventoryTab): string[] {
  if (tab === 'Spares') return SPARE_SUB_LOCATIONS
  if (tab === 'Tools') return TOOL_SUB_LOCATIONS
  return CONSUMABLE_SUB_LOCATIONS
}

function emptyDraft(tab: InventoryTab): Draft {
  const d: Draft = {}
  fieldsFor(tab).forEach(f => { d[f.key] = '' })
  if (tab === 'Spares') {
    d.Qty = '1'
    d.Location = 'Engine Room'
  }
  if (tab === 'Consumables') {
    d.Qty = '1'
    d.Unit = 'ea'
    d.Location = 'Interior'
  }
  if (tab === 'Tools') {
    d.Location = 'Engine Room'
    d.Condition = 'Good'
  }
  return d
}

function titleFor(tab: InventoryTab): string {
  if (tab === 'Spares') return 'Add Spare'
  if (tab === 'Tools') return 'Add Tool'
  return 'Add Consumable'
}

export function AddItemPage({ tab }: { tab: InventoryTab }) {
  const [, setLocationRoute] = useLocation()
  const queryClient = useQueryClient()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft(tab)])
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Pull existing items to harvest distinct Location / Sub-Location values
  const { data: existing } = useQuery({
    queryKey: [tab.toLowerCase()],
    queryFn: () => fetchInventory(tab),
  })

  const usedLocations = useMemo(() => {
    const list = (existing || []) as any[]
    return new Set(list.map(it => (it.Location || '').trim()).filter(Boolean))
  }, [existing])

  const usedSubLocations = useMemo(() => {
    const list = (existing || []) as any[]
    return new Set(list.map(it => (it['Sub-Location'] || '').trim()).filter(Boolean))
  }, [existing])

  const locOptions = useMemo(() => mergeOptions(presetLocations(tab), usedLocations), [tab, usedLocations])
  const subOptions = useMemo(() => mergeOptions(presetSubLocations(tab), usedSubLocations), [tab, usedSubLocations])

  async function handlePhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setInfo(null)
    setExtracting(true)
    try {
      const images: string[] = []
      for (const file of Array.from(files).slice(0, 8)) {
        const b64 = await compressImageToJpegBase64(file, { maxDim: 1600, quality: 0.82 })
        images.push(b64)
      }
      const resp = await extractInventoryFromPhotos({ tab, imagesBase64: images })
      const items = (resp.items as any[]) || []
      if (items.length === 0) {
        setError('AI did not detect any items in the photos. Add them manually below.')
        return
      }
      const newDrafts: Draft[] = items.map(it => {
        const d = emptyDraft(tab)
        if (tab === 'Spares') {
          d['Part Number'] = String(it.part_number || '')
          d.Description = String(it.description || '')
          d.Manufacturer = String(it.manufacturer || '')
          d.System = String(it.system || '')
          d.Qty = String(it.qty || 1)
        } else if (tab === 'Tools') {
          d.Name = String(it.name || '')
          d.Category = String(it.category || '')
          d.Brand = String(it.brand || '')
          d['Model / Serial'] = String(it.model_serial || '')
          d.Condition = String(it.condition || 'Good')
        } else {
          d.Item = String(it.item || '')
          d.Category = String(it.category || '')
          d.Qty = String(it.qty || 1)
          d.Unit = String(it.unit || 'ea')
        }
        if (it.location) d.Location = String(it.location)
        if (it.sub_location) d['Sub-Location'] = String(it.sub_location)
        return d
      })
      setDrafts(newDrafts)
      setInfo(`Detected ${newDrafts.length} item(s). Review and adjust before saving.`)
    } catch (e: any) {
      setError(e?.message || 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  function updateDraft(i: number, key: string, value: string) {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, [key]: value } : d))
  }

  function removeDraft(i: number) {
    setDrafts(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }

  function addBlankDraft() {
    setDrafts(prev => [...prev, emptyDraft(tab)])
  }

  function primaryField(d: Draft): string {
    if (tab === 'Spares') return (d['Part Number'] || '').trim() || (d['Description'] || '').trim()
    if (tab === 'Tools') return (d.Name || '').trim()
    return (d.Item || '').trim()
  }

  async function saveAll() {
    setError(null)
    setSaving(true)
    try {
      const user = getCrewName() || 'crew'
      let savedCount = 0
      for (const d of drafts) {
        if (!primaryField(d)) continue
        await upsertInventoryItem({
          tab,
          values: { ...d },
          user,
        })
        savedCount++
      }
      await queryClient.invalidateQueries({ queryKey: [tab.toLowerCase()] })
      if (savedCount === 0) {
        const msg =
          tab === 'Spares' ? 'Enter at least a Part Number or Description to save.'
          : tab === 'Tools' ? 'Enter at least a Name to save.'
          : 'Enter at least an Item name to save.'
        setError(msg)
        return
      }
      setLocationRoute(`/inventory/${tab.toLowerCase()}`)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <MenuLayout title={titleFor(tab)} showBack backHref={`/inventory/${tab.toLowerCase()}`}>
      <div className="space-y-4">
        {/* Photo extract */}
        <div className="p-3 rounded-xl border border-border bg-card">
          <div className="text-sm font-medium mb-2">Add from photo</div>
          <div className="text-xs text-muted-foreground mb-3">
            {tab === 'Spares'
              ? 'Snap labels/boxes. AI reads part numbers and creates one row per part.'
              : tab === 'Tools'
              ? 'Snap a tool or toolbox. AI reads brand/model and lists each tool.'
              : 'Snap a shelf or locker. AI lists each item and quantity.'}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => cameraInputRef.current?.click()}
              disabled={extracting}
              className="flex-1"
            >
              📷 Take photo
            </Button>
            <Button
              variant="secondary"
              onClick={() => libraryInputRef.current?.click()}
              disabled={extracting}
              className="flex-1"
            >
              🖼️ Choose
            </Button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={e => { handlePhotos(e.target.files); e.target.value = '' }}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { handlePhotos(e.target.files); e.target.value = '' }}
          />
          {extracting && <div className="text-xs text-muted-foreground mt-2">Reading photos…</div>}
        </div>

        {error && <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">{error}</div>}
        {info && <div className="text-emerald-500 text-sm p-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30">{info}</div>}

        {/* Draft list */}
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <div key={i} className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Item {i + 1}</div>
                {drafts.length > 1 && (
                  <button onClick={() => removeDraft(i)} className="text-xs text-red-500 underline">Remove</button>
                )}
              </div>
              {fieldsFor(tab).map(f => (
                <div key={f.key}>
                  {f.combo === 'location' ? (
                    <FieldCombo
                      label={f.label}
                      value={d[f.key] || ''}
                      options={locOptions}
                      onChange={v => updateDraft(i, f.key, v)}
                    />
                  ) : f.combo === 'subLocation' ? (
                    <FieldCombo
                      label={f.label}
                      value={d[f.key] || ''}
                      options={subOptions}
                      onChange={v => updateDraft(i, f.key, v)}
                    />
                  ) : (
                    <>
                      <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                      {f.options ? (
                        <select
                          value={d[f.key] || ''}
                          onChange={e => updateDraft(i, f.key, e.target.value)}
                          className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
                        >
                          <option value="">—</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea
                          value={d[f.key] || ''}
                          onChange={e => updateDraft(i, f.key, e.target.value)}
                          placeholder={f.placeholder}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border"
                        />
                      ) : (
                        <input
                          type={f.type || 'text'}
                          value={d[f.key] || ''}
                          onChange={e => updateDraft(i, f.key, e.target.value)}
                          placeholder={f.placeholder}
                          inputMode={f.type === 'number' ? 'decimal' : undefined}
                          className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <button
          onClick={addBlankDraft}
          className="w-full h-11 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-secondary"
        >
          + Add another row
        </button>

        <Button onClick={saveAll} disabled={saving || extracting} className="w-full">
          {saving ? 'Saving…' : `Save ${drafts.filter(d => primaryField(d)).length || ''} item(s)`}
        </Button>
      </div>
    </MenuLayout>
  )
}
