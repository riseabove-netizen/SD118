import React from 'react'
import { MenuLayout } from '@/components/MenuLayout'

export function WatchCalendarPage() {
  return (
    <MenuLayout title="Watch Calendar" showBack backHref="/watch">
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center space-y-3">
        <div className="text-5xl">🗓️</div>
        <div className="text-lg font-semibold">Watch Calendar</div>
        <div className="text-sm text-muted-foreground max-w-sm mx-auto">
          A rotating schedule of who's on watch will live here — by day and by crew member.
          Reserved for the next round.
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 pt-2">
          Coming soon
        </div>
      </div>
    </MenuLayout>
  )
}
