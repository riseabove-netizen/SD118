// Maintenance Logs — landing page.
//
// Renders a tile grid of every system in MAINTENANCE_SYSTEMS plus every
// calendar-based system. Each tile shows the soonest upcoming service
// with both a "time-to-go" pill and a "next service at" subtext. The
// crew can filter the entire page by urgency: Due now, Due ≤ 1 week,
// Due ≤ 2 weeks. For systems that consolidate multiple units/items
// (Fresh Water System, AC Chillers, air handlers, …), the soonest job
// across every child bubbles up to the tile.

import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import {
  MAINTENANCE_SYSTEMS,
  MaintenanceSystem,
  nextDueMilestone,
  formatHoursUntil,
  dueTier,
} from '@/data/maintenance-systems'
import {
  CALENDAR_SYSTEMS,
  CalendarSystem,
  intervalDays,
  itemAppliesToUnit,
} from '@/data/calendar-systems'
import { AIR_HANDLERS } from '@/data/air-handlers'
import { fetchSystemState } from '@/lib/maintenance-api'
import {
  fetchCalendarServiceEvents,
  buildStatusMap,
  daysSinceIso,
} from '@/lib/calendar-service-api'
import { fetchAirHandlerEvents, lastServiceByUnit, daysSince } from '@/lib/air-handlers-api'

interface SystemState {
  currentHours: number | null
  lastServiceHoursByKit: Record<string, number>
  eventsCount: number
}

// Bucket for the top-of-page urgency filter. `all` shows everything.
type Filter = 'all' | 'now' | 'week' | 'twoWeeks'

// Assume the port/starboard generator is roughly used equally, so we can
// convert "days" and "hours" to a single dimension by expecting the boat
// runs some hours per week when active. This is only used for the pill
// color / filter bucketing, not for the numeric display.
const AVG_HOURS_PER_DAY = 4

export function MaintenanceHubPage() {
  const [, setLocation] = useLocation()
  const [byId, setById] = useState<Record<string, SystemState>>({})
  const [calEvents, setCalEvents] = useState<Record<string, Awaited<ReturnType<typeof fetchCalendarServiceEvents>>>>({})
  const [ahEvents, setAhEvents] = useState<Awaited<ReturnType<typeof fetchAirHandlerEvents>>>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const active = MAINTENANCE_SYSTEMS.filter(s => s.kits.length > 0)
      const hoursResults: Record<string, SystemState> = {}
      const calResults: Record<string, Awaited<ReturnType<typeof fetchCalendarServiceEvents>>> = {}
      let ahResults: Awaited<ReturnType<typeof fetchAirHandlerEvents>> = []

      await Promise.all([
        ...active.map(async s => {
          try {
            const state = await fetchSystemState(s.id)
            hoursResults[s.id] = {
              currentHours: state.currentHours,
              lastServiceHoursByKit: state.lastServiceHoursByKit || {},
              eventsCount: state.events?.length || 0,
            }
          } catch {
            hoursResults[s.id] = { currentHours: null, lastServiceHoursByKit: {}, eventsCount: 0 }
          }
        }),
        ...CALENDAR_SYSTEMS.map(async s => {
          try {
            calResults[s.id] = await fetchCalendarServiceEvents(s.id)
          } catch {
            calResults[s.id] = []
          }
        }),
        (async () => {
          try {
            ahResults = await fetchAirHandlerEvents()
          } catch {
            ahResults = []
          }
        })(),
      ])

      if (cancelled) return
      setById(hoursResults)
      setCalEvents(calResults)
      setAhEvents(ahResults)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Group hours-based systems by parentId for a cleaner visual grouping.
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; systems: MaintenanceSystem[] }>()
    for (const s of MAINTENANCE_SYSTEMS) {
      const key = s.parentId
      if (!map.has(key)) {
        map.set(key, {
          title: prettyGroupTitle(s),
          systems: [],
        })
      }
      map.get(key)!.systems.push(s)
    }
    return [...map.values()]
  }, [])

  // Turn every tile (hours + calendar + air handlers) into a comparable
  // "days-until-due" number so we can apply the filter uniformly.
  function passesFilter(daysUntilDue: number): boolean {
    if (filter === 'all') return true
    if (!Number.isFinite(daysUntilDue)) return false
    if (filter === 'now') return daysUntilDue <= 0
    if (filter === 'week') return daysUntilDue <= 7
    if (filter === 'twoWeeks') return daysUntilDue <= 14
    return true
  }

  // Hours-based tile → soonest kit's hours-until → convert to days.
  function hoursTileDays(s: MaintenanceSystem): number {
    const state = byId[s.id]
    const currentHours = state?.currentHours ?? (s.initialHoursHint ?? null)
    if (!s.kits.length || currentHours == null) return Infinity
    const m = nextDueMilestone(s, currentHours, state?.lastServiceHoursByKit || {})
    if (!m) return Infinity
    return m.hoursUntil / AVG_HOURS_PER_DAY
  }

  // Calendar-tile → soonest cell's daysUntilDue across every (unit×item).
  function calendarTileDays(s: CalendarSystem): number {
    const map = buildStatusMap(s, calEvents[s.id] || [])
    let soonest = Infinity
    for (const u of s.units) {
      for (const it of s.items) {
        if (!itemAppliesToUnit(s, it.id, u.id)) continue
        const st = map[`${u.id}|${it.id}`]
        if (!st) continue
        if (st.state === 'as-needed') continue
        if (st.state === 'never') return -Infinity // treat as immediately due
        if (st.daysUntilDue < soonest) soonest = st.daysUntilDue
      }
    }
    return soonest
  }

  // Air handlers → 30-day interval per unit.
  function airHandlerDays(): number {
    const last = lastServiceByUnit(ahEvents)
    let soonest = Infinity
    for (const u of AIR_HANDLERS) {
      const l = last[u.id]
      if (!l) return -Infinity // never serviced
      const d = daysSince(l.Timestamp)
      const until = 30 - d
      if (until < soonest) soonest = until
    }
    return soonest
  }

  const airHandlerDaysValue = airHandlerDays()

  return (
    <MenuLayout title="Maintenance Logs" showBack backHref="/menu">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Service history and upcoming due dates per system.
          </p>
          <button
            onClick={() => setLocation('/maintenance/perform')}
            className="text-xs px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
          >
            + Perform maintenance
          </button>
        </div>

        {/* Urgency filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip label="All"           active={filter === 'all'}       onClick={() => setFilter('all')} />
          <FilterChip label="Due now"       active={filter === 'now'}       onClick={() => setFilter('now')} />
          <FilterChip label="≤ 1 week"      active={filter === 'week'}      onClick={() => setFilter('week')} />
          <FilterChip label="≤ 2 weeks"     active={filter === 'twoWeeks'}  onClick={() => setFilter('twoWeeks')} />
        </div>

        {loading && (
          <div className="text-xs text-muted-foreground">Loading current hours…</div>
        )}

        {/* Calendar-based systems (not hours-based) */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Calendar-based service
          </div>
          {passesFilter(airHandlerDaysValue) && (
            <CalendarSummaryTile
              icon="❄️"
              title="Air Handlers"
              blurb="Guest & crew AHUs · monthly service checklist"
              daysUntilDue={airHandlerDaysValue}
              onClick={() => setLocation('/maintenance/air-handlers')}
            />
          )}
          {CALENDAR_SYSTEMS.map(s => {
            const daysUntilDue = calendarTileDays(s)
            if (!passesFilter(daysUntilDue)) return null
            const nextDate = soonestDueDate(s, calEvents[s.id] || [])
            return (
              <CalendarSummaryTile
                key={s.id}
                icon={s.tileEmoji}
                title={s.label}
                blurb={s.tileBlurb}
                daysUntilDue={daysUntilDue}
                nextDate={nextDate}
                onClick={() => setLocation(`/maintenance/calendar/${s.id}`)}
              />
            )
          })}
        </div>

        {groups.map(group => {
          const visible = group.systems.filter(s => {
            const days = hoursTileDays(s)
            // Systems with no kits defined never pass a strict filter,
            // but we still want them shown on the default "All" view.
            if (!s.kits.length) return filter === 'all'
            return passesFilter(days)
          })
          if (visible.length === 0) return null
          return (
            <div key={group.title} className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {group.title}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {visible.map(s => (
                  <SystemTile
                    key={s.id}
                    system={s}
                    state={byId[s.id]}
                    onClick={() => {
                      if (s.kind === 'generator') setLocation(`/maintenance/generator/${s.side}`)
                      else setLocation(`/maintenance/system/${s.id}`)
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </MenuLayout>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/70'
      }`}
    >
      {label}
    </button>
  )
}

function prettyGroupTitle(s: MaintenanceSystem): string {
  switch (s.parentId) {
    case 'generator': return 'Generators'
    case 'main-engine': return 'Main engines'
    case 'watermaker': return 'Watermaker'
    case 'hamann': return 'Hamann'
    case 'strainer': return 'Strainer baskets'
    case 'ac': return 'Air conditioning'
    case 'grey-black-pump': return 'Grey / black-water pumps'
    default: return s.parentId
  }
}

interface TileProps {
  system: MaintenanceSystem
  state?: SystemState
  onClick(): void
}

function SystemTile({ system, state, onClick }: TileProps) {
  const currentHours = state?.currentHours ?? (system.initialHoursHint ?? null)
  const hasKits = system.kits.length > 0
  const milestone = hasKits && currentHours != null
    ? nextDueMilestone(system, currentHours, state?.lastServiceHoursByKit || {})
    : null

  const tier = milestone ? dueTier(milestone.hoursUntil) : null
  const badgeClasses = tier === 'red'
    ? 'bg-red-500/20 text-red-300 border-red-500/40'
    : tier === 'amber'
    ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
    : tier === 'green'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    : 'bg-secondary text-muted-foreground border-border'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left min-h-[80px]"
    >
      <span className="text-2xl flex-shrink-0 w-10 text-center">{system.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold">{system.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {currentHours != null ? (
            <span>{currentHours.toFixed(0)} h on meter</span>
          ) : (
            <span className="text-muted-foreground/70">no hours logged</span>
          )}
          {hasKits ? (
            milestone ? (
              <>
                <span>·</span>
                <span>
                  next: {milestone.kits.map(k => k.shortLabel).join(' + ')}
                </span>
              </>
            ) : (
              <>
                <span>·</span>
                <span className="text-muted-foreground/70">no schedule computed</span>
              </>
            )
          ) : (
            <>
              <span>·</span>
              <span className="text-muted-foreground/70">pending setup</span>
            </>
          )}
        </div>
      </div>
      {milestone && (
        <div className="flex flex-col items-end gap-0.5">
          <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded border ${badgeClasses}`}>
            {formatHoursUntil(milestone.hoursUntil)}
          </span>
          <span className="text-[9px] text-muted-foreground">
            due at {milestone.dueAtHours} h
          </span>
        </div>
      )}
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

// ---------- Calendar-tile helpers ----------

// Compute the ISO date on which the earliest (soonest) service becomes
// due for a calendar system, taking each item's own interval + last
// service date into account. Returns null when there is nothing to
// schedule (all items are as-needed with no history).
function soonestDueDate(s: CalendarSystem, events: Awaited<ReturnType<typeof fetchCalendarServiceEvents>>): string | null {
  const map = buildStatusMap(s, events)
  let soonestDays = Infinity
  let soonestDate: string | null = null
  for (const u of s.units) {
    for (const it of s.items) {
      if (!itemAppliesToUnit(s, it.id, u.id)) continue
      if (it.interval.kind === 'as-needed') continue
      const st = map[`${u.id}|${it.id}`]
      if (!st) continue
      // When there's no history at all, we treat it as due today so the
      // filter picks it up; leave the date blank so the tile just says
      // "Never serviced".
      if (st.state === 'never') return null
      if (st.lastDate) {
        const daysUntil = intervalDays(it.interval) - daysSinceIso(st.lastDate)
        if (daysUntil < soonestDays) {
          soonestDays = daysUntil
          const d = new Date(st.lastDate)
          d.setDate(d.getDate() + intervalDays(it.interval))
          soonestDate = d.toISOString().slice(0, 10)
        }
      }
    }
  }
  return soonestDate
}

function formatDaysUntil(days: number): string {
  if (!Number.isFinite(days)) return 'as needed'
  if (days < -365) return 'overdue'
  if (days < 0) return `overdue ${Math.abs(Math.round(days))}d`
  if (days === 0) return 'due today'
  if (days < 14) return `${Math.round(days)}d to go`
  if (days < 60) return `${Math.round(days / 7)}wk to go`
  return `${Math.round(days / 30)}mo to go`
}

function daysTier(days: number): 'green' | 'amber' | 'red' | null {
  if (!Number.isFinite(days)) return null
  if (days <= 0) return 'red'
  if (days <= 7) return 'amber'
  if (days <= 30) return 'green'
  return null
}

function CalendarSummaryTile({
  icon, title, blurb, daysUntilDue, nextDate, onClick,
}: {
  icon: string
  title: string
  blurb: string
  daysUntilDue: number
  nextDate?: string | null
  onClick(): void
}) {
  const tier = daysTier(daysUntilDue)
  const badgeClasses = tier === 'red'
    ? 'bg-red-500/20 text-red-300 border-red-500/40'
    : tier === 'amber'
    ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
    : tier === 'green'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    : 'bg-secondary text-muted-foreground border-border'

  const showBadge = Number.isFinite(daysUntilDue)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left min-h-[72px]"
    >
      <div className="text-2xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{blurb}</div>
      </div>
      {showBadge && (
        <div className="flex flex-col items-end gap-0.5">
          <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded border ${badgeClasses}`}>
            {formatDaysUntil(daysUntilDue)}
          </span>
          {nextDate && (
            <span className="text-[9px] text-muted-foreground">
              due {nextDate}
            </span>
          )}
        </div>
      )}
      <div className="text-xs text-muted-foreground">›</div>
    </button>
  )
}
