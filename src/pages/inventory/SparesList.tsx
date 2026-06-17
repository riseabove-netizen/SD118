import React, { useMemo } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import {
  fetchInventory,
  mergeOptions,
  SPARE_SYSTEMS,
  SPARE_LOCATIONS,
  SPARE_SUB_LOCATIONS,
  type SpareItem,
} from '@/lib/inventory'
import {
  useUrlParams,
  getParam,
  getMultiParam,
  setSingle,
  setMulti,
} from '@/lib/listUrlState'

export function SparesListPage() {
  const [, setLocation] = useLocation()
  const [params, updateParams] = useUrlParams()

  const query = getParam(params, 'q')
  const systems = getMultiParam(params, 'system')
  const locations = getMultiParam(params, 'loc')
  const subLocations = getMultiParam(params, 'subloc')
  const lowOnly = getParam(params, 'low') === '1'

  function setQuery(v: string) { updateParams(p => setSingle(p, 'q', v)) }
  function setSystems(v: string[]) { updateParams(p => setMulti(p, 'system', v)) }
  function setLocations(v: string[]) { updateParams(p => setMulti(p, 'loc', v)) }
  function setSubLocations(v: string[]) { updateParams(p => setMulti(p, 'subloc', v)) }
  function setLowOnly(v: boolean) { updateParams(p => setSingle(p, 'low', v ? '1' : '')) }

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['spares'],
    queryFn: () => fetchInventory('Spares') as Promise<SpareItem[]>,
  })

  // Derive filter options from preset list + values actually used in data.
  const list = data || []
  const systemOptions = useMemo(
    () => mergeOptions(SPARE_SYSTEMS, list.map(it => it.System || '')),
    [list]
  )
  const locationOptions = useMemo(
    () => mergeOptions(SPARE_LOCATIONS, list.map(it => it.Location || '')),
    [list]
  )
  const subLocationOptions = useMemo(
    () => mergeOptions(SPARE_SUB_LOCATIONS, list.map(it => it['Sub-Location'] || '')),
    [list]
  )

  const items = useMemo(() => {
    return list.filter(it => {
      if (systems.length > 0 && !systems.includes(it.System || '')) return false
      if (locations.length > 0 && !locations.includes(it.Location || '')) return false
      if (subLocations.length > 0 && !subLocations.includes(it['Sub-Location'] || '')) return false
      if (lowOnly) {
        const q = parseFloat(it.Qty || '0')
        const min = parseFloat(it['Min Qty'] || '0')
        if (!(q <= min && min > 0)) return false
      }
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = [it['Part Number'], it.Description, it.Manufacturer, it.System, it.Location, it['Sub-Location'], it.Notes]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [list, query, systems, locations, subLocations, lowOnly])

  const activeFilterCount = systems.length + locations.length + subLocations.length + (lowOnly ? 1 : 0)

  function clearAllFilters() {
    updateParams(p => {
      p.delete('system'); p.delete('loc'); p.delete('subloc'); p.delete('low')
    })
  }

  return (
    <MenuLayout title="Spares" showBack backHref="/inventory">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search part number, description…"
            className="flex-1 h-11 px-3 rounded-lg bg-secondary text-foreground border border-border"
          />
          <Button onClick={() => setLocation('/inventory/spares/new')}>+ Add</Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <MultiSelectFilter label="System" options={systemOptions} selected={systems} onChange={setSystems} />
          <MultiSelectFilter label="Location" options={locationOptions} selected={locations} onChange={setLocations} />
          <MultiSelectFilter label="Sub-Location" options={subLocationOptions} selected={subLocations} onChange={setSubLocations} />
          <button
            type="button"
            onClick={() => setLowOnly(!lowOnly)}
            className={`shrink-0 px-3 h-9 rounded-full text-sm border ${lowOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}
          >
            Low stock
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="shrink-0 px-3 h-9 rounded-full text-sm border border-border bg-transparent text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        {isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">
            {(error as Error).message}
            <button onClick={() => refetch()} className="ml-2 underline">retry</button>
          </div>
        )}

        <div className="space-y-2">
          {items.map(it => {
            const q = parseFloat(it.Qty || '0')
            const min = parseFloat(it['Min Qty'] || '0')
            const low = q <= min && min > 0
            return (
              <button
                key={it.ID || it.rowIndex}
                onClick={() => setLocation(`/inventory/spares/${it.rowIndex}`)}
                className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  {it['Photo URL'] ? (
                    <img src={it['Photo URL']} alt="" className="w-12 h-12 rounded-md object-cover border border-border shrink-0" loading="lazy" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm text-primary truncate">{it['Part Number'] || '(no part #)'}</div>
                    <div className="text-base font-medium truncate">{it.Description || '—'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[it.Manufacturer, it.System, it['Sub-Location']].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-bold ${low ? 'text-red-500' : ''}`}>{it.Qty || '0'}</div>
                    {min > 0 && <div className="text-xs text-muted-foreground">min {min}</div>}
                  </div>
                </div>
              </button>
            )
          })}
          {!isLoading && items.length === 0 && (
            <div className="text-muted-foreground text-sm text-center py-8">
              No spares match. Tap + Add to log one.
            </div>
          )}
        </div>

        {isRefetching && <div className="text-xs text-muted-foreground text-center">Refreshing…</div>}
      </div>
    </MenuLayout>
  )
}
