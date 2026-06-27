import React from 'react'
import { MenuLayout } from '@/components/MenuLayout'

const CAL_SRC =
  'https://calendar.google.com/calendar/embed?src=c_73f50e718a59d11e5c7b773356918294dc20b765db2abf207e55d3c6449adece%40group.calendar.google.com&ctz=Europe%2FMadrid'

export function WatchCalendarPage() {
  return (
    <MenuLayout title="Watch Calendar" showBack backHref="/watch">
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="aspect-[4/5] sm:aspect-[4/3] w-full bg-white">
            <iframe
              src={CAL_SRC}
              title="Watch Calendar"
              className="w-full h-full block"
              style={{ border: 0 }}
              frameBorder={0}
              scrolling="no"
              loading="lazy"
            />
          </div>
        </div>
        <a
          href={CAL_SRC}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-11 rounded-lg border border-border bg-card text-primary font-medium flex items-center justify-center gap-2"
        >
          Open calendar in new tab →
        </a>
        <div className="text-xs text-muted-foreground text-center pt-1">
          M/Y Rise Above · Watch rotation
        </div>
      </div>
    </MenuLayout>
  )
}
