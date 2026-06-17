import React, { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { fetchInventory, SPARE_SYSTEMS, type SpareItem } from '@/lib/inventory'

export function SparesListPage() {
  const [, setLocation] = useLocation()
  const [query, setQuery] = useState('')
  const [system, setSystem] = useState<string>('All')
  const [lowOnly, setLowOnly] = useState(false)

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['spares'],
    queryFn: () => fetchInventory('Spares') as Promise<SpareItem[]>,
  })

  const items = useMemo(() => {
    const list = data || []
    return list.filter(it => {
      if (system !== 'All' && it.System !== system) return false
      if (lowOnly) {
        const q = parseFloat(it.Qty || '0')
        const min = parseFloat(it['Min Qty'] || '0')
        if (!(q <= min && min > 0)) return false
      }
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = [it['Part Number'], it.Description, it.Manufacturer, it['Sub-Location'], it.Notes]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [data, query, system, lowOnly])

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
          {['All', ...SPARE_SYSTEMS].map(s => (
            <button
              key={s}
              onClick={() => setSystem(s)}
              className={`shrink-0 px-3 h-9 rounded-full text-sm border ${system === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm select-none">
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} className="h-4 w-4 accent-red-600" />
          Low stock only
        </label>

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