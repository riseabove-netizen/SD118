import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'

interface TileProps {
  icon: string
  label: string
  href: string
  description: string
  comingSoon?: boolean
}

function Tile({ icon, label, href, description, comingSoon }: TileProps) {
  const [, setLocation] = useLocation()
  return (
    <button
      onClick={() => setLocation(href)}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left min-h-[72px]"
    >
      <span className="text-2xl flex-shrink-0 w-10 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold">{label}</div>
          {comingSoon && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
              Coming soon
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
      </div>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

export function WatchHubPage() {
  return (
    <MenuLayout title="Watch Duties" showBack backHref="/menu">
      <div className="space-y-3">
        <Tile
          icon="🗓️"
          label="Watch Calendar"
          href="/watch/calendar"
          description="Who's on watch — by day"
        />
        <Tile
          icon="✅"
          label="Watch Duties"
          href="/watch/duties"
          description="Today's checklist — resets at midnight"
        />
        <Tile
          icon="⚓"
          label="Anchor Watchkeeper Log"
          href="/ism/anchor-watch"
          description="Shared hourly watch with PDF export to Drive"
        />
      </div>
    </MenuLayout>
  )
}
