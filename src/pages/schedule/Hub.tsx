import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { TRIPS, Trip } from '@/data/trips'
import { isLoggedIn } from '@/lib/auth'

function formatRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return `${fmt(startIso)} – ${fmt(endIso)}`
}

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Trips we surface on the Schedule hub. `hidden` trips (cancelled
// alternates, planning branches, …) stay off the list; keep this a
// single source of truth so the "Past trips" folder and the upcoming
// list use the same allow-list.
const HUB_TRIP_IDS = ['june-honeymoon-2026']

export function ScheduleHubPage() {
  const [, setLocation] = useLocation()

  // Public guests can only view a single itinerary via direct deep link.
  // If they try to reach the schedule hub (the list of all trips), bounce them
  // to the sign-in page so they can't browse other trips.
  useEffect(() => {
    if (!isLoggedIn()) {
      setLocation('/')
    }
  }, [setLocation])

  const { upcoming, past } = useMemo(() => {
    const upcoming: Trip[] = []
    const past: Trip[] = []
    for (const id of HUB_TRIP_IDS) {
      const trip = TRIPS.find(t => t.id === id)
      if (!trip) continue
      if (daysUntil(trip.endDate) < 0) past.push(trip)
      else upcoming.push(trip)
    }
    // Past trips: newest end date first so the most-recent bachelor /
    // honeymoon / delivery leg is at the top of the folder.
    past.sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
    return { upcoming, past }
  }, [])

  if (!isLoggedIn()) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="text-base font-semibold">Sign in required</div>
          <p className="text-sm text-muted-foreground">
            Use a direct trip link to view a single itinerary, or sign in to see the full schedule.
          </p>
        </div>
      </div>
    )
  }

  return (
    <MenuLayout title="Schedule" showBack backHref="/menu">
      <div className="space-y-3">
        {/* Calendar view — same look as the watch calendar */}
        <button
          onClick={() => setLocation('/schedule/calendar')}
          className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/60 transition-colors"
        >
          <span className="text-2xl">🗓️</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Schedule Calendar</div>
            <div className="text-xs text-muted-foreground">Month view · anchor vs dock · planning windows</div>
          </div>
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Featured: consolidated summer-trip page */}
        <button
          onClick={() => setLocation('/schedule/enricos-summer-trip')}
          className="relative w-full text-left rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-br from-indigo-900 via-purple-800 to-rose-700 active:scale-[0.99] transition-transform"
        >
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-3xl">🛥️</div>
              <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">Summer 2026</div>
            </div>
            <div className="mt-3 text-xl font-bold text-white">Enrico's Attempt at Retirement</div>
            <div className="text-sm text-white/85">All 15 stops · Balearics → Croatia</div>
            <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span>Aug 4 – Sep 30</span>
              <span className="text-white/50">·</span>
              <span>Consolidated view</span>
            </div>
          </div>
        </button>

        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            No trips on the schedule yet.
          </div>
        )}

        {upcoming.map(trip => (
          <TripCard key={trip.id} trip={trip} onClick={() => setLocation(`/schedule/${trip.id}`)} />
        ))}

        {past.length > 0 && (
          <PastTripsFolder trips={past} onOpen={id => setLocation(`/schedule/${id}`)} />
        )}
      </div>
    </MenuLayout>
  )
}

function TripCard({ trip, onClick }: { trip: Trip; onClick(): void }) {
  const startDays = daysUntil(trip.startDate)
  const endDays = daysUntil(trip.endDate)
  const isPast = endDays < 0
  const isActive = startDays <= 0 && endDays >= 0
  let badge: string
  let badgeClass: string
  if (isActive) {
    badge = 'In progress'
    badgeClass = 'bg-emerald-600 text-white'
  } else if (isPast) {
    badge = 'Completed'
    badgeClass = 'bg-secondary text-muted-foreground'
  } else if (startDays === 0) {
    badge = 'Starts today'
    badgeClass = 'bg-primary text-primary-foreground'
  } else if (startDays === 1) {
    badge = 'Tomorrow'
    badgeClass = 'bg-primary text-primary-foreground'
  } else {
    badge = `In ${startDays} days`
    badgeClass = 'bg-primary/20 text-primary border border-primary/30'
  }
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl overflow-hidden border border-border bg-gradient-to-br ${trip.hero.gradient} active:scale-[0.99] transition-transform`}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-3xl">{trip.hero.icon}</div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>{badge}</div>
        </div>
        <div className="mt-3 text-xl font-bold text-white">{trip.name}</div>
        <div className="text-sm text-white/85">{trip.subtitle}</div>
        <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          <span>{formatRange(trip.startDate, trip.endDate)}</span>
          <span className="text-white/50">·</span>
          <span>{trip.days.length} days</span>
        </div>
      </div>
    </button>
  )
}

// Collapsible folder that keeps completed voyages out of the way but
// reachable in one tap. Renders as a single dark card by default and
// expands into the trip cards when opened.
function PastTripsFolder({ trips, onOpen }: { trips: Trip[]; onOpen(id: string): void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/60 transition-colors"
      >
        <span className="text-2xl">📁</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Past trips</div>
          <div className="text-xs text-muted-foreground">
            {trips.length} completed voyage{trips.length === 1 ? '' : 's'}
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} onClick={() => onOpen(trip.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
