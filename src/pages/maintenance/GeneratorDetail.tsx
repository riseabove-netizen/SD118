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
import { ZincRodsGuide, isZincRodItem } from '@/components/ZincRodsGuide'
import { EQUIPMENT_DATA } from '@/data/equipment-data'

export function GeneratorDetailPage() {
  // Two supported URL shapes:
  //   /maintenance/generator/:side       → look up by kind=generator + side
  //   /maintenance/system/:systemId      → look up by explicit system id
  //                                        (works for watermakers, main
  //                                        engines, and every future
  //                                        hour-based system)
  const params = useParams<{ side?: string; systemId?: string }>()
  const system = params.systemId
    ? MAINTENANCE_SYSTEMS.find(s => s.id === params.systemId)
    : MAINTENANCE_SYSTEMS.find(
        s => s.kind === 'generator' && s.side === (params.side === 'starboard' ? 'starboard' : 'port'),
      )
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
  const [zincGuideOpen, setZincGuideOpen] = useState(false)

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
          Unknown maintenance system: {params.systemId || params.side}
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

  const equip = EQUIPMENT_DATA[system.id]

  return (
    <MenuLayout title={system.label} showBack backHref="/maintenance">
      <div className="space-y-5">
        {/* Equipment data card */}
        {equip && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Equipment data</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {equip.title}
              </div>
            </div>
            <div className="rounded-md border border-border/60 overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {equip.rows.map((r, i) => (
                    <tr key={r.label} className={i % 2 === 0 ? 'bg-background/30' : ''}>
                      <td className="px-3 py-1.5 text-muted-foreground border-b border-border/40 w-1/2">{r.label}</td>
                      <td className="px-3 py-1.5 font-mono text-foreground border-b border-border/40">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {equip.manualUrl && (
              <a
                href={equip.manualUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:underline"
              >
                📖 View service manual
                {equip.manualLabel && (
                  <span className="text-muted-foreground"> — {equip.manualLabel}</span>
                )}
                <span aria-hidden>↗</span>
              </a>
            )}
          </div>
        )}

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
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setLocation(`/maintenance/perform?systemId=${system.id}`)}
                className="text-xs px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Perform maintenance
              </button>
              <button
                onClick={() => setLocation(`/maintenance/perform?systemId=${system.id}&mode=custom`)}
                className="text-xs px-3 py-2 rounded-md border border-border bg-card hover:bg-secondary text-foreground font-medium"
              >
                🔧 Log custom repair
              </button>
            </div>
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
                    {kit.checklist.map(it => {
                      const zinc = system.kind === 'main-engine' && (isZincRodItem(it.id) || isZincRodItem(it.label))
                      return (
                        <li key={it.id}>
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <span>{it.label}</span>
                            {zinc && (
                              <button
                                type="button"
                                onClick={() => setZincGuideOpen(true)}
                                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/50 text-red-300 hover:bg-red-500/10"
                              >
                                📍 Show locations (10 rods)
                              </button>
                            )}
                          </span>
                          {it.detail && /oil/i.test(it.label) && (
                            <div className="text-[11px] text-amber-400/90 mt-0.5">
                              ⚠ {it.detail}
                            </div>
                          )}
                        </li>
                      )
                    })}
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
      <ZincRodsGuide open={zincGuideOpen} onClose={() => setZincGuideOpen(false)} />
    </MenuLayout>
  )
}
