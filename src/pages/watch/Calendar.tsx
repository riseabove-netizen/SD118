import React, { useEffect, useMemo, useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'

type WatchEvent = {
  id: string
  summary: string
  description: string
  location: string
  start: string
  end: string
  allDay: boolean
  htmlLink: string
  attendees: { email: string; displayName: string; responseStatus: string }[]
}

type CalendarResponse =
  | { ok: true; events: WatchEvent[]; timeZone: string; calendarId: string }
  | { ok: false; needsAccess?: true; detail?: string; calendarId?: string; error?: string }

const SERVICE_ACCOUNT_EMAIL = 'sd118-log@charged-curve-498217-c1.iam.gserviceaccount.com'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_EVENTS_PER_DAY = 2

function parseLocal(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(iso)
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// All days an event covers (handles multi-day events). For all-day events, the
// Google API end date is exclusive, so we subtract 1 day from the end.
function expandEventDays(ev: WatchEvent): string[] {
  const start = parseLocal(ev.start)
  const end = parseLocal(ev.end)
  const last = new Date(end)
  if (ev.allDay) last.setDate(last.getDate() - 1)
  const days: string[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const stop = new Date(last.getFullYear(), last.getMonth(), last.getDate())
  while (cur <= stop) {
    days.push(dayKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days.length ? days : [dayKey(start)]
}

function startOfMonthGrid(year: number, month: number): Date {
  // Grid starts on Monday before (or equal to) the 1st.
  const first = new Date(year, month, 1)
  const dow = (first.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(first)
  start.setDate(first.getDate() - dow)
  return start
}

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return ''
  return parseLocal(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function copyText(text: string): Promise<boolean> {
  return navigator.clipboard
    ? navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    : Promise.resolve(false)
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
  .print-area .event-chip.event-color-0 { border-left: 4px solid #000 !important; }
  .print-area .event-chip.event-color-1 { border-left: 4px solid #555 !important; }
}
.print-only { display: none; }
`

const EVENT_TONES = [
  'border-l-2 border-l-primary bg-primary/15 text-foreground',
  'border-l-2 border-l-amber-500 bg-amber-500/15 text-foreground',
]

export function WatchCalendarPage() {
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [cursor, setCursor] = useState<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/trips?action=watch-calendar', { cache: 'no-store' })
      .then(r => r.json())
      .then((json: CalendarResponse) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setData({ ok: false, error: 'Network error' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Build map: dayKey -> events on that day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, WatchEvent[]>()
    if (!data?.ok) return map
    for (const ev of data.events) {
      const days = expandEventDays(ev)
      for (const k of days) {
        const arr = map.get(k) || []
        arr.push(ev)
        map.set(k, arr)
      }
    }
    return map
  }, [data])

  // 6-week grid for current cursor month
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

  async function handleCopyEmail() {
    const ok = await copyText(SERVICE_ACCOUNT_EMAIL)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const printedOn = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) || [] : []

  return (
    <MenuLayout title="Watch Calendar" showBack backHref="/watch">
      <style>{PRINT_CSS}</style>
      <div className="space-y-3 print-area">
        {/* Print-only header */}
        <div className="print-only" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>M/Y Rise Above — Watch Calendar</div>
          <div style={{ fontSize: 11 }}>{monthLabel} · Europe/Madrid · Printed {printedOn}</div>
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
                <div className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">M/Y Rise Above · Watch</div>
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
              {data?.ok && (
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
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground text-center py-8 no-print">Loading calendar…</div>
        )}

        {!loading && data && !data.ok && data.needsAccess && (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3 no-print">
            <div className="text-sm font-semibold text-primary">One-time setup required</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Share the watch calendar with this service account email (view-only), then refresh:
            </p>
            <div className="rounded-lg bg-card border border-border p-3 font-mono text-[11px] break-all">
              {SERVICE_ACCOUNT_EMAIL}
            </div>
            <button
              onClick={handleCopyEmail}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
            >
              {copied ? 'Copied' : 'Copy email'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-10 rounded-lg border border-border bg-card text-foreground font-medium text-sm"
            >
              Refresh
            </button>
          </div>
        )}

        {!loading && data && !data.ok && !data.needsAccess && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2 no-print">
            <div className="font-semibold text-destructive">Could not load calendar</div>
            {data.detail && <div className="text-xs text-muted-foreground break-all">{data.detail}</div>}
            <button
              onClick={() => window.location.reload()}
              className="mt-2 h-9 px-3 rounded-lg border border-border bg-card text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Month grid */}
        {(!loading && (!data || data.ok)) && (
          <>
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
                      {visible.map((ev, i) => {
                        const time = formatTime(ev.start, ev.allDay)
                        return (
                          <div
                            key={ev.id}
                            className={`event-chip event-color-${i} rounded px-1 py-0.5 text-[10px] leading-tight truncate ${EVENT_TONES[i] || EVENT_TONES[0]}`}
                            title={`${time ? time + ' · ' : ''}${ev.summary}${ev.location ? ' · ' + ev.location : ''}`}
                          >
                            {time && <span className="font-mono mr-1 opacity-80">{time}</span>}
                            <span className="font-medium">{ev.summary || '(no title)'}</span>
                          </div>
                        )
                      })}
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
                    {parseLocal(selectedKey).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
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
                  <div className="text-xs text-muted-foreground py-3 text-center">No watch entries.</div>
                ) : (
                  <ul className="space-y-2">
                    {selectedEvents.map((ev, i) => (
                      <li
                        key={ev.id}
                        className={`rounded-lg p-2 ${EVENT_TONES[i % EVENT_TONES.length]}`}
                      >
                        <div className="flex items-baseline gap-2">
                          {!ev.allDay && (
                            <span className="text-[10px] font-mono text-primary font-semibold">
                              {formatTime(ev.start, false)}
                            </span>
                          )}
                          {ev.allDay && (
                            <span className="text-[9px] uppercase tracking-wide text-primary font-semibold">All day</span>
                          )}
                          <span className="text-sm font-semibold flex-1">{ev.summary || '(no title)'}</span>
                        </div>
                        {ev.location && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">{ev.location}</div>
                        )}
                        {ev.description && (
                          <div className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                            {ev.description}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        <div className="text-[10px] text-muted-foreground text-center pt-2 pb-1 no-print">
          M/Y Rise Above · Tap a day for details · Up to {MAX_EVENTS_PER_DAY} events shown per cell
        </div>
      </div>
    </MenuLayout>
  )
}
