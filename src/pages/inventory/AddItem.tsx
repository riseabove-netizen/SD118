import React, { useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useQueryClient } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getCrewName } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import {
  upsertInventoryItem,
  extractInventoryFromPhotos,
  SPARE_SYSTEMS,
  SPARE_SUB_LOCATIONS,
  CONSUMABLE_CATEGORIES,
  CONSUMABLE_SUB_LOCATIONS,
  type InventoryTab,
} from '@/lib/inventory'

type Draft = Record<string, string>

const SPARE_FIELDS: { key: string; label: string; type?: string; options?: string[]; placeholder?: string }[] = [
  { key: 'Part Number', label: 'Part Number', placeholder: 'e.g. 1R-1808 (optional)' },
  { key: 'Description', label: 'Description', placeholder: 'e.g. Fuel filter element' },
  { key: 'Manufacturer', label: 'Manufacturer', placeholder: 'CAT, Racor, Jabsco…' },
  { key: 'System', label: 'System', options: SPARE_SYSTEMS },
  { key: 'Sub-Location', label: 'Sub-Location', options: SPARE_SUB_LOCATIONS },
  { key: 'Qty', label: 'Quantity', type: 'number' },
  { key: 'Min Qty', label: 'Min Qty', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const CONSUMABLE_FIELDS: { key: string; label: string; type?: string; options?: string[]; placeholder?: string }[] = [
  { key: 'Item', label: 'Item *', placeholder: 'e.g. Dish soap' },
  { key: 'Category', label: 'Category', options: CONSUMABLE_CATEGORIES },
  { key: 'Sub-Location', label: 'Sub-Location', options: CONSUMABLE_SUB_LOCATIONS },
  { key: 'Qty', label: 'Quantity', type: 'number' },
  { key: 'Unit', label: 'Unit', placeholder: 'ea, bottle, roll…' },
  { key: 'Min Qty', label: 'Min Qty', type: 'number' },
  { key: 'Max Qty', label: 'Max Qty', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

function fieldsFor(tab: InventoryTab) {
  return tab === 'Spares' ? SPARE_FIELDS : CONSUMABLE_FIELDS
}

function locationFor(tab: InventoryTab, sub: string): string {
  if (tab === 'Spares') return 'Engine Room'
  // Map consumable sub-location to Interior or Exterior
  const exterior = new Set(['Anchor Locker', 'Fly Storage', 'Bridge Deck Locker', 'Aft Deck Locker - Port', 'Aft Deck Locker - STBD'])
  if (!sub) return ''
  if (exterior.has(sub)) return 'Exterior'
  if (sub === 'Engine Room') return 'Engine Room'
  return 'Interior'
}

function emptyDraft(tab: InventoryTab): Draft {
  const d: Draft = {}
  fieldsFor(tab).forEach(f => { d[f.key] = '' })
  if (tab === 'Spares') d.Qty = '1'
  if (tab === 'Consumables') { d.Qty = '1'; d.Unit = 'ea' }
  return d
}

export function AddItemPage({ tab }: { tab: InventoryTab }) {
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft(tab)])
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

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
      // Map AI fields -> Draft
      const newDrafts: Draft[] = items.map(it => {
        const d = emptyDraft(tab)
        if (tab === 'Spares') {
          d['Part Number'] = String(it.part_number || '')
          d.Description = String(it.description || '')
          d.Manufacturer = String(it.manufacturer || '')
          d.System = String(it.system || '')
          d.Qty = String(it.qty || 1)
        } else {
          d.Item = String(it.item || '')
          d.Category = String(it.category || '')
          d.Qty = String(it.qty || 1)
          d.Unit = String(it.unit || 'ea')
        }
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

  async function saveAll() {
    setError(null)
    setSaving(true)
    try {
      const user = getCrewName() || 'crew'
      let savedCount = 0
      for (const d of drafts) {
        // Skip empty rows
        const primary = tab === 'Spares'
          ? ((d['Part Number'] || '').trim() || (d['Description'] || '').trim())
          : d.Item
        if (!primary || !primary.trim()) continue
        await upsertInventoryItem({
          tab,
          values: {
            ...d,
            Location: locationFor(tab, d['Sub-Location']),
          },
          user,
        })
        savedCount++
      }
      await queryClient.invalidateQueries({ queryKey: [tab.toLowerCase()] })
      if (savedCount === 0) {
        setError(tab === 'Spares' ? 'Enter at least a Part Number or Description to save.' : 'Enter at least an Item name to save.')
        return
      }
      setLocation(`/inventory/${tab.toLowerCase()}`)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <MenuLayout title={`Add ${tab === 'Spares' ? 'Spare' : 'Consumable'}`} showBack backHref={`/inventory/${tab.toLowerCase()}`}>
      <div className="space-y-4">
        {/* Photo extract */}
        <div className="p-3 rounded-xl border border-border bg-card">
          <div className="text-sm font-medium mb-2">Add from photo</div>
          <div className="text-xs text-muted-foreground mb-3">
            {tab === 'Spares'
              ? 'Snap labels/boxes. AI reads part numbers and creates one row per part.'
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
          {saving ? 'Saving…' : `Save ${drafts.filter(d => {
            if (tab === 'Spares') return (d['Part Number'] || '').trim() || (d['Description'] || '').trim()
            return (d.Item || '').trim()
          }).length || ''} item(s)`}
        </Button>
      </div>
    </MenuLayout>
  )
}