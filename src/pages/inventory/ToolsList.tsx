import React, { useMemo } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import {
  fetchInventory,
  mergeOptions,
  TOOL_CATEGORIES,
  TOOL_LOCATIONS,
  TOOL_SUB_LOCATIONS,
  TOOL_CONDITIONS,
  type ToolItem,
} from '@/lib/inventory'
import {
  useUrlParams,
  getParam,
  getMultiParam,
  setSingle,
  setMulti,
} from '@/lib/listUrlState'

export function ToolsListPage() {
  const [, setLocation] = useLocation()
  const [params, updateParams] = useUrlParams()

  const query = getParam(params, 'q')
  const categories = getMultiParam(params, 'category')
  const locations = getMultiParam(params, 'loc')
  const subLocations = getMultiParam(params, 'subloc')
  const conditions = getMultiParam(params, 'cond')

  function setQuery(v: string) { updateParams(p => setSingle(p, 'q', v)) }
  function setCategories(v: string[]) { updateParams(p => setMulti(p, 'category', v)) }
  function setLocations(v: string[]) { updateParams(p => setMulti(p, 'loc', v)) }
  function setSubLocations(v: string[]) { updateParams(p => setMulti(p, 'subloc', v)) }
  function setConditions(v: string[]) { updateParams(p => setMulti(p, 'cond', v)) }

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['tools'],
    queryFn: () => fetchInventory('Tools') as Promise<ToolItem[]>,
  })

  const list = data || []

  const categoryOptions = useMemo(
    () => mergeOptions(TOOL_CATEGORIES, list.map(it => it.Category || '')),
    [list]
  )
  const locationOptions = useMemo(
    () => mergeOptions(TOOL_LOCATIONS, list.map(it => it.Location || '')),
    [list]
  )
  const subLocationOptions = useMemo(
    () => mergeOptions(TOOL_SUB_LOCATIONS, list.map(it => it['Sub-Location'] || '')),
    [list]
  )
  const conditionOptions = useMemo(
    () => mergeOptions(TOOL_CONDITIONS, list.map(it => it.Condition || '')),
    [list]
  )

  const items = useMemo(() => {
    return list.filter(it => {
      if (categories.length > 0 && !categories.includes(it.Category || '')) return false
      if (locations.length > 0 && !locations.includes(it.Location || '')) return false
      if (subLocations.length > 0 && !subLocations.includes(it['Sub-Location'] || '')) return false
      if (conditions.length > 0 && !conditions.includes(it.Condition || '')) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = [it.Name, it.Brand, it['Model / Serial'], it.Category, it.Location, it['Sub-Location'], it.Notes]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [list, query, categories, locations, subLocations, conditions])

  const activeFilterCount = categories.length + locations.length + subLocations.length + conditions.length

  function clearAllFilters() {
    updateParams(p => {
      p.delete('category'); p.delete('loc'); p.delete('subloc'); p.delete('cond')
    })
  }

  function conditionColor(c: string) {
    const v = (c || '').toLowerCase()
    if (v === 'broken') return 'text-red-500'
    if (v === 'needs service') return 'text-orange-400'
    if (v === 'fair') return 'text-yellow-400'
    return 'text-muted-foreground'
  }

  return (
    <MenuLayout title="Tools" showBack backHref="/inventory">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="flex-1 h-11 px-3 rounded-lg bg-secondary text-foreground border border-border"
          />
          <Button onClick={() => setLocation('/inventory/tools/new')}>+ Add</Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <MultiSelectFilter label="Category" options={categoryOptions} selected={categories} onChange={setCategories} />
          <MultiSelectFilter label="Location" options={locationOptions} selected={locations} onChange={setLocations} />
          <MultiSelectFilter label="Sub-Location" options={subLocationOptions} selected={subLocations} onChange={setSubLocations} />
          <MultiSelectFilter label="Condition" options={conditionOptions} selected={conditions} onChange={setConditions} />
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
          {items.map(it => (
            <button
              key={it.ID || it.rowIndex}
              onClick={() => setLocation(`/inventory/tools/${it.rowIndex}`)}
              className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                {it['Photo URL'] ? (
                  <img src={it['Photo URL']} alt="" className="w-12 h-12 rounded-md object-cover border border-border shrink-0" loading="lazy" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium truncate">{it.Name || '(no name)'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[it.Category, it.Brand, it['Sub-Location']].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-semibold ${conditionColor(it.Condition)}`}>
                    {it.Condition || '—'}
                  </div>
                  {it['Model / Serial'] && (
                    <div className="text-xs text-muted-foreground truncate max-w-[10rem]">{it['Model / Serial']}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
          {!isLoading && items.length === 0 && (
            <div className="text-muted-foreground text-sm text-center py-8">
              No tools match. Tap + Add to log one.
            </div>
          )}
        </div>

        {isRefetching && <div className="text-xs text-muted-foreground text-center">Refreshing…</div>}
      </div>
    </MenuLayout>
  )
}
