import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { fetchTransactions, type Transaction } from '@/lib/inventory'

export function TransactionsListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions'],
    queryFn: fetchTransactions,
  })

  const items = (data || []).slice().reverse() // newest first

  return (
    <MenuLayout title="Transactions" showBack backHref="/inventory">
      <div className="space-y-2">
        {isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">
            {(error as Error).message}
          </div>
        )}
        {items.length === 0 && !isLoading && (
          <div className="text-muted-foreground text-sm text-center py-8">No transactions yet.</div>
        )}
        {items.map((t: Transaction, i) => {
          const delta = parseFloat(t.Delta || '0')
          const positive = delta > 0
          return (
            <div key={i} className="p-3 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t['Item Name'] || '(unnamed)'}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.Tab} · {t.User || '—'} · {new Date(t.Timestamp).toLocaleString()}
                  </div>
                  {t.Reason && <div className="text-xs text-muted-foreground mt-0.5">{t.Reason}</div>}
                </div>
                <div className={`text-lg font-bold shrink-0 ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {positive ? '+' : ''}{t.Delta}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </MenuLayout>
  )
}