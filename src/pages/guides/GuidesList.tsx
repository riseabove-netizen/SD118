import React, { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { fetchGuides } from '@/lib/guides'

export function GuidesListPage() {
  const [, setLocation] = useLocation()
  const [search, setSearch] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['guides'],
    queryFn: fetchGuides,
  })

  const guides = useMemo(() => {
    // Hide records that are owned by other pages (Fire Equipment list, Drills
    // / Testing) — they live under the ISM menu, not under Operational Guides.
    const list = (data || []).filter(g => {
      const id = g.ID || ''
      return !id.startsWith('FIRE-') && !id.startsWith('DRILLS-')
    })
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(g =>
      (g.Title || '').toLowerCase().includes(q) ||
      (g.Category || '').toLowerCase().includes(q),
    )
  }, [data, search])

  return (
    <MenuLayout
      title="Operational Guides"
      showBack
      backHref="/menu"
      rightAction={{
        icon: '+',
        ariaLabel: 'Create new guide',
        onClick: () => setLocation('/guides/new'),
      }}
    >
      <div className="space-y-3">
        {/* Permanent: Vessel Manual tile */}
        <button
          onClick={() => setLocation('/guides/manual')}
          className="w-full text-left p-4 rounded-xl border border-red-500/30 bg-card hover:bg-red-500/5 active:bg-red-500/10 transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">📕</span>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold">SD118 Vessel Manual</div>
              <div className="text-xs text-muted-foreground mt-0.5">Sanlorenzo SD118 · English</div>
              <div className="text-xs text-muted-foreground mt-1">View inline or download to your device</div>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search guides..."
          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm"
        />

        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading guides...</div>
        )}
        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">
            {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && guides.length === 0 && (
          <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-3">
            <div className="text-2xl">📖</div>
            <div className="text-base font-semibold">No guides yet</div>
            <div className="text-sm text-muted-foreground">
              Tap the + button to create your first operational guide.
            </div>
            <button
              onClick={() => setLocation('/guides/new')}
              className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              + New Guide
            </button>
          </div>
        )}

        {guides.map(g => (
          <button
            key={g.ID}
            onClick={() => setLocation(`/guides/${g.ID}`)}
            className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">📖</span>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold truncate">{g.Title}</div>
                {g.Category && (
                  <div className="text-xs text-muted-foreground mt-0.5">{g.Category}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  v{g['Current Version']} · updated {formatDate(g['Updated At'])}
                  {g['Updated By'] && ` by ${g['Updated By']}`}
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </MenuLayout>
  )
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}
