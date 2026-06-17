import React, { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { fetchInventory, CONSUMABLE_CATEGORIES, type ConsumableItem } from '@/lib/inventory'

export function ConsumablesListPage() {
  const [, setLocation] = useLocation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [lowOnly, setLowOnly] = useState(false)

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['consumables'],
    queryFn: () => fetchInventory('Consumables') as Promise<ConsumableItem[]>,
  })

  const items = useMemo(() => {
    const list = data || []
    return list.filter(it => {
      if (category !== 'All' && it.Category !== category) return false
      if (lowOnly) {
        const q = parseFloat(it.Qty || '0')
        const min = parseFloat(it['Min Qty'] || '0')
        if (!(q <= min && min > 0)) return false
      }
      if (query.trim()) {
        const q = query.toLowerCase()
        const hay = [it.Item, it.Category, it['Sub-Location'], it.Notes]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [data, query, category, lowOnly])

  // Restock list
  const restockList = useMemo(() => {
    const list = data || []
    return list
      .filter(it => {
        const q = parseFloat(it.Qty || '0')
        const min = parseFloat(it['Min Qty'] || '0')
        return q <= min && min > 0
      })
      .map(it => {
        const q = parseFloat(it.Qty || '0')
        const max = parseFloat(it['Max Qty'] || '0')
        const need = max > 0 ? Math.max(0, max - q) : Math.max(1, parseFloat(it['Min Qty'] || '0'))
        return `${it.Item} — ${need} ${it.Unit || 'ea'} (${it.Category}, ${it['Sub-Location']})`
      })
      .join('\n')
  }, [data])

  function copyRestockList() {
    if (!restockList) {
      alert('No items below min qty')
      return
    }
    navigator.clipboard.writeText(`Rise Above — Restock list (${new Date().toLocaleDateString()}):\n\n${restockList}`)
      .then(() => alert('Restock list copied to clipboard'))
      .catch(() => alert('Could not copy'))
  }

  return (
    <MenuLayout title="Consumables" showBack backHref="/inventory">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search items…"
            className="flex-1 h-11 px-3 rounded-lg bg-secondary text-foreground border border-border"
          />
          <Button onClick={() => setLocation('/inventory/consumables/new')}>+ Add</Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {['All', ...CONSUMABLE_CATEGORIES].map(c => (
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
            <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} className="h-4 w-4 accent-red-600" />
            Low stock only
          </label>
          <button onClick={copyRestockList} className="text-sm text-primary underline underline-offset-2">
            Copy restock list
          </button>
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
                onClick={() => setLocation(`/inventory/consumables/${it.rowIndex}`)}
                className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-medium truncate">{it.Item || '(no name)'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[it.Category, it['Sub-Location']].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-bold ${low ? 'text-red-500' : ''}`}>
                      {it.Qty || '0'} <span className="text-xs text-muted-foreground font-normal">{it.Unit || ''}</span>
                    </div>
                    {min > 0 && <div className="text-xs text-muted-foreground">min {min}</div>}
                  </div>
                </div>
              </button>
            )
          })}
          {!isLoading && items.length === 0 && (
            <div className="text-muted-foreground text-sm text-center py-8">
              No items match. Tap + Add to log one.
            </div>
          )}
        </div>

        {isRefetching && <div className="text-xs text-muted-foreground text-center">Refreshing…</div>}
      </div>
    </MenuLayout>
  )
}