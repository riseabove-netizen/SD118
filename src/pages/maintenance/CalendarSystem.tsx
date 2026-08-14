// Generic calendar-based system page (AC chillers, tanks, fresh water).
//
// Route: /maintenance/calendar/:systemId
//
// - Status table: rows are units, columns are items, cells show last
//   service date + state badge.
// - Perform panel: user ticks which (unit × item) cells they want to
//   log, adds technician + date + notes, submits.

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getCrewName } from '@/lib/auth'
import {
  findSystem,
  itemAppliesToUnit,
  intervalLabel,
  type CalendarSystem,
  type CalendarServiceItem,
  type CalendarUnit,
} from '@/data/calendar-systems'
import {
  fetchCalendarServiceEvents,
  logCalendarService,
  buildStatusMap,
  type CalendarServiceEvent,
  type CellStatus,
} from '@/lib/calendar-service-api'

function cellKey(unitId: string, itemId: string) { return `${unitId}|${itemId}` }

function StatusBadge({ status }: { status: CellStatus }) {
  const cls = {
    'never':     'bg-red-500/20 text-red-300 border-red-500/40',
    'overdue':   'bg-red-500/20 text-red-300 border-red-500/40',
    'due-soon':  'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'ok':        'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'as-needed': 'bg-secondary text-muted-foreground border-border',
  }[status.state]
  const label = {
    'never':     'never',
    'overdue':   `overdue ${Math.abs(status.daysUntilDue)}d`,
    'due-soon':  status.daysUntilDue === 0 ? 'due today' : `due in ${status.daysUntilDue}d`,
    'ok':        `${status.daysUntilDue}d left`,
    'as-needed': status.lastDate ? `logged ${status.daysAgo}d ago` : 'as needed',
  }[status.state]
  return (
    <span className={`inline-block text-[10px] leading-none px-2 py-1 rounded border ${cls}`}>{label}</span>
  )
}

export function CalendarSystemPage() {
  const params = useParams<{ systemId: string }>()
  const [, setLocation] = useLocation()
  const system = findSystem(params.systemId)

  if (!system) {
    return (
      <MenuLayout title="Not found" showBack backHref="/maintenance">
        <div className="text-sm text-muted-foreground">Unknown system.</div>
      </MenuLayout>
    )
  }

  const [events, setEvents] = useState<CalendarServiceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [technician, setTechnician] = useState('')
  const [notes, setNotes] = useState('')
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function reload() {
    setLoading(true); setError(null)
    try { setEvents(await fetchCalendarServiceEvents(system!.id)) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    setTechnician(getCrewName() || '')
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.systemId])

  const statusMap = useMemo(() => buildStatusMap(system, events), [system, events])

  function togglePair(unitId: string, itemId: string) {
    const k = cellKey(unitId, itemId)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  function selectAllDue() {
    const next = new Set<string>()
    for (const u of system!.units) {
      for (const it of system!.items) {
        if (!itemAppliesToUnit(system!, it.id, u.id)) continue
        const st = statusMap[cellKey(u.id, it.id)]
        if (st && (st.state === 'due-soon' || st.state === 'overdue' || st.state === 'never')) {
          next.add(cellKey(u.id, it.id))
        }
      }
    }
    setSelected(next)
  }

  function clearSelection() { setSelected(new Set()) }

  async function submit() {
    if (selected.size === 0) return
    setMsg(null); setSubmitting(true)
    try {
      // Group by unit so we can send one call per (unit-set × item-set)
      // combination — but the simple case is: unique unit list × unique
      // item list. That over-fans-out if the user picks weird
      // combinations, so instead we send one call per item with the
      // exact unit list for that item.
      const byItem: Record<string, string[]> = {}
      for (const k of selected) {
        const [uid, iid] = k.split('|')
        if (!byItem[iid]) byItem[iid] = []
        byItem[iid].push(uid)
      }
      let total = 0
      for (const [iid, uids] of Object.entries(byItem)) {
        const r = await logCalendarService({
          systemId: system!.id,
          unitIds: uids,
          itemIds: [iid],
          technician, notes, serviceDate,
        })
        total += r.count
      }
      setMsg(`Logged ${total} service line(s).`)
      setSelected(new Set())
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const anyDue = Object.values(statusMap).some(s => s.state === 'overdue' || s.state === 'due-soon' || s.state === 'never')

  return (
    <MenuLayout title={system.label} showBack backHref="/maintenance">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{system.tileBlurb}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 text-xs p-2">
            {error}
          </div>
        )}

        {/* Status matrix */}
        <StatusTable
          system={system}
          statusMap={statusMap}
          selected={selected}
          onToggle={togglePair}
        />

        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          {anyDue && (
            <button
              onClick={selectAllDue}
              className="px-2.5 py-1 rounded border border-border hover:bg-secondary"
            >Select all due</button>
          )}
          {selected.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-2.5 py-1 rounded border border-border hover:bg-secondary"
            >Clear</button>
          )}
          <div className="ml-auto text-muted-foreground">
            {selected.size === 0 ? 'Tap any cell to log a service' : `${selected.size} selected`}
          </div>
        </div>

        {/* Log form */}
        {selected.size > 0 && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs">
                <div className="text-muted-foreground mb-1">Technician</div>
                <input type="text" value={technician}
                  onChange={e => setTechnician(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              </label>
              <label className="text-xs">
                <div className="text-muted-foreground mb-1">Service date</div>
                <input type="date" value={serviceDate}
                  onChange={e => setServiceDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              </label>
            </div>
            <label className="block text-xs">
              <div className="text-muted-foreground mb-1">Notes (optional)</div>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                placeholder="Readings, parts changed, anything unusual…" />
            </label>
            {msg && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs p-2">{msg}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={submitting}>
                {submitting ? 'Logging…' : `Log ${selected.size} service line${selected.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        )}

        {loading && events.length === 0 && (
          <div className="text-xs text-muted-foreground">Loading history…</div>
        )}
      </div>
    </MenuLayout>
  )
}

function StatusTable({
  system, statusMap, selected, onToggle,
}: {
  system: CalendarSystem
  statusMap: Record<string, CellStatus>
  selected: Set<string>
  onToggle: (unitId: string, itemId: string) => void
}) {
  // Group units by group label so multi-group systems stay readable.
  const groups = groupUnits(system.units)
  return (
    <div className="space-y-3">
      {groups.map(g => (
        <div key={g.title} className="rounded-lg border border-border overflow-hidden">
          {g.title !== '' && (
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold bg-secondary/40 border-b border-border">
              {g.title}
            </div>
          )}
          {g.units.map(u => (
            <UnitBlock
              key={u.id}
              unit={u}
              system={system}
              statusMap={statusMap}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function UnitBlock({
  unit, system, statusMap, selected, onToggle,
}: {
  unit: CalendarUnit
  system: CalendarSystem
  statusMap: Record<string, CellStatus>
  selected: Set<string>
  onToggle: (unitId: string, itemId: string) => void
}) {
  const applicableItems = system.items.filter(it => itemAppliesToUnit(system, it.id, unit.id))
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="px-3 pt-2 pb-1 text-xs font-semibold">{unit.label}</div>
      <ul className="divide-y divide-border/60">
        {applicableItems.map(it => {
          const key = cellKey(unit.id, it.id)
          const st = statusMap[key]
          const isSelected = selected.has(key)
          return (
            <li key={it.id}>
              <button
                onClick={() => onToggle(unit.id, it.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/40 ${isSelected ? 'bg-primary/10' : ''}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary pointer-events-none"
                  readOnly
                  checked={isSelected}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">
                    {it.label}
                    <span className="text-[10px] text-muted-foreground ml-2 font-normal">{intervalLabel(it.interval)}</span>
                  </div>
                  {it.detail && <div className="text-[10px] text-muted-foreground mt-0.5">{it.detail}</div>}
                  {st?.lastDate && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Last done: {st.lastDate}
                    </div>
                  )}
                </div>
                <StatusBadge status={st} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function groupUnits(units: CalendarUnit[]): { title: string; units: CalendarUnit[] }[] {
  // Preserve insertion order.
  const map = new Map<string, CalendarUnit[]>()
  for (const u of units) {
    const g = u.group || ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(u)
  }
  return [...map.entries()].map(([title, units]) => ({ title, units }))
}
