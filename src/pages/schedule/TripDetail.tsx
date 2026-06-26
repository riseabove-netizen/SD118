import React, { useState } from 'react'
import { useRoute } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { findTripById, type TripDay, type TripEvent } from '@/data/trips'
import { shareLink } from '@/lib/share-link'
import { printTripAsPdf } from '@/lib/trip-share'

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
      <div className="px-4 py-3 bg-gradient-to-r from-secondary to-card border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono text-primary">Day {index + 1}</span>
          <span className="text-xs text-muted-foreground">{day.date}</span>
        </div>
        <div className="mt-1 text-lg font-bold text-foreground">{day.title}</div>
        {day.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{day.subtitle}</div>}
      </div>

      <div className="relative px-4 py-4">
        <div className="absolute left-[1.4rem] top-4 bottom-4 w-px bg-border" />
        <div className="space-y-3 relative">
          {day.events.map((event, i) => (
            <EventRow key={i} event={event} />
          ))}
        </div>
      </div>

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
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  if (!trip) {
    return (
      <MenuLayout title="Trip" showBack backHref="/schedule">
        <div className="text-sm text-muted-foreground text-center py-8">Trip not found.</div>
      </MenuLayout>
    )
  }

  async function handleShareLink() {
    if (!trip) return
    setShareOpen(false)
    const url = `${window.location.origin}/schedule/${trip.id}`
    const result = await shareLink({ title: trip.name, text: `${trip.name} — ${trip.subtitle}`, url })
    if (result === 'copied') setShareMsg('Link copied to clipboard')
    else if (result === 'failed') setShareMsg('Could not share — link is in the address bar')
    if (result === 'copied' || result === 'failed') {
      setTimeout(() => setShareMsg(null), 2500)
    }
  }

  function handlePdf() {
    if (!trip) return
    setShareOpen(false)
    printTripAsPdf(trip)
  }

  return (
    <MenuLayout
      title={trip.name}
      showBack
      backHref="/schedule"
      rightAction={{
        icon: <ShareIcon />,
        ariaLabel: 'Share trip',
        onClick: () => setShareOpen(true),
      }}
    >
      <div className="space-y-4">
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

        <div className="space-y-3">
          {trip.days.map((day, i) => (
            <DayCard key={day.isoDate + i} day={day} index={i} />
          ))}
        </div>

        <div className="pt-2">
          <button
            onClick={() => setShareOpen(true)}
            className="w-full h-11 rounded-lg border border-border bg-card text-foreground font-medium flex items-center justify-center gap-2"
          >
            <ShareIcon />
            Share trip
          </button>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 pb-1">
          M/Y Rise Above · Itinerary subject to weather &amp; conditions
        </div>
      </div>

      {shareMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-card border border-border text-sm shadow-lg z-50">
          {shareMsg}
        </div>
      )}

      {shareOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-border p-4 space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-base font-semibold pb-2 border-b border-border">Share trip</div>
            <button
              onClick={handleShareLink}
              className="w-full h-12 rounded-lg bg-secondary text-foreground font-medium flex items-center gap-3 px-4 text-left"
            >
              <LinkIcon />
              <div className="flex-1">
                <div>Share link</div>
                <div className="text-xs text-muted-foreground">Send via Messages, Mail, WhatsApp…</div>
              </div>
            </button>
            <button
              onClick={handlePdf}
              className="w-full h-12 rounded-lg bg-secondary text-foreground font-medium flex items-center gap-3 px-4 text-left"
            >
              <PdfIcon />
              <div className="flex-1">
                <div>Save as PDF</div>
                <div className="text-xs text-muted-foreground">Opens print dialog → Save as PDF</div>
              </div>
            </button>
            <button
              onClick={() => setShareOpen(false)}
              className="w-full h-10 rounded-lg text-muted-foreground text-sm mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </MenuLayout>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}
