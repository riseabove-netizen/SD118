// Schedule calendar — mirrors the Watch Calendar look & feel but is driven
// entirely by the local TRIPS data plus a handful of hard-coded planning
// windows (yard period, DYT load, Florida offload, home time).
//
// Each day of every trip becomes one event with a link back to the parent
// trip's detail page, so the crew can tap through to the full itinerary.
import React, { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { TRIPS, type Trip, type TripDay } from '@/data/trips'

// ---------------- Event shape ----------------

type ScheduleEvent = {
  id: string
  summary: string
  location: string
  description: string
  startIso: string      // YYYY-MM-DD inclusive
  endIso: string        // YYYY-MM-DD inclusive
  /** "anchor" | "dock" | "planning" — drives chip colour. */
  kind: 'anchor' | 'dock' | 'planning'
  /** In-app link the detail card exposes as "Open itinerary". */
  itineraryHref?: string
  itineraryLabel?: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_EVENTS_PER_DAY = 2

// ---------------- Trip-day → event conversion ----------------

// Detect if the crew is at a dock/marina for the day. Falls back to the
// overnight text when the day card doesn't carry a dock block.
function classifyDay(day: TripDay): { kind: 'anchor' | 'dock'; label: string; location: string } {
  if (day.dock?.marina) {
    return { kind: 'dock', label: `⚓ Dock · ${day.dock.marina}`, location: day.dock.marina }
  }
  const overnight = (day.overnight || '').trim()
  if (overnight) {
    // "At anchor · Ses Illetes" / "Ventotene (evening arrival)…"
    const isDock = /(marina|port|pier|dock|berth|molo|quay)/i.test(overnight)
    const kind: 'anchor' | 'dock' = isDock ? 'dock' : 'anchor'
    const icon = kind === 'dock' ? '⚓ Dock' : '⚓ Anchor'
    // Trim the "At anchor · " / "At anchor - " prefix for cleaner display.
    const cleaned = overnight.replace(/^(at\s+)?anchor\s*[·\-–]\s*/i, '').replace(/^at\s+/i, '')
    return { kind, label: `${icon} · ${cleaned}`, location: cleaned }
  }
  return { kind: 'anchor', label: `⚓ Anchor · ${day.title}`, location: day.title }
}

function tripDayToEvent(trip: Trip, day: TripDay): ScheduleEvent {
  const c = classifyDay(day)
  const descriptionLines = [
    day.title,
    day.subtitle,
    day.dock?.notes,
    day.overnight ? `Overnight: ${day.overnight}` : '',
  ].filter(Boolean) as string[]
  return {
    id: `${trip.id}::${day.isoDate}`,
    summary: c.label,
    location: c.location,
    description: descriptionLines.join(' · '),
    startIso: day.isoDate,
    endIso: day.isoDate,
    kind: c.kind,
    itineraryHref: `/schedule/${trip.id}`,
    itineraryLabel: trip.name,
  }
}

// Hard-coded planning windows requested for post-summer 2026 operations.
const PLANNING_EVENTS: ScheduleEvent[] = [
  {
    id: 'plan-capax-2026',
    summary: '🛠️ Capax Croatia · Šibenik',
    location: 'Capax Croatia, Šibenik',
    description:
      'Mini yard period. Power converter install. Prep for trans-Atlantic.',
    startIso: '2026-09-25',
    endIso: '2026-10-05',
    kind: 'planning',
  },
  {
    id: 'plan-dyt-2026',
    summary: '🚢 DYT ship loading',
    location: 'DYT load port',
    description: 'DYT ship loading schedule.',
    startIso: '2026-10-06',
    endIso: '2026-10-13',
    kind: 'planning',
  },
  {
    id: 'plan-florida-offload-2026',
    summary: '🚢 Florida boat offload window',
    location: 'Fort Lauderdale, FL',
    description: 'Florida boat offload window.',
    startIso: '2026-10-20',
    endIso: '2026-10-30',
    kind: 'planning',
  },
  {
    id: 'plan-home-2026',
    summary: '🏠 Home in Fort Lauderdale',
    location: 'Fort Lauderdale, FL',
    description: 'Boat at home in Fort Lauderdale. AC install. Projects time.',
    startIso: '2026-11-01',
    endIso: '2026-11-30',
    kind: 'planning',
  },
]

// ---------------- Date helpers ----------------

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1)
  const dow = (first.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(first)
  start.setDate(first.getDate() - dow)
  return start
}
function expandEventDays(ev: ScheduleEvent): string[] {
  const start = parseIso(ev.startIso)
  const end = parseIso(ev.endIso)
  const days: string[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= stop) {
    days.push(dayKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days.length ? days : [dayKey(start)]
}

// ---------------- Chip / detail styles ----------------

const KIND_STYLES: Record<ScheduleEvent['kind'], { chip: string; card: string; badge: string }> = {
  dock: {
    chip: 'border-l-2 border-l-primary bg-primary/15 text-foreground',
    card: 'border-l-4 border-l-primary bg-primary/10',
    badge: 'bg-primary/25 text-primary',
  },
  anchor: {
    chip: 'border-l-2 border-l-sky-500 bg-sky-500/15 text-foreground',
    card: 'border-l-4 border-l-sky-500 bg-sky-500/10',
    badge: 'bg-sky-500/25 text-sky-100',
  },
  planning: {
    chip: 'border-l-2 border-l-amber-500 bg-amber-500/15 text-foreground',
    card: 'border-l-4 border-l-amber-500 bg-amber-500/10',
    badge: 'bg-amber-500/25 text-amber-100',
  },
}

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: #ffffff !important; color: #000000 !important; }
  body * { visibility: hidden !important; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .print-area .cal-grid { gap: 1px !important; background: #000 !important; border: 1px solid #000 !important; }
  .print-area .cal-cell { background: #ffffff !important; color: #000 !important; min-height: 90px !important; }
  .print-area .cal-cell * { color: #000 !important; }
  .print-area .cal-cell.out-of-month { background: #f5f5f5 !important; }
  .print-area .cal-weekday { background: #e5e5e5 !important; color: #000 !important; border: 1px solid #000 !important; }
  .print-area .event-chip { background: #ffffff !important; border: 1px solid #000 !important; color: #000 !important; }
}
.print-only { display: none; }
`

// ---------------- Page ----------------

export function ScheduleCalendarPage() {
  const [, setLocation] = useLocation()
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  // Aggregate all trip days + planning events into one flat list.
  const events = useMemo<ScheduleEvent[]>(() => {
    const out: ScheduleEvent[] = []
    // Dedupe by isoDate: some chapters overlap on transition days. Prefer
    // the dock version (more informative), otherwise first-seen wins.
    const byDay = new Map<string, ScheduleEvent>()
    for (const trip of TRIPS) {
      for (const day of trip.days) {
        if (!day.isoDate) continue
        const ev = tripDayToEvent(trip, day)
        const existing = byDay.get(day.isoDate)
        if (!existing) {
          byDay.set(day.isoDate, ev)
        } else if (existing.kind === 'anchor' && ev.kind === 'dock') {
          byDay.set(day.isoDate, ev)
        }
      }
    }
    out.push(...byDay.values())
    out.push(...PLANNING_EVENTS)
    return out
  }, [])

  const [cursor, setCursor] = useState<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>()
    for (const ev of events) {
      for (const k of expandEventDays(ev)) {
        const arr = map.get(k) || []
        arr.push(ev)
        map.set(k, arr)
      }
    }
    // Sort each day: planning last (they're windows, not the primary story).
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const order = (e: ScheduleEvent) => (e.kind === 'planning' ? 1 : 0)
        return order(a) - order(b)
      })
      map.set(k, arr)
    }
    return map
  }, [events])

  const grid = useMemo(() => {
    const start = startOfMonthGrid(cursor.y, cursor.m)
    const cells: { date: Date; inMonth: boolean; key: string }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push({ date: d, inMonth: d.getMonth() === cursor.m, key: dayKey(d) })
    }
    return cells
  }, [cursor])

  function gotoPrev() {
    setCursor(c => {
      const d = new Date(c.y, c.m - 1, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
    setSelectedKey(null)
  }
  function gotoNext() {
    setCursor(c => {
      const d = new Date(c.y, c.m + 1, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
    setSelectedKey(null)
  }
  function gotoToday() {
    setCursor({ y: today.getFullYear(), m: today.getMonth() })
    setSelectedKey(dayKey(today))
  }

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const printedOn = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) || [] : []

  return (
    <MenuLayout title="Schedule Calendar" showBack backHref="/schedule">
      <style>{PRINT_CSS}</style>
      <div className="space-y-3 print-area">
        <div className="print-only" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>M/Y Rise Above — Schedule</div>
          <div style={{ fontSize: 11 }}>{monthLabel} · Printed {printedOn}</div>
        </div>

        {/* Hero / nav */}
        <div className="rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-red-900 via-red-800 to-amber-700 relative no-print">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={gotoPrev}
                className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 text-white flex items-center justify-center"
                aria-label="Previous month"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="text-center flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">M/Y Rise Above · Schedule</div>
                <div className="text-lg font-bold text-white truncate">{monthLabel}</div>
              </div>
              <button
                onClick={gotoNext}
                className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 text-white flex items-center justify-center"
                aria-label="Next month"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={gotoToday}
                className="h-7 px-3 rounded-md bg-white/15 hover:bg-white/25 border border-white/30 text-white text-[11px] font-semibold"
              >
                Today
              </button>
              <button
                onClick={() => window.print()}
                className="h-7 px-3 rounded-md bg-white/15 hover:bg-white/25 border border-white/30 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                aria-label="Print calendar"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] no-print">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm border-l-2 border-l-primary bg-primary/20" />Dock / marina</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm border-l-2 border-l-sky-500 bg-sky-500/20" />At anchor</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm border-l-2 border-l-amber-500 bg-amber-500/20" />Planning window</span>
        </div>

        {/* Weekday header */}
        <div className="cal-grid grid grid-cols-7 gap-px bg-border rounded-t-xl overflow-hidden border border-border border-b-0">
          {WEEKDAYS.map(w => (
            <div
              key={w}
              className="cal-weekday bg-secondary text-muted-foreground text-[10px] uppercase tracking-wider font-semibold text-center py-1.5"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="cal-grid grid grid-cols-7 gap-px bg-border rounded-b-xl overflow-hidden border border-border -mt-3 pt-3 [&]:mt-0">
          {grid.map(cell => {
            const evs = eventsByDay.get(cell.key) || []
            const visible = evs.slice(0, MAX_EVENTS_PER_DAY)
            const overflow = evs.length - visible.length
            const isToday = sameDay(cell.date, today)
            const isSelected = selectedKey === cell.key
            return (
              <button
                key={cell.key}
                onClick={() => setSelectedKey(cell.key)}
                className={`cal-cell text-left p-1 min-h-[78px] flex flex-col gap-1 transition-colors ${
                  cell.inMonth ? 'bg-card' : 'out-of-month bg-secondary/30'
                } ${isSelected ? 'ring-2 ring-primary ring-inset' : ''} hover:bg-secondary/50`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold leading-none ${
                      isToday
                        ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center'
                        : cell.inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/60'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                  {visible.map(ev => (
                    <div
                      key={ev.id}
                      className={`event-chip rounded px-1 py-0.5 text-[10px] leading-tight truncate ${KIND_STYLES[ev.kind].chip}`}
                      title={`${ev.summary}${ev.location ? ' · ' + ev.location : ''}`}
                    >
                      <span className="font-medium">{ev.summary}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[9px] text-muted-foreground font-medium">+{overflow} more</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected day detail */}
        {selectedKey && (
          <div className="rounded-2xl border border-border bg-card p-3 no-print">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm font-bold text-foreground">
                {parseIso(selectedKey).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <button
                onClick={() => setSelectedKey(null)}
                className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground py-3 text-center">Nothing scheduled.</div>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map(ev => (
                  <li
                    key={ev.id}
                    className={`rounded-lg p-3 ${KIND_STYLES[ev.kind].card}`}
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-[9px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 ${KIND_STYLES[ev.kind].badge}`}>
                        {ev.kind === 'planning' ? 'Planning' : ev.kind === 'dock' ? 'Dock' : 'Anchor'}
                      </span>
                      <span className="text-sm font-semibold flex-1 min-w-0 break-words">{ev.summary}</span>
                    </div>
                    {ev.location && ev.location !== ev.summary && (
                      <div className="text-[11px] text-muted-foreground mt-1">📍 {ev.location}</div>
                    )}
                    {ev.description && (
                      <div className="text-[12px] text-foreground/90 mt-2 whitespace-pre-wrap leading-relaxed">
                        {ev.description}
                      </div>
                    )}
                    {ev.itineraryHref && (
                      <button
                        onClick={() => setLocation(ev.itineraryHref!)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-red-400 hover:underline font-medium"
                      >
                        📖 Open itinerary
                        {ev.itineraryLabel && (
                          <span className="text-muted-foreground"> — {ev.itineraryLabel}</span>
                        )}
                        <span aria-hidden>→</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground text-center pt-2 pb-1 no-print">
          Tap a day for details · Up to {MAX_EVENTS_PER_DAY} events shown per cell
        </div>
      </div>
    </MenuLayout>
  )
}
