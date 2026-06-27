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

function parseLocal(iso: string): Date {
  // 'YYYY-MM-DD' (all-day) needs to be parsed as local midnight, not UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(iso)
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDayHeader(d: Date): { weekday: string; date: string; relative: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  let relative = ''
  if (diff === 0) relative = 'Today'
  else if (diff === 1) relative = 'Tomorrow'
  else if (diff === -1) relative = 'Yesterday'
  else if (diff > 1 && diff <= 7) relative = `in ${diff} days`
  else if (diff < -1 && diff >= -7) relative = `${-diff} days ago`
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    relative,
  }
}

function formatTime(iso: string): string {
  return parseLocal(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function copyText(text: string): Promise<boolean> {
  return navigator.clipboard
    ? navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    : Promise.resolve(false)
}

export function WatchCalendarPage() {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

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

  const grouped = useMemo(() => {
    if (!data?.ok) return [] as { key: string; date: Date; events: WatchEvent[] }[]
    const byDay = new Map<string, { date: Date; events: WatchEvent[] }>()
    for (const ev of data.events) {
      const d = parseLocal(ev.start)
      const k = dayKey(d)
      const bucket = byDay.get(k) || { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), events: [] }
      bucket.events.push(ev)
      byDay.set(k, bucket)
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, v]) => ({ key, ...v }))
  }, [data])

  async function handleCopyEmail() {
    const ok = await copyText(SERVICE_ACCOUNT_EMAIL)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <MenuLayout title="Watch Calendar" showBack backHref="/watch">
      <div className="space-y-3">
        {/* Hero */}
        <div className="rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-red-900 via-red-800 to-amber-700 relative">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">M/Y Rise Above</div>
            <div className="text-xl font-bold text-white">Watch Calendar</div>
            <div className="text-xs text-white/85 mt-0.5">Next 60 days · Europe/Madrid</div>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground text-center py-8">Loading calendar…</div>
        )}

        {!loading && data && !data.ok && data.needsAccess && (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3">
            <div className="text-sm font-semibold text-primary">One-time setup required</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The app reads your calendar through a Google service account. Share the watch
              calendar with this email (any view-only permission is enough), then refresh this
              page:
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
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">How to share</summary>
              <ol className="list-decimal list-inside mt-2 space-y-1 leading-relaxed">
                <li>Open Google Calendar on desktop, signed in to the calendar's owner account.</li>
                <li>Hover the watch calendar in the left sidebar → three-dot menu → Settings and sharing.</li>
                <li>Scroll to "Share with specific people or groups" → Add people and groups.</li>
                <li>Paste the email above. Permission: "See all event details". Send.</li>
                <li>Service accounts auto-accept — refresh this page.</li>
              </ol>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-10 rounded-lg border border-border bg-card text-foreground font-medium text-sm"
            >
              Refresh
            </button>
          </div>
        )}

        {!loading && data && !data.ok && !data.needsAccess && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
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

        {!loading && data?.ok && grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No watches scheduled in the next 60 days.
          </div>
        )}

        {!loading && data?.ok && grouped.length > 0 && (
          <div className="space-y-3">
            {grouped.map(group => {
              const h = formatDayHeader(group.date)
              const isToday = h.relative === 'Today'
              return (
                <div
                  key={group.key}
                  className={`rounded-2xl border bg-card overflow-hidden ${isToday ? 'border-primary/60' : 'border-border'}`}
                >
                  <div className={`px-4 py-2.5 flex items-baseline gap-2 ${isToday ? 'bg-primary/10' : 'bg-gradient-to-r from-secondary to-card'} border-b border-border`}>
                    <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {h.weekday}
                    </span>
                    <span className="text-xs text-muted-foreground">{h.date}</span>
                    {h.relative && (
                      <span className={`ml-auto text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        {h.relative}
                      </span>
                    )}
                  </div>
                  <ul className="divide-y divide-border">
                    {group.events.map(ev => (
                      <li key={ev.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="w-16 flex-shrink-0 text-right">
                            {ev.allDay ? (
                              <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">All day</span>
                            ) : (
                              <div>
                                <div className="text-xs font-mono text-primary font-semibold">{formatTime(ev.start)}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{formatTime(ev.end)}</div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground">{ev.summary || '(no title)'}</div>
                            {ev.location && (
                              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                {ev.location}
                              </div>
                            )}
                            {ev.description && (
                              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                {ev.description}
                              </div>
                            )}
                            {ev.attendees.length > 0 && (
                              <div className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap gap-1">
                                {ev.attendees.map((a, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded bg-secondary/60 border border-border"
                                  >
                                    {a.displayName || a.email}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-2 pb-1">
          M/Y Rise Above · Watch rotation
        </div>
      </div>
    </MenuLayout>
  )
}
