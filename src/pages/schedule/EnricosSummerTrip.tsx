import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { TRIPS, loadTrip, saveTrip, type Trip, type GuestEntry } from '@/data/trips'
import { isLoggedIn, canWrite, getCrewName } from '@/lib/auth'
import { GuestListEditor } from './GuestListEditor'
import { buildLegs } from './enricos-legs'
import { LegCard } from './LegCard'
import { shareLink } from '@/lib/share-link'
import { printConsolidatedTripAsPdf } from '@/lib/enricos-trip-share'

// Trip ids that make up Enrico's Attempt at Retirement (Aug 4 – Sep 30 2026).
// Order matches chronological flow.
// Slug stays /schedule/enricos-summer-trip so existing shared links keep working.
const CHAPTER_IDS = [
  'balearics-2026',
  'menorca-corsica-2026',
  'crew-alghero-2026',
  'sardinia-2026',
  'naples-family-2026',
  'naples-friends-2026',
  'malta-2026',
  'gozo-2026',
  'sicily-aeolians-revisited-2026',
  'crotone-calabria-2026',
  'corfu-2026',
  'albania-2026',
  'montenegro-2026',
  'dubrovnik-2026',
]

function formatRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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

function GuestChips({ list }: { list: GuestEntry[] }) {
  const confirmed = list.filter(g => !g.tentative).length
  const maybe = list.filter(g => g.tentative).length
  return (
    <div className="mt-2 flex items-start gap-1.5 text-xs text-white/90">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      <div className="flex-1">
        <span className="font-semibold text-white">
          Guests · {confirmed}{maybe ? ` (+${maybe} maybe)` : ''}
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {list.map((g, i) => (
            <span
              key={i}
              title={g.note || (g.tentative ? 'tentative' : g.name)}
              className={`px-1.5 py-0.5 rounded-full text-[10px] leading-tight ${g.tentative ? 'border border-dashed border-white/60 text-white/80' : 'bg-white/15 border border-white/25 text-white'}`}
            >
              {g.name}{g.note ? <span className="text-white/60"> · {g.note}</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

type ChapterProps = {
  index: number
  trip: Trip
  onChange: (next: Trip) => void
  canEditInline: boolean
}

function ChapterCard({ index, trip, onChange, canEditInline }: ChapterProps) {
  const [, setLocation] = useLocation()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(trip.name)
  const [draftSubtitle, setDraftSubtitle] = useState(trip.subtitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guest-list inline editing state.
  const [editingGuests, setEditingGuests] = useState(false)
  const [guestSavingStatus, setGuestSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const guestSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local drafts when underlying trip changes from a fresh load.
  useEffect(() => {
    setDraftName(trip.name)
    setDraftSubtitle(trip.subtitle)
  }, [trip.id, trip.name, trip.subtitle])

  const startDays = daysUntil(trip.startDate)
  const endDays = daysUntil(trip.endDate)
  const isPast = endDays < 0
  const isActive = startDays <= 0 && endDays >= 0
  let badge = `In ${startDays} days`
  let badgeClass = 'bg-primary/20 text-primary border border-primary/30'
  if (isActive) { badge = 'In progress'; badgeClass = 'bg-emerald-600 text-white' }
  else if (isPast) { badge = 'Completed'; badgeClass = 'bg-secondary text-muted-foreground' }
  else if (startDays === 0) { badge = 'Starts today'; badgeClass = 'bg-primary text-primary-foreground' }
  else if (startDays === 1) { badge = 'Tomorrow'; badgeClass = 'bg-primary text-primary-foreground' }

  async function commit() {
    const trimmedName = draftName.trim()
    const trimmedSubtitle = draftSubtitle.trim()
    if (!trimmedName) {
      setError('Name cannot be empty.')
      return
    }
    if (trimmedName === trip.name && trimmedSubtitle === trip.subtitle) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next: Trip = { ...trip, name: trimmedName, subtitle: trimmedSubtitle }
      await saveTrip(next, getCrewName() || 'unknown')
      onChange(next)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Update guestList with a short debounce so quick edits batch into one save.
  function handleGuestListChange(nextList: GuestEntry[]) {
    onChange({ ...trip, guestList: nextList })
    setGuestSavingStatus('saving')
    if (guestSaveTimer.current) clearTimeout(guestSaveTimer.current)
    guestSaveTimer.current = setTimeout(async () => {
      try {
        const next: Trip = { ...trip, guestList: nextList }
        await saveTrip(next, getCrewName() || 'unknown')
        setGuestSavingStatus('saved')
        setTimeout(() => setGuestSavingStatus(s => (s === 'saved' ? 'idle' : s)), 1500)
      } catch (e) {
        setGuestSavingStatus('error')
        console.error('Failed to save guest list:', e)
      }
    }, 600)
  }

  useEffect(() => {
    return () => {
      if (guestSaveTimer.current) clearTimeout(guestSaveTimer.current)
    }
  }, [])

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br ${trip.hero.gradient}`}>
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold tracking-widest text-white/70">LEG {String(index + 1).padStart(2, '0')}</div>
            <div className="text-3xl">{trip.hero.icon}</div>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>{badge}</div>
        </div>

        {editing ? (
          <div className="mt-3 space-y-2">
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              className="w-full bg-black/30 border border-white/30 rounded px-2 py-1 text-xl font-bold text-white"
            />
            <input
              value={draftSubtitle}
              onChange={e => setDraftSubtitle(e.target.value)}
              className="w-full bg-black/30 border border-white/30 rounded px-2 py-1 text-sm text-white"
              placeholder="Subtitle"
            />
            {error && <div className="text-xs text-red-200 bg-red-900/40 rounded px-2 py-1">{error}</div>}
            <div className="flex gap-2">
              <button
                onClick={commit}
                disabled={saving}
                className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setError(null)
                  setDraftName(trip.name)
                  setDraftSubtitle(trip.subtitle)
                }}
                disabled={saving}
                className="px-3 py-1 rounded-md bg-white/10 border border-white/20 text-white text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-start gap-2">
              <div className="flex-1">
                <div className="text-xl font-bold text-white">{trip.name}</div>
                <div className="text-sm text-white/85">{trip.subtitle}</div>
              </div>
              {canEditInline && (
                <button
                  onClick={() => setEditing(true)}
                  title="Edit name & subtitle"
                  className="shrink-0 p-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/90"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
              )}
            </div>
            {trip.guestList && trip.guestList.length > 0 ? (
              <GuestChips list={trip.guestList} />
            ) : trip.guests ? (
              <div className="mt-2 text-xs text-white/85">
                <span className="font-semibold text-white">Guests:</span> {trip.guests}
              </div>
            ) : null}

            {canEditInline && (
              <div className="mt-2">
                <button
                  onClick={() => setEditingGuests(v => !v)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-white/90 bg-white/10 border border-white/20 hover:bg-white/20"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  {editingGuests ? 'Hide guest editor' : 'Edit guest list'}
                  {guestSavingStatus === 'saving' && <span className="text-white/60">· saving…</span>}
                  {guestSavingStatus === 'saved' && <span className="text-emerald-300">· saved</span>}
                  {guestSavingStatus === 'error' && <span className="text-red-300">· save failed</span>}
                </button>
                {editingGuests && (
                  <GuestListEditor
                    value={trip.guestList || []}
                    onChange={handleGuestListChange}
                    compact
                  />
                )}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span>{formatRange(trip.startDate, trip.endDate)}</span>
              <span className="text-white/50">·</span>
              <span>{trip.days.length} days</span>
            </div>
            <button
              onClick={() => setLocation(`/schedule/${trip.id}`)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-white/15 border border-white/25 px-3 py-1.5 rounded-md hover:bg-white/25"
            >
              Open full itinerary
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function EnricosSummerTripPage() {
  const [, setLocation] = useLocation()
  void setLocation
  const [chapters, setChapters] = useState<Trip[]>(() =>
    CHAPTER_IDS.map(id => TRIPS.find(t => t.id === id)).filter((t): t is Trip => !!t),
  )

  // Consolidated itinerary is public via shared link. Editing controls stay
  // gated by `canWrite()`; unauthenticated guests get a read-only view.
  const isGuest = !isLoggedIn()

  // Fetch latest persisted overlay for each trip in parallel.
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const fresh = await Promise.all(
        CHAPTER_IDS.map(async id => {
          try {
            return await loadTrip(id)
          } catch {
            return TRIPS.find(t => t.id === id) || null
          }
        }),
      )
      if (cancelled) return
      setChapters(fresh.filter((t): t is Trip => !!t))
    }
    refresh()
    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    if (chapters.length === 0) return null
    const start = chapters[0].startDate
    const end = chapters[chapters.length - 1].endDate
    const totalDays = chapters.reduce((acc, t) => acc + t.days.length, 0)
    // Unique guest names across all chapters (confirmed + maybe).
    const seen = new Set<string>()
    chapters.forEach(t => (t.guestList || []).forEach(g => seen.add(g.name.toLowerCase())))
    // Total passage distance and steaming time across all consecutive legs.
    const legs = buildLegs()
    const totalNm = legs.reduce((acc, l) => acc + l.distanceNm, 0)
    const totalSteamHours = legs.reduce((acc, l) => acc + l.travelHours, 0)
    return {
      start,
      end,
      totalDays,
      uniqueGuests: seen.size,
      chapters: chapters.length,
      totalNm: Math.round(totalNm),
      totalSteamHours,
    }
  }, [chapters])

  const canEditInline = canWrite()
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'shared' | 'copied' | 'failed'>('idle')

  async function handleShare() {
    setShareStatus('sharing')
    try {
      const result = await shareLink({
        title: "Enrico's Attempt at Retirement",
        url: window.location.href,
        text: "M/Y Rise Above · Summer 2026 — Balearics to Croatia, 15 stops, ~1,538 nm of passage.",
      })
      setShareStatus(result === 'shared' ? 'shared' : result === 'copied' ? 'copied' : 'failed')
    } catch {
      setShareStatus('failed')
    }
    setTimeout(() => setShareStatus('idle'), 2200)
  }

  function handlePrintPdf() {
    if (chapters.length === 0) return
    printConsolidatedTripAsPdf(chapters)
  }

  return (
    <MenuLayout
      title="Enrico's Attempt at Retirement"
      showBack={!isGuest}
      backHref={isGuest ? undefined : '/schedule'}
      rightAction={{
        icon: (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        ),
        ariaLabel: 'Share consolidated trip',
        onClick: handleShare,
      }}
    >
      {/* Hero summary */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-indigo-900 via-purple-800 to-rose-700 mb-4">
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative p-5">
          <div className="text-4xl">🛥️</div>
          <div className="mt-2 text-2xl font-bold text-white">Enrico's Attempt at Retirement</div>
          <div className="text-sm text-white/85">
            Mediterranean season aboard M/Y Rise Above — Balearics to Croatia
          </div>
          {summary && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-full bg-white/15 border border-white/20 text-white">{formatRange(summary.start, summary.end)}</span>
              <span className="px-2 py-1 rounded-full bg-white/15 border border-white/20 text-white">{summary.chapters} stops</span>
              <span className="px-2 py-1 rounded-full bg-white/15 border border-white/20 text-white">{summary.totalDays} days at sea / in port</span>
              <span className="px-2 py-1 rounded-full bg-white/15 border border-white/20 text-white">~{summary.totalNm} nm total passage</span>
              <span className="px-2 py-1 rounded-full bg-white/15 border border-white/20 text-white">~{Math.round(summary.totalSteamHours)}h steaming @ 12 kn</span>
              {summary.uniqueGuests > 0 && (
                <span className="px-2 py-1 rounded-full bg-white/15 border border-white/20 text-white">{summary.uniqueGuests} unique guests</span>
              )}
            </div>
          )}
          {canEditInline && (
            <p className="mt-3 text-[11px] text-white/70">
              Tap the pencil on any leg to rename or update its subtitle. Changes sync to the schedule list and the trip's own page.
            </p>
          )}

          {/* Share + PDF actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleShare}
              disabled={shareStatus === 'sharing'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-black text-xs font-semibold hover:bg-white/90 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {shareStatus === 'sharing'
                ? 'Sharing…'
                : shareStatus === 'shared'
                  ? 'Shared'
                  : shareStatus === 'copied'
                    ? 'Link copied'
                    : shareStatus === 'failed'
                      ? 'Share failed'
                      : 'Share link'}
            </button>
            <button
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/15 border border-white/30 text-white text-xs font-semibold hover:bg-white/25"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Save as PDF
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {chapters.map((trip, i) => {
          // Build the leg that connects this chapter to the next (if any).
          const legs = buildLegs()
          const nextLeg = legs.find(l => l.fromId === trip.id)
          const isPast = daysUntil(trip.endDate) < 0
          if (isPast) return null // rendered in the collapsed folder below
          return (
            <React.Fragment key={trip.id}>
              <ChapterCard
                index={i}
                trip={trip}
                canEditInline={canEditInline}
                onChange={next => {
                  setChapters(prev => prev.map(t => (t.id === next.id ? next : t)))
                }}
              />
              {nextLeg && <LegCard leg={nextLeg} />}
            </React.Fragment>
          )
        })}
      </div>

      <PastTripsFolder
        chapters={chapters}
        canEditInline={canEditInline}
        onChange={next =>
          setChapters(prev => prev.map(t => (t.id === next.id ? next : t)))
        }
      />
    </MenuLayout>
  )
}

// Collapsible folder at the bottom of the itinerary listing every past
// chapter so recent history is one tap away without cluttering the top.
function PastTripsFolder({
  chapters,
  canEditInline,
  onChange,
}: {
  chapters: Trip[]
  canEditInline: boolean
  onChange: (next: Trip) => void
}) {
  const [open, setOpen] = useState(false)
  const past = chapters
    .map((t, i) => ({ trip: t, index: i }))
    .filter(({ trip }) => daysUntil(trip.endDate) < 0)
    // Newest completed trip first.
    .sort((a, b) => b.trip.endDate.localeCompare(a.trip.endDate))

  if (past.length === 0) return null

  return (
    <div className="mt-6 rounded-2xl border border-border bg-secondary/20">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="text-xl">🗂️</div>
          <div>
            <div className="text-sm font-semibold">Past trips</div>
            <div className="text-[11px] text-muted-foreground">
              {past.length} completed · tap to {open ? 'hide' : 'expand'}
            </div>
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
          {past.map(({ trip, index }) => (
            <ChapterCard
              key={trip.id}
              index={index}
              trip={trip}
              canEditInline={canEditInline}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
