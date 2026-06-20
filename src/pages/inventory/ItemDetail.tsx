import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { FieldCombo } from '@/components/FieldCombo'
import { PhotoSourcePicker } from '@/components/PhotoSourcePicker'
import { getCrewName } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import {
  fetchInventory,
  upsertInventoryItem,
  uploadInventoryPhoto,
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
  SUPPLY_CATEGORIES,
  SUPPLY_LOCATIONS,
  SUPPLY_SUB_LOCATIONS,
  type InventoryTab,
} from '@/lib/inventory'

type FieldDef = {
  key: string
  label: string
  type?: string
  options?: string[]
  placeholder?: string
  combo?: 'location' | 'subLocation' | 'system' | 'category'
}

const SPARE_FIELDS: FieldDef[] = [
  { key: 'Part Number', label: 'Part Number', placeholder: 'e.g. 1R-1808 (optional)' },
  { key: 'Description', label: 'Description', placeholder: 'e.g. Fuel filter element' },
  { key: 'Manufacturer', label: 'Manufacturer', placeholder: 'CAT, Racor, etc.' },
  { key: 'System', label: 'System', combo: 'system' },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Qty', label: 'Quantity on hand', type: 'number' },
  { key: 'Min Qty', label: 'Min Qty (restock threshold)', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const CONSUMABLE_FIELDS: FieldDef[] = [
  { key: 'Item', label: 'Item name', placeholder: 'e.g. Dish soap' },
  { key: 'Category', label: 'Category', combo: 'category' },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Qty', label: 'Quantity on hand', type: 'number' },
  { key: 'Unit', label: 'Unit', placeholder: 'ea, bottle, roll…' },
  { key: 'Min Qty', label: 'Min Qty', type: 'number' },
  { key: 'Max Qty', label: 'Max Qty', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const SUPPLY_FIELDS: FieldDef[] = [
  { key: 'Item', label: 'Item name', placeholder: 'e.g. 3/4 inch dock line' },
  { key: 'Category', label: 'Category', combo: 'category' },
  { key: 'Brand', label: 'Brand', placeholder: 'optional' },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Qty', label: 'Quantity on hand', type: 'number' },
  { key: 'Unit', label: 'Unit', placeholder: 'ea, m, ft, box…' },
  { key: 'Min Qty', label: 'Min Qty', type: 'number' },
  { key: 'Max Qty', label: 'Max Qty', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const TOOL_FIELDS: FieldDef[] = [
  { key: 'Name', label: 'Name', placeholder: 'e.g. Fluke 117 Multimeter' },
  { key: 'Category', label: 'Category', combo: 'category' },
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
  if (tab === 'Supplies') return SUPPLY_FIELDS
  return CONSUMABLE_FIELDS
}

function presetLocations(tab: InventoryTab): string[] {
  if (tab === 'Spares') return SPARE_LOCATIONS
  if (tab === 'Tools') return TOOL_LOCATIONS
  if (tab === 'Supplies') return SUPPLY_LOCATIONS
  return CONSUMABLE_LOCATIONS
}

function presetSubLocations(tab: InventoryTab): string[] {
  if (tab === 'Spares') return SPARE_SUB_LOCATIONS
  if (tab === 'Tools') return TOOL_SUB_LOCATIONS
  if (tab === 'Supplies') return SUPPLY_SUB_LOCATIONS
  return CONSUMABLE_SUB_LOCATIONS
}

function presetCategories(tab: InventoryTab): string[] {
  if (tab === 'Tools') return TOOL_CATEGORIES
  if (tab === 'Supplies') return SUPPLY_CATEGORIES
  return CONSUMABLE_CATEGORIES
}

function isQtyTab(tab: InventoryTab) {
  return tab === 'Spares' || tab === 'Consumables' || tab === 'Supplies'
}

function titleFor(tab: InventoryTab, item: any): string {
  if (!item) return tab
  if (tab === 'Spares') return item['Part Number'] || item.Description || 'Spare'
  if (tab === 'Tools') return item.Name || 'Tool'
  return item.Item || 'Item'
}

export function ItemDetailPage({ tab }: { tab: InventoryTab }) {
  const [, paramsSpare] = useRoute('/inventory/spares/:row')
  const [, paramsCons] = useRoute('/inventory/consumables/:row')
  const [, paramsTools] = useRoute('/inventory/tools/:row')
  const [, paramsSupplies] = useRoute('/inventory/supplies/:row')
  const params: { row?: string } | null =
    tab === 'Spares' ? (paramsSpare as any)
    : tab === 'Tools' ? (paramsTools as any)
    : tab === 'Supplies' ? (paramsSupplies as any)
    : (paramsCons as any)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const rowIndex = params?.row ? parseInt(params.row, 10) : undefined

  const { data, isLoading } = useQuery({
    queryKey: [tab.toLowerCase()],
    queryFn: () => fetchInventory(tab) as Promise<any[]>,
  })

  const item = useMemo(() => {
    if (!data || !rowIndex) return null
    return data.find(it => it.rowIndex === rowIndex) || null
  }, [data, rowIndex])

  const usedLocations = useMemo(() => {
    const list = (data || []) as any[]
    return new Set(list.map(it => (it.Location || '').trim()).filter(Boolean))
  }, [data])
  const usedSubLocations = useMemo(() => {
    const list = (data || []) as any[]
    return new Set(list.map(it => (it['Sub-Location'] || '').trim()).filter(Boolean))
  }, [data])
  const usedSystems = useMemo(() => {
    const list = (data || []) as any[]
    return new Set(list.map(it => (it.System || '').trim()).filter(Boolean))
  }, [data])
  const usedCategories = useMemo(() => {
    const list = (data || []) as any[]
    return new Set(list.map(it => (it.Category || '').trim()).filter(Boolean))
  }, [data])
  const locOptions = useMemo(() => mergeOptions(presetLocations(tab), usedLocations), [tab, usedLocations])
  const subOptions = useMemo(() => mergeOptions(presetSubLocations(tab), usedSubLocations), [tab, usedSubLocations])
  const systemOptions = useMemo(() => mergeOptions(SPARE_SYSTEMS, usedSystems), [usedSystems])
  const categoryOptions = useMemo(() => mergeOptions(presetCategories(tab), usedCategories), [tab, usedCategories])

  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savingDelta, setSavingDelta] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photoState, setPhotoState] = useState<{ thumbUrl: string; viewUrl: string } | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (item) {
      const initial: Record<string, string> = {}
      fieldsFor(tab).forEach(f => { initial[f.key] = item[f.key] || '' })
      initial['Photo URL'] = item['Photo URL'] || ''
      setValues(initial)
      const existing = (item['Photo URL'] || '').trim()
      if (existing) {
        const m = existing.match(/thumbnail\?id=([^&]+)/)
        if (m) {
          setPhotoState({ thumbUrl: existing, viewUrl: `https://drive.google.com/file/d/${m[1]}/view` })
        } else {
          setPhotoState({ thumbUrl: existing, viewUrl: existing })
        }
      } else {
        setPhotoState(null)
      }
    }
  }, [item, tab])

  async function handlePhoto(files: FileList | null) {
    if (!files || files.length === 0 || !item) return
    setError(null)
    setUploadingPhoto(true)
    try {
      const b64 = await compressImageToJpegBase64(files[0], { maxDim: 1600, quality: 0.8 })
      const label = titleFor(tab, item)
      const resp = await uploadInventoryPhoto({ base64: b64, tab, itemId: item.ID, label })
      setPhotoState({ thumbUrl: resp.thumbUrl, viewUrl: resp.viewUrl })
      const next = { ...values, 'Photo URL': resp.photoUrl }
      setValues(next)
      await upsertInventoryItem({
        tab,
        rowIndex,
        values: next,
        user: getCrewName() || 'crew',
      })
      await queryClient.invalidateQueries({ queryKey: [tab.toLowerCase()] })
    } catch (e: any) {
      setError(e?.message || 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function removePhoto() {
    setPhotoState(null)
    const next = { ...values, 'Photo URL': '' }
    setValues(next)
    try {
      await upsertInventoryItem({
        tab,
        rowIndex,
        values: next,
        user: getCrewName() || 'crew',
      })
      await queryClient.invalidateQueries({ queryKey: [tab.toLowerCase()] })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    }
  }

  if (isLoading) return <MenuLayout title={tab} showBack backHref={`/inventory/${tab.toLowerCase()}`}><div className="text-muted-foreground">Loading…</div></MenuLayout>
  if (!item) return <MenuLayout title={tab} showBack backHref={`/inventory/${tab.toLowerCase()}`}><div className="text-muted-foreground">Item not found.</div></MenuLayout>

  async function adjustQty(delta: number) {
    if (!item || !isQtyTab(tab)) return
    setSavingDelta(delta)
    setError(null)
    try {
      const currentQty = parseFloat(values.Qty || item.Qty || '0')
      const newQty = currentQty + delta
      const next = { ...values, Qty: String(newQty), 'Last Used': new Date().toISOString() }
      await upsertInventoryItem({
        tab,
        rowIndex,
        values: next,
        user: getCrewName() || 'crew',
        qtyDelta: delta,
        reason: delta < 0 ? 'Used' : 'Restock',
      })
      setValues(next)
      await queryClient.invalidateQueries({ queryKey: [tab.toLowerCase()] })
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSavingDelta(null)
    }
  }

  async function saveEdits() {
    setSaving(true)
    setError(null)
    try {
      let qtyDelta: number | undefined
      let reason: string | undefined
      if (isQtyTab(tab)) {
        const prevQty = parseFloat(item.Qty || '0')
        const newQty = parseFloat(values.Qty || '0')
        const delta = newQty - prevQty
        if (delta !== 0) {
          qtyDelta = delta
          reason = 'Manual adjust'
        }
      }
      await upsertInventoryItem({
        tab,
        rowIndex,
        values: { ...values },
        user: getCrewName() || 'crew',
        qtyDelta,
        reason,
      })
      await queryClient.invalidateQueries({ queryKey: [tab.toLowerCase()] })
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setLocation(`/inventory/${tab.toLowerCase()}`)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <MenuLayout title={titleFor(tab, item)} showBack backHref={`/inventory/${tab.toLowerCase()}`}>
      <div className="space-y-4">
        {/* Quick +/- only for spares/consumables (which track qty) */}
        {isQtyTab(tab) && (
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
            <div>
              <div className="text-xs text-muted-foreground">Quantity</div>
              <div className="text-3xl font-bold">{values.Qty || '0'}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => adjustQty(-1)}
                disabled={savingDelta !== null}
                className="h-14 w-14 rounded-full bg-red-600 text-white text-2xl font-bold active:bg-red-700 disabled:opacity-50"
              >−</button>
              <button
                onClick={() => adjustQty(1)}
                disabled={savingDelta !== null}
                className="h-14 w-14 rounded-full bg-emerald-600 text-white text-2xl font-bold active:bg-emerald-700 disabled:opacity-50"
              >+</button>
            </div>
          </div>
        )}

        {error && <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">{error}</div>}

        {/* Photo */}
        <div className="p-3 rounded-xl border border-border bg-card">
          <div className="text-sm font-medium mb-2">Photo</div>
          <div className="flex items-start gap-3">
            {photoState ? (
              <a href={photoState.viewUrl} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={photoState.thumbUrl} alt={titleFor(tab, item)} className="w-24 h-24 object-cover rounded-lg border border-border" />
              </a>
            ) : (
              <div className="w-24 h-24 rounded-lg border border-dashed border-border flex items-center justify-center text-2xl text-muted-foreground">📷</div>
            )}
            <div className="flex flex-col gap-2 flex-1">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={uploadingPhoto}
                className="h-10 px-3 rounded-lg bg-secondary border border-border text-sm hover:bg-secondary/80 self-start"
              >
                {uploadingPhoto ? 'Uploading…' : (photoState ? 'Replace photo' : 'Add photo')}
              </button>
              {photoState && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-xs text-red-500 underline self-start"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <PhotoSourcePicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={files => handlePhoto(files)}
            allowAnyFile
          />
        </div>

        {/* Edit form */}
        <div className="space-y-3">
          {fieldsFor(tab).map(f => (
            <div key={f.key}>
              {f.combo === 'location' ? (
                <FieldCombo
                  label={f.label}
                  value={values[f.key] || ''}
                  options={locOptions}
                  onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                />
              ) : f.combo === 'subLocation' ? (
                <FieldCombo
                  label={f.label}
                  value={values[f.key] || ''}
                  options={subOptions}
                  onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                />
              ) : f.combo === 'system' ? (
                <FieldCombo
                  label={f.label}
                  value={values[f.key] || ''}
                  options={systemOptions}
                  onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                />
              ) : f.combo === 'category' ? (
                <FieldCombo
                  label={f.label}
                  value={values[f.key] || ''}
                  options={categoryOptions}
                  onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                />
              ) : (
                <>
                  <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                  {f.options ? (
                    <select
                      value={values[f.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
                    >
                      <option value="">—</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      value={values[f.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border"
                    />
                  ) : (
                    <input
                      type={f.type || 'text'}
                      value={values[f.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
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

        <Button onClick={saveEdits} disabled={saving} className="w-full">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>

        <div className="text-xs text-muted-foreground pt-2">
          ID: <span className="font-mono">{item.ID}</span> · Created by {item['Created By'] || '—'}
        </div>
      </div>
    </MenuLayout>
  )
}
