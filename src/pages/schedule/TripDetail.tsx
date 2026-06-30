import React, { useEffect, useRef, useState } from 'react'
import { useRoute } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { findTripById, loadTrip, saveTrip, mapsLink, type Trip, type TripDay, type TripEvent } from '@/data/trips'
import { shareLink } from '@/lib/share-link'
import { printTripAsPdf } from '@/lib/trip-share'
import { isLoggedIn, isAdmin, getCrewName } from '@/lib/auth'

function formatRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${fmt(startIso)} – ${fmt(endIso)}`
}

function EventRow({ event }: { event: TripEvent }) {
  const titleClass = `text-sm ${event.highlight ? 'font-semibold' : 'font-medium'}`
  const titleNode = event.link ? (
    <a
      href={event.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`${titleClass} text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary`}
    >
      {event.title}
    </a>
  ) : (
    <span className={titleClass}>{event.title}</span>
  )

  return (
    <div className={`relative pl-5 ${event.highlight ? '' : ''}`}>
      <span
        className={`absolute left-0 top-2 w-2.5 h-2.5 rounded-full ${event.highlight ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/60'}`}
      />
      <div className="flex items-start gap-2 flex-wrap">
        {event.time && (
          <span className="text-xs font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10 mt-0.5">
            {event.time}
          </span>
        )}
        {event.locationImage && (
          <img
            src={event.locationImage}
            alt=""
            loading="lazy"
            className="w-10 h-10 rounded object-cover border border-border shrink-0"
          />
        )}
        <span className="flex-1 min-w-0">{titleNode}</span>
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

function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DayCard = React.forwardRef<HTMLDivElement, { day: TripDay; index: number; isToday?: boolean }>(
  function DayCard({ day, index, isToday }, ref) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl border bg-card overflow-hidden ${isToday ? 'border-primary ring-2 ring-primary/40 shadow-[0_0_0_4px_rgba(220,38,38,0.08)]' : 'border-border'}`}
    >
      <div className={`px-4 py-3 border-b ${isToday ? 'bg-gradient-to-r from-primary/25 to-card border-primary/30' : 'bg-gradient-to-r from-secondary to-card border-border'}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono text-primary">Day {index + 1}</span>
          <span className="text-xs text-muted-foreground">{day.date}</span>
          {isToday && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
              Today
            </span>
          )}
        </div>
        <div className="mt-1 text-lg font-bold text-foreground">{day.title}</div>
        {day.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{day.subtitle}</div>}
      </div>

      {day.imageUrl && (
        <div className="relative">
          <img
            src={day.imageUrl}
            alt={day.imageCaption || day.title}
            loading="lazy"
            className="w-full h-40 object-cover"
          />
          {day.imageCaption && (
            <div className="absolute bottom-0 inset-x-0 px-3 py-1.5 text-[11px] text-white bg-gradient-to-t from-black/70 to-transparent">
              {day.imageCaption}
            </div>
          )}
        </div>
      )}

      {day.dock && (
        <div className="px-4 py-2.5 bg-secondary/30 border-b border-border space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v10M5 12h14M3 22c4-2 6-4 9-4s5 2 9 4" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dock</span>
            {day.dock.marinaLink ? (
              <a
                href={day.dock.marinaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-primary underline decoration-primary/40 underline-offset-2"
              >
                {day.dock.marina}
              </a>
            ) : (
              <span className="text-xs font-semibold text-foreground">{day.dock.marina}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px]">
            {day.dock.radioChannel && (
              <span className="font-mono text-primary">VHF {day.dock.radioChannel}</span>
            )}
            {day.dock.eta && (
              <span className="text-muted-foreground">ETA <span className="font-mono text-foreground">{day.dock.eta}</span></span>
            )}
            {day.dock.etd && (
              <span className="text-muted-foreground">ETD <span className="font-mono text-foreground">{day.dock.etd}</span></span>
            )}
          </div>
          {day.dock.notes && (
            <div className="text-[11px] text-muted-foreground leading-relaxed">{day.dock.notes}</div>
          )}
        </div>
      )}

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

      {day.leg && (
        <div className="px-4 py-2.5 bg-black/30 border-t border-primary/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">{day.leg.label || 'Leg'}</span>
            {day.leg.route && (
              <span className="text-xs font-semibold text-foreground">{day.leg.route}</span>
            )}
          </div>
          {day.leg.sub && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{day.leg.sub}</div>
          )}
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground mt-1">
            {day.leg.miles && <span><span className="font-mono text-foreground">{day.leg.miles}</span> mi</span>}
            {day.leg.duration && <span><span className="font-mono text-foreground">{day.leg.duration}</span></span>}
            {day.leg.knots && <span><span className="font-mono text-foreground">{day.leg.knots}</span> kn</span>}
          </div>
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// EDIT MODE
// ---------------------------------------------------------------------------

function EditableDayCard({
  day,
  index,
  onChange,
}: {
  day: TripDay
  index: number
  onChange: (next: TripDay) => void
}) {
  function patchEvent(i: number, patch: Partial<TripEvent>) {
    const events = day.events.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    onChange({ ...day, events })
  }

  function removeEvent(i: number) {
    onChange({ ...day, events: day.events.filter((_, idx) => idx !== i) })
  }

  function addEvent() {
    onChange({
      ...day,
      events: [...day.events, { title: 'New event', link: '' }],
    })
  }

  function autoLink(i: number, title: string) {
    patchEvent(i, { link: mapsLink(title) })
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-secondary to-card border-b border-border space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono text-primary">Day {index + 1}</span>
          <input
            value={day.date}
            onChange={e => onChange({ ...day, date: e.target.value })}
            className="flex-1 bg-secondary/40 border border-border rounded px-2 py-0.5 text-xs"
          />
        </div>
        <input
          value={day.title}
          onChange={e => onChange({ ...day, title: e.target.value })}
          className="w-full bg-secondary/40 border border-border rounded px-2 py-1 text-base font-bold"
          placeholder="Day title"
        />
        <input
          value={day.subtitle || ''}
          onChange={e => onChange({ ...day, subtitle: e.target.value })}
          className="w-full bg-secondary/40 border border-border rounded px-2 py-1 text-xs"
          placeholder="Day subtitle (optional)"
        />
      </div>

      <div className="px-3 py-3 space-y-3">
        {day.events.map((ev, i) => (
          <div key={i} className="rounded-lg border border-border bg-secondary/30 p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                value={ev.time || ''}
                onChange={e => patchEvent(i, { time: e.target.value })}
                placeholder="Time"
                className="w-20 bg-card border border-border rounded px-2 py-1 text-xs font-mono"
              />
              <input
                value={ev.title}
                onChange={e => patchEvent(i, { title: e.target.value })}
                placeholder="Event title"
                className="flex-1 bg-card border border-border rounded px-2 py-1 text-sm"
              />
              <button
                onClick={() => removeEvent(i)}
                className="text-xs text-destructive px-2 py-1 rounded hover:bg-destructive/10"
                aria-label="Remove event"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input
                value={ev.link || ''}
                onChange={e => patchEvent(i, { link: e.target.value })}
                placeholder="Link URL (https://… or Google Maps)"
                className="flex-1 bg-card border border-border rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => autoLink(i, ev.title)}
                className="text-[10px] uppercase tracking-wide text-primary px-2 py-1 rounded border border-primary/40"
                title="Auto-fill with Google Maps search of the title"
              >
                Maps
              </button>
            </div>
            <textarea
              value={(ev.details || []).join('\n')}
              onChange={e => patchEvent(i, { details: e.target.value.split('\n').filter(Boolean) })}
              placeholder="Details (one per line, optional)"
              rows={2}
              className="w-full bg-card border border-border rounded px-2 py-1 text-xs"
            />
            <input
              value={ev.locationImage || ''}
              onChange={e => patchEvent(i, { locationImage: e.target.value })}
              placeholder="Location image URL (optional)"
              className="w-full bg-card border border-border rounded px-2 py-1 text-xs"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={!!ev.highlight}
                onChange={e => patchEvent(i, { highlight: e.target.checked })}
              />
              Highlight (red dot)
            </label>
          </div>
        ))}
        <button
          onClick={addEvent}
          className="w-full h-9 rounded-lg border border-dashed border-border text-xs text-muted-foreground"
        >
          + Add event
        </button>
      </div>

      <div className="px-3 pb-3 space-y-2">
        <input
          value={day.overnight || ''}
          onChange={e => onChange({ ...day, overnight: e.target.value })}
          placeholder="Overnight (optional)"
          className="w-full bg-secondary/40 border border-border rounded px-2 py-1 text-xs"
        />
        <details className="rounded border border-border bg-secondary/20 px-2">
          <summary className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer py-1.5">Dock / Marina</summary>
          <div className="py-2 space-y-1.5">
            <input
              value={day.dock?.marina || ''}
              onChange={e => onChange({ ...day, dock: { ...(day.dock || {}), marina: e.target.value } })}
              placeholder="Marina name"
              className="w-full bg-card border border-border rounded px-2 py-1 text-xs"
            />
            <div className="flex items-center gap-1">
              <input
                value={day.dock?.marinaLink || ''}
                onChange={e => onChange({ ...day, dock: { ...(day.dock || {}), marinaLink: e.target.value } })}
                placeholder="Marina link (Google Maps URL)"
                className="flex-1 bg-card border border-border rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => onChange({ ...day, dock: { ...(day.dock || {}), marinaLink: mapsLink(day.dock?.marina || '') } })}
                className="text-[10px] uppercase tracking-wide text-primary px-2 py-1 rounded border border-primary/40"
              >
                Maps
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                value={day.dock?.radioChannel || ''}
                onChange={e => onChange({ ...day, dock: { ...(day.dock || {}), radioChannel: e.target.value } })}
                placeholder="VHF Ch"
                className="bg-card border border-border rounded px-2 py-1 text-xs font-mono"
              />
              <input
                value={day.dock?.eta || ''}
                onChange={e => onChange({ ...day, dock: { ...(day.dock || {}), eta: e.target.value } })}
                placeholder="ETA"
                className="bg-card border border-border rounded px-2 py-1 text-xs font-mono"
              />
              <input
                value={day.dock?.etd || ''}
                onChange={e => onChange({ ...day, dock: { ...(day.dock || {}), etd: e.target.value } })}
                placeholder="ETD"
                className="bg-card border border-border rounded px-2 py-1 text-xs font-mono"
              />
            </div>
            <textarea
              value={day.dock?.notes || ''}
              onChange={e => onChange({ ...day, dock: { ...(day.dock || {}), notes: e.target.value } })}
              placeholder="Dock notes (optional)"
              rows={2}
              className="w-full bg-card border border-border rounded px-2 py-1 text-xs"
            />
          </div>
        </details>
        <details className="rounded border border-border bg-secondary/20 px-2">
          <summary className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer py-1.5">Day image</summary>
          <div className="py-2 space-y-1.5">
            <input
              value={day.imageUrl || ''}
              onChange={e => onChange({ ...day, imageUrl: e.target.value })}
              placeholder="Image URL"
              className="w-full bg-card border border-border rounded px-2 py-1 text-xs"
            />
            <input
              value={day.imageCaption || ''}
              onChange={e => onChange({ ...day, imageCaption: e.target.value })}
              placeholder="Caption (optional)"
              className="w-full bg-card border border-border rounded px-2 py-1 text-xs"
            />
          </div>
        </details>
        <details className="rounded border border-border bg-secondary/20 px-2">
          <summary className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer py-1.5">Passage leg</summary>
          <div className="py-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={day.leg?.label || ''}
                onChange={e => onChange({ ...day, leg: { ...(day.leg || {}), label: e.target.value } })}
                placeholder="Label (LEG 11)"
                className="bg-card border border-border rounded px-2 py-1 text-xs"
              />
              <input
                value={day.leg?.route || ''}
                onChange={e => onChange({ ...day, leg: { ...(day.leg || {}), route: e.target.value } })}
                placeholder="Route"
                className="bg-card border border-border rounded px-2 py-1 text-xs"
              />
            </div>
            <input
              value={day.leg?.sub || ''}
              onChange={e => onChange({ ...day, leg: { ...(day.leg || {}), sub: e.target.value } })}
              placeholder="Subtitle (NIGHT PASSAGE)"
              className="w-full bg-card border border-border rounded px-2 py-1 text-xs"
            />
            <div className="grid grid-cols-3 gap-1.5">
              <input
                value={day.leg?.miles || ''}
                onChange={e => onChange({ ...day, leg: { ...(day.leg || {}), miles: e.target.value } })}
                placeholder="Miles"
                className="bg-card border border-border rounded px-2 py-1 text-xs font-mono"
              />
              <input
                value={day.leg?.duration || ''}
                onChange={e => onChange({ ...day, leg: { ...(day.leg || {}), duration: e.target.value } })}
                placeholder="Duration"
                className="bg-card border border-border rounded px-2 py-1 text-xs font-mono"
              />
              <input
                value={day.leg?.knots || ''}
                onChange={e => onChange({ ...day, leg: { ...(day.leg || {}), knots: e.target.value } })}
                placeholder="Knots"
                className="bg-card border border-border rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function TripDetailPage() {
  const [, params] = useRoute('/schedule/:id')
  const id = params?.id || ''
  const [trip, setTrip] = useState<Trip | undefined>(() => (id ? findTripById(id) : undefined))
  const [loading, setLoading] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<Trip | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const todayRef = useRef<HTMLDivElement | null>(null)
  const didScrollToToday = useRef(false)
  const canEdit = isAdmin()
  // Public guests (unauthenticated) reach this page only via a shared link.
  // They must not be able to back-navigate to the schedule list and browse other trips.
  const isGuest = !isLoggedIn()

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!id) {
        setLoading(false)
        return
      }
      const t = await loadTrip(id)
      if (!cancelled) {
        setTrip(t)
        setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id])

  // Auto-scroll today's day card to the top of the viewport once the trip
  // loads (only when viewing, not editing, and only on first show).
  useEffect(() => {
    if (editMode) return
    if (didScrollToToday.current) return
    if (!trip) return
    const node = todayRef.current
    if (!node) return
    // Defer to next frame so layout has settled.
    const handle = requestAnimationFrame(() => {
      // Account for the sticky page header so the card title stays visible
      // below it (rather than scrolled behind it).
      const header = document.querySelector('header.sticky') as HTMLElement | null
      const headerH = header ? header.getBoundingClientRect().height : 0
      const rect = node.getBoundingClientRect()
      const top = window.scrollY + rect.top - headerH - 12 // gap below header
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      didScrollToToday.current = true
    })
    return () => cancelAnimationFrame(handle)
  }, [trip, editMode])

  if (!trip && !loading) {
    return (
      <MenuLayout title="Trip" showBack={!isGuest} backHref={isGuest ? undefined : '/schedule'}>
        <div className="text-sm text-muted-foreground text-center py-8">Trip not found.</div>
      </MenuLayout>
    )
  }
  if (!trip) {
    return (
      <MenuLayout title="Trip" showBack={!isGuest} backHref={isGuest ? undefined : '/schedule'}>
        <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
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

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(trip)))
    setEditMode(true)
  }

  function cancelEdit() {
    setDraft(undefined)
    setEditMode(false)
  }

  async function commitEdit() {
    if (!draft) return
    setSaving(true)
    const result = await saveTrip(draft, getCrewName() || 'crew')
    setSaving(false)
    if (result.ok) {
      setTrip(draft)
      setDraft(undefined)
      setEditMode(false)
      setShareMsg('Saved')
      setTimeout(() => setShareMsg(null), 2000)
    } else {
      setShareMsg(`Save failed: ${result.detail || 'unknown'}`)
      setTimeout(() => setShareMsg(null), 4000)
    }
  }

  function updateDay(idx: number, next: TripDay) {
    if (!draft) return
    const days = draft.days.map((d, i) => (i === idx ? next : d))
    setDraft({ ...draft, days })
  }

  function updateTripMeta(patch: Partial<Trip>) {
    if (!draft) return
    setDraft({ ...draft, ...patch })
  }

  const showing = editMode && draft ? draft : trip

  return (
    <MenuLayout
      title={showing.name}
      showBack={!isGuest}
      backHref={isGuest ? undefined : '/schedule'}
      rightAction={
        editMode
          ? undefined
          : canEdit
            ? {
                icon: <PencilIcon />,
                ariaLabel: 'Edit itinerary',
                onClick: startEdit,
              }
            : {
                icon: <ShareIcon />,
                ariaLabel: 'Share trip',
                onClick: () => setShareOpen(true),
              }
      }
    >
      <div className="space-y-4">
        <div className={`relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br ${showing.hero.gradient}`}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative p-5">
            <div className="text-4xl">{showing.hero.icon}</div>
            {editMode && draft ? (
              <>
                <input
                  value={draft.name}
                  onChange={e => updateTripMeta({ name: e.target.value })}
                  className="mt-3 w-full bg-black/30 border border-white/30 rounded px-2 py-1 text-2xl font-bold text-white"
                />
                <input
                  value={draft.subtitle}
                  onChange={e => updateTripMeta({ subtitle: e.target.value })}
                  className="mt-1 w-full bg-black/30 border border-white/30 rounded px-2 py-1 text-sm text-white"
                />
                <input
                  value={draft.guests || ''}
                  onChange={e => updateTripMeta({ guests: e.target.value })}
                  placeholder="Guests (optional)"
                  className="mt-1 w-full bg-black/30 border border-white/30 rounded px-2 py-1 text-xs text-white placeholder:text-white/50"
                />
              </>
            ) : (
              <>
                <div className="mt-3 text-2xl font-bold text-white">{showing.name}</div>
                <div className="text-sm text-white/85">{showing.subtitle}</div>
                {showing.guests && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-white/90">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    <span><span className="font-semibold text-white">Guests:</span> {showing.guests}</span>
                  </div>
                )}
              </>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span>{formatRange(showing.startDate, showing.endDate)}</span>
              <span className="text-white/50">·</span>
              <span>{showing.days.length} days</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {editMode && draft
            ? draft.days.map((day, i) => (
                <EditableDayCard key={day.isoDate + i} day={day} index={i} onChange={next => updateDay(i, next)} />
              ))
            : (() => {
                const todayIso = todayIsoLocal()
                return showing.days.map((day, i) => {
                  const isToday = day.isoDate === todayIso
                  return (
                    <DayCard
                      key={day.isoDate + i}
                      day={day}
                      index={i}
                      isToday={isToday}
                      ref={isToday ? todayRef : undefined}
                    />
                  )
                })
              })()}
        </div>

        {editMode ? (
          <div className="sticky bottom-2 grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="h-11 rounded-lg border border-border bg-card text-foreground font-medium"
            >
              Cancel
            </button>
            <button
              onClick={commitEdit}
              disabled={saving}
              className="h-11 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : (
          <div className="pt-2 space-y-2">
            {canEdit && (
              <button
                onClick={startEdit}
                className="w-full h-11 rounded-lg border border-primary/40 bg-primary/10 text-primary font-medium flex items-center justify-center gap-2"
              >
                <PencilIcon />
                Edit itinerary
              </button>
            )}
            <button
              onClick={() => setShareOpen(true)}
              className="w-full h-11 rounded-lg border border-border bg-card text-foreground font-medium flex items-center justify-center gap-2"
            >
              <ShareIcon />
              Share trip
            </button>
          </div>
        )}

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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
