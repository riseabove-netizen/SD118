// Maintenance Logs — landing page.
//
// Renders a tile grid of every system in MAINTENANCE_SYSTEMS. Each tile
// shows current hours (if known) and the nearest upcoming milestone in
// the John Deere schedule (250/500/2000h). Systems without any kits
// defined show a muted "pending setup" line instead — they'll come to
// life as we fill in intervals later.

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
import { fetchSystemState } from '@/lib/maintenance-api'

interface SystemState {
  currentHours: number | null
  lastServiceHoursByKit: Record<string, number>
  eventsCount: number
}

export function MaintenanceHubPage() {
  const [, setLocation] = useLocation()
  const [byId, setById] = useState<Record<string, SystemState>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      // Only prefetch systems that actually have kits defined —
      // no point hammering the API for stubs.
      const active = MAINTENANCE_SYSTEMS.filter(s => s.kits.length > 0)
      const results: Record<string, SystemState> = {}
      await Promise.all(active.map(async s => {
        try {
          const state = await fetchSystemState(s.id)
          results[s.id] = {
            currentHours: state.currentHours,
            lastServiceHoursByKit: state.lastServiceHoursByKit || {},
            eventsCount: state.events?.length || 0,
          }
        } catch {
          results[s.id] = { currentHours: null, lastServiceHoursByKit: {}, eventsCount: 0 }
        }
      }))
      if (cancelled) return
      setById(results)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Group systems by parentId for a cleaner visual grouping.
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

        {loading && (
          <div className="text-xs text-muted-foreground">Loading current hours…</div>
        )}

        {/* Calendar-based systems (not hours-based) */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            HVAC · Monthly service
          </div>
          <button
            onClick={() => setLocation('/maintenance/air-handlers')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left min-h-[80px]"
          >
            <div className="text-2xl">❄️</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Air Handlers</div>
              <div className="text-xs text-muted-foreground">
                Guest & crew AHUs · monthly service checklist
              </div>
            </div>
            <div className="text-xs text-muted-foreground">›</div>
          </button>
        </div>

        {groups.map(group => (
          <div key={group.title} className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {group.title}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {group.systems.map(s => (
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
        ))}
      </div>
    </MenuLayout>
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
    case 'fresh-water-pump': return 'Fresh-water pumps'
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
                  next: {milestone.kits.map(k => k.shortLabel).join(' + ')} at {milestone.dueAtHours} h
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
        <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded border ${badgeClasses}`}>
          {formatHoursUntil(milestone.hoursUntil)}
        </span>
      )}
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
