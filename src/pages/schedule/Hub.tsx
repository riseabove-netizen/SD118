import React, { useEffect } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { TRIPS } from '@/data/trips'
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
            <div className="text-sm text-white/85">All 15 chapters · Balearics → Croatia</div>
            <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span>Aug 4 – Sep 30</span>
              <span className="text-white/50">·</span>
              <span>Consolidated view</span>
            </div>
          </div>
        </button>

        {TRIPS.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            No trips on the schedule yet.
          </div>
        )}
        {TRIPS.filter(t => t.id === 'june-honeymoon-2026').map(trip => {
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
              key={trip.id}
              onClick={() => setLocation(`/schedule/${trip.id}`)}
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
        })}
      </div>
    </MenuLayout>
  )
}