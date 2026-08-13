// Generator maintenance detail page (port or starboard).
//
// URL: /maintenance/generator/:side  where :side is "port" or "starboard".
// The same layout is planned to work for main engines once we fill in
// their kits; for now this page is generator-specific enough to justify
// its own file so we can add engine-specific bits (voltage, fuel filter
// pressure) as separate cards without cluttering the generic detail.

import React, { useEffect, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { isAdmin } from '@/lib/auth'
import {
  MAINTENANCE_SYSTEMS,
  MaintenanceSystem,
  upcomingMilestones,
  formatHoursUntil,
  dueTier,
} from '@/data/maintenance-systems'
import { fetchSystemState, updateHours, MaintenanceEvent } from '@/lib/maintenance-api'

export function GeneratorDetailPage() {
  const params = useParams<{ side: string }>()
  const side = params.side === 'starboard' ? 'starboard' : 'port'
  const system = MAINTENANCE_SYSTEMS.find(s => s.kind === 'generator' && s.side === side)
  const [, setLocation] = useLocation()
  const admin = isAdmin()

  const [currentHours, setCurrentHours] = useState<number | null>(null)
  const [hoursUpdatedAt, setHoursUpdatedAt] = useState<string>('')
  const [lastByKit, setLastByKit] = useState<Record<string, number>>({})
  const [events, setEvents] = useState<MaintenanceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hoursDraft, setHoursDraft] = useState<string>('')
  const [savingHours, setSavingHours] = useState(false)
  const [hoursMsg, setHoursMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!system) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const state = await fetchSystemState(system!.id)
        if (cancelled) return
        const hours = state.currentHours ?? system!.initialHoursHint ?? 0
        setCurrentHours(hours)
        setHoursUpdatedAt(state.hoursUpdatedAt || '')
        setLastByKit(state.lastServiceHoursByKit || {})
        setEvents(state.events || [])
        setHoursDraft(String(hours))
      } catch {
        // Fall back to the hint value from the catalog.
        setCurrentHours(system!.initialHoursHint ?? 0)
        setHoursDraft(String(system!.initialHoursHint ?? 0))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [system?.id])

  if (!system) {
    return (
      <MenuLayout title="Not found" showBack backHref="/maintenance">
        <p className="text-sm text-muted-foreground">
          Unknown generator side: {params.side}
        </p>
      </MenuLayout>
    )
  }

  const milestones = currentHours != null
    ? upcomingMilestones(system, currentHours, lastByKit, 6)
    : []

  async function saveHours() {
    if (!system) return
    const n = Number(hoursDraft)
    if (!Number.isFinite(n) || n < 0) {
      setHoursMsg('Enter a positive number of hours')
      return
    }
    setSavingHours(true)
    setHoursMsg(null)
    try {
      const resp = await updateHours(system.id, n)
      setCurrentHours(n)
      setHoursUpdatedAt(resp.updatedAt)
      setHoursMsg('Saved.')
    } catch (e: any) {
      setHoursMsg(e?.message || 'Failed to save')
    } finally {
      setSavingHours(false)
      setTimeout(() => setHoursMsg(null), 3000)
    }
  }

  return (
    <MenuLayout title={system.label} showBack backHref="/maintenance">
      <div className="space-y-5">
        {/* Current hours card */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Current running hours
              </div>
              <div className="text-3xl font-bold mt-1 text-red-400">
                {currentHours != null ? currentHours.toLocaleString() : '—'} <span className="text-sm text-muted-foreground font-normal">h</span>
              </div>
              {hoursUpdatedAt && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  updated {new Date(hoursUpdatedAt).toLocaleString()}
                </div>
              )}
            </div>
            <button
              onClick={() => setLocation(`/maintenance/perform?systemId=${system.id}`)}
              className="text-xs px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              Perform maintenance
            </button>
          </div>
          {admin && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={hoursDraft}
                onChange={e => setHoursDraft(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                placeholder="Update hours"
              />
              <button
                onClick={saveHours}
                disabled={savingHours}
                className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-50"
              >
                {savingHours ? 'Saving…' : 'Save'}
              </button>
              {hoursMsg && <span className="text-xs text-muted-foreground">{hoursMsg}</span>}
            </div>
          )}
        </div>

        {/* Upcoming schedule */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Upcoming schedule</div>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : milestones.length === 0 ? (
            <div className="text-xs text-muted-foreground">No schedule available.</div>
          ) : (
            <ul className="space-y-1.5">
              {milestones.map(m => {
                const tier = dueTier(m.hoursUntil)
                const badgeClass = tier === 'red'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : tier === 'amber'
                  ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                return (
                  <li key={m.dueAtHours} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 last:border-b-0 py-1.5">
                    <span>
                      <span className="font-semibold">{m.dueAtHours} h</span>
                      <span className="text-muted-foreground"> — </span>
                      <span>{m.kits.map(k => k.shortLabel).join(' + ')}</span>
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${badgeClass}`}>
                      {formatHoursUntil(m.hoursUntil)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Kit reference (checklist preview) */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Service kits reference</div>
          <div className="space-y-3">
            {system.kits.map(kit => {
              const lastDone = lastByKit[kit.id]
              return (
                <div key={kit.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-red-400">{kit.label}</div>
                    {typeof lastDone === 'number' && (
                      <div className="text-[11px] text-muted-foreground">last done at {lastDone} h</div>
                    )}
                  </div>
                  <ul className="text-xs text-muted-foreground pl-4 list-disc space-y-0.5">
                    {kit.checklist.slice(0, 4).map(it => (
                      <li key={it.id}>{it.label}</li>
                    ))}
                    {kit.checklist.length > 4 && (
                      <li className="text-muted-foreground/60">+ {kit.checklist.length - 4} more</li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        {/* History */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Past services</div>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : events.length === 0 ? (
            <div className="text-xs text-muted-foreground">No services logged yet.</div>
          ) : (
            <ul className="space-y-2">
              {events.map(ev => (
                <li key={ev.EventId} className="border-b border-border/40 pb-2 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      {ev.KitIds.join(' + ') || '—'} at {ev.HoursAtService} h
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(ev.Timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ev.Technician || 'unknown'}{ev.Notes ? ` · ${ev.Notes}` : ''}
                  </div>
                  {ev.DriveLink && (
                    <a href={ev.DriveLink} target="_blank" rel="noreferrer" className="text-xs text-red-400 hover:underline">
                      View PDF ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MenuLayout>
  )
}
