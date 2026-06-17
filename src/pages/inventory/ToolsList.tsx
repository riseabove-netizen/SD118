import React, { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { fetchInventory, TOOL_CATEGORIES, type ToolItem } from '@/lib/inventory'

export function ToolsListPage() {
  const [, setLocation] = useLocation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [needsServiceOnly, setNeedsServiceOnly] = useState(false)

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['tools'],
    queryFn: () => fetchInventory('Tools') as Promise<ToolItem[]>,
  })

  const items = useMemo(() => {
    const list = data || []
    return list.filter(it => {
      if (category !== 'All' && it.Category !== category) return false
      if (needsServiceOnly) {
        const cond = (it.Condition || '').toLowerCase()
        if (cond !== 'needs service' && cond !== 'broken' && cond !== 'fair') return false
      }
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = [it.Name, it.Brand, it['Model / Serial'], it.Category, it['Sub-Location'], it.Notes]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [data, query, category, needsServiceOnly])

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
          {['All', ...TOOL_CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 h-9 rounded-full text-sm border ${category === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm select-none">
            <input type="checkbox" checked={needsServiceOnly} onChange={e => setNeedsServiceOnly(e.target.checked)} className="h-4 w-4 accent-red-600" />
            Needs service / broken only
          </label>
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
