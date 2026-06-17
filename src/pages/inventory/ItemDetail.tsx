import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { FieldCombo } from '@/components/FieldCombo'
import { getCrewName } from '@/lib/auth'
import {
  fetchInventory,
  upsertInventoryItem,
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

type FieldDef = {
  key: string
  label: string
  type?: string
  options?: string[]
  placeholder?: string
  combo?: 'location' | 'subLocation'
}

const SPARE_FIELDS: FieldDef[] = [
  { key: 'Part Number', label: 'Part Number', placeholder: 'e.g. 1R-1808 (optional)' },
  { key: 'Description', label: 'Description', placeholder: 'e.g. Fuel filter element' },
  { key: 'Manufacturer', label: 'Manufacturer', placeholder: 'CAT, Racor, etc.' },
  { key: 'System', label: 'System', options: SPARE_SYSTEMS },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Qty', label: 'Quantity on hand', type: 'number' },
  { key: 'Min Qty', label: 'Min Qty (restock threshold)', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const CONSUMABLE_FIELDS: FieldDef[] = [
  { key: 'Item', label: 'Item name', placeholder: 'e.g. Dish soap' },
  { key: 'Category', label: 'Category', options: CONSUMABLE_CATEGORIES },
  { key: 'Location', label: 'Location', combo: 'location' },
  { key: 'Sub-Location', label: 'Sub-Location', combo: 'subLocation' },
  { key: 'Qty', label: 'Quantity on hand', type: 'number' },
  { key: 'Unit', label: 'Unit', placeholder: 'ea, bottle, roll…' },
  { key: 'Min Qty', label: 'Min Qty', type: 'number' },
  { key: 'Max Qty', label: 'Max Qty', type: 'number' },
  { key: 'Notes', label: 'Notes', type: 'textarea' },
]

const TOOL_FIELDS: FieldDef[] = [
  { key: 'Name', label: 'Name', placeholder: 'e.g. Fluke 117 Multimeter' },
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

function isQtyTab(tab: InventoryTab) {
  return tab === 'Spares' || tab === 'Consumables'
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
  const params: { row?: string } | null =
    tab === 'Spares' ? (paramsSpare as any)
    : tab === 'Tools' ? (paramsTools as any)
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
  const locOptions = useMemo(() => mergeOptions(presetLocations(tab), usedLocations), [tab, usedLocations])
  const subOptions = useMemo(() => mergeOptions(presetSubLocations(tab), usedSubLocations), [tab, usedSubLocations])

  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savingDelta, setSavingDelta] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      const initial: Record<string, string> = {}
      fieldsFor(tab).forEach(f => { initial[f.key] = item[f.key] || '' })
      setValues(initial)
    }
  }, [item, tab])

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
