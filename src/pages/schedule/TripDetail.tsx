import React from 'react'
import { useRoute } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { findTripById, type TripDay, type TripEvent } from '@/data/trips'

function formatRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${fmt(startIso)} – ${fmt(endIso)}`
}

function EventRow({ event }: { event: TripEvent }) {
  return (
    <div className={`relative pl-5 ${event.highlight ? '' : ''}`}>
      {/* dot */}
      <span
        className={`absolute left-0 top-2 w-2.5 h-2.5 rounded-full ${event.highlight ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/60'}`}
      />
      <div className="flex items-baseline gap-2 flex-wrap">
        {event.time && (
          <span className="text-xs font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">
            {event.time}
          </span>
        )}
        <span className={`text-sm ${event.highlight ? 'font-semibold' : 'font-medium'}`}>{event.title}</span>
      </div>
      {event.details && event.details.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {event.details.map((d, i) => (
            <li key={i} className="text-xs text-muted-foreground leading-relaxed">{d}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DayCard({ day, index }: { day: TripDay; index: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header strip */}
      <div className="px-4 py-3 bg-gradient-to-r from-secondary to-card border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono text-primary">Day {index + 1}</span>
          <span className="text-xs text-muted-foreground">{day.date}</span>
        </div>
        <div className="mt-1 text-lg font-bold text-foreground">{day.title}</div>
        {day.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{day.subtitle}</div>}
      </div>

      {/* Events with timeline rail */}
      <div className="relative px-4 py-4">
        <div className="absolute left-[1.4rem] top-4 bottom-4 w-px bg-border" />
        <div className="space-y-3 relative">
          {day.events.map((event, i) => (
            <EventRow key={i} event={event} />
          ))}
        </div>
      </div>

      {/* Overnight footer */}
      {day.overnight && (
        <div className="px-4 py-2.5 bg-secondary/40 border-t border-border flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span className="text-xs text-muted-foreground">Overnight</span>
          <span className="text-xs font-medium text-foreground">{day.overnight}</span>
        </div>
      )}
    </div>
  )
}

export function TripDetailPage() {
  const [, params] = useRoute('/schedule/:id')
  const trip = params?.id ? findTripById(params.id) : undefined

  if (!trip) {
    return (
      <MenuLayout title="Trip" showBack backHref="/schedule">
        <div className="text-sm text-muted-foreground text-center py-8">Trip not found.</div>
      </MenuLayout>
    )
  }

  return (
    <MenuLayout title={trip.name} showBack backHref="/schedule">
      <div className="space-y-4">
        {/* Hero */}
        <div className={`relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br ${trip.hero.gradient}`}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative p-5">
            <div className="text-4xl">{trip.hero.icon}</div>
            <div className="mt-3 text-2xl font-bold text-white">{trip.name}</div>
            <div className="text-sm text-white/85">{trip.subtitle}</div>
            <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span>{formatRange(trip.startDate, trip.endDate)}</span>
              <span className="text-white/50">·</span>
              <span>{trip.days.length} days</span>
            </div>
          </div>
        </div>

        {/* Itinerary days */}
        <div className="space-y-3">
          {trip.days.map((day, i) => (
            <DayCard key={day.isoDate + i} day={day} index={i} />
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 pb-1">
          M/Y Rise Above · Itinerary subject to weather & conditions
        </div>
      </div>
    </MenuLayout>
  )
}