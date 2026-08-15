// Air Handler status page.
//
// Shows a table for each zone (Guest / Crew) with one row per air-handler
// unit. Each row shows last service date, days since, and a Due/OK badge
// based on the 30-day monthly interval. A "Service now" button jumps into
// the Perform flow pre-scoped to that zone.

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import {
  AIR_HANDLERS,
  AirHandlerUnit,
  AIR_HANDLER_INTERVAL_DAYS,
  AIR_HANDLER_OVERDUE_GRACE_DAYS,
} from '@/data/air-handlers'
import {
  fetchAirHandlerEvents,
  lastServiceByUnit,
  daysSince,
  type AirHandlerEvent,
} from '@/lib/air-handlers-api'

type Zone = 'guest' | 'crew'

interface RowStatus {
  unit: AirHandlerUnit
  last?: AirHandlerEvent
  daysAgo: number
  daysUntilDue: number
  state: 'never' | 'ok' | 'due-soon' | 'overdue'
}

function computeStatus(unit: AirHandlerUnit, ev?: AirHandlerEvent): RowStatus {
  if (!ev) {
    return { unit, daysAgo: Infinity, daysUntilDue: -Infinity, state: 'never' }
  }
  const d = daysSince(ev.ServiceDate || ev.Timestamp)
  const until = AIR_HANDLER_INTERVAL_DAYS - d
  let state: RowStatus['state'] = 'ok'
  if (d > AIR_HANDLER_INTERVAL_DAYS + AIR_HANDLER_OVERDUE_GRACE_DAYS) state = 'overdue'
  else if (d >= AIR_HANDLER_INTERVAL_DAYS) state = 'due-soon'
  return { unit, last: ev, daysAgo: d, daysUntilDue: until, state }
}

function StatusBadge({ status }: { status: RowStatus }) {
  const cls = {
    'never':    'bg-red-500/20 text-red-300 border-red-500/40',
    'overdue':  'bg-red-500/20 text-red-300 border-red-500/40',
    'due-soon': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'ok':       'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  }[status.state]
  const label = {
    'never':    'due now',
    'overdue':  `overdue ${Math.abs(status.daysUntilDue)}d`,
    'due-soon': status.daysUntilDue === 0 ? 'due today' : `due in ${status.daysUntilDue}d`,
    'ok':       `${status.daysUntilDue}d left`,
  }[status.state]
  return (
    <span className={`inline-block text-[10px] leading-none px-2 py-1 rounded border ${cls}`}>
      {label}
    </span>
  )
}

function ZoneTable({ zone, rows }: { zone: Zone; rows: RowStatus[] }) {
  const overdue = rows.filter(r => r.state === 'overdue' || r.state === 'never').length
  const dueSoon = rows.filter(r => r.state === 'due-soon').length
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-secondary/40">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">{zone === 'guest' ? 'Guest areas' : 'Crew areas'}</div>
          <div className="text-[11px] text-muted-foreground">
            {rows.length} units · <span className="text-red-300">{overdue} due</span>
            {dueSoon > 0 && <> · <span className="text-amber-300">{dueSoon} due soon</span></>}
          </div>
        </div>
        <Link href={`/maintenance/air-handlers/${zone}`}>
          <Button size="sm">Service now</Button>
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary/20 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Unit</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Last service</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Days ago</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.unit.id} className="border-t border-border/60">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.unit.label}</div>
                  {r.unit.group && <div className="text-[10px] text-muted-foreground">{r.unit.group}</div>}
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  {r.last?.ServiceDate || r.last?.Timestamp?.slice(0, 10) || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  {isFinite(r.daysAgo)
                    ? r.daysAgo === 0 ? 'today' : `${r.daysAgo}d`
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2"><StatusBadge status={r} /></td>
                <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                  {r.last?.Technician || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AirHandlersPage() {
  const [events, setEvents] = useState<AirHandlerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setEvents(await fetchAirHandlerEvents())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  const rowsByZone = useMemo(() => {
    const last = lastServiceByUnit(events)
    const g: RowStatus[] = []
    const c: RowStatus[] = []
    for (const u of AIR_HANDLERS) {
      const row = computeStatus(u, last[u.id])
      if (u.zone === 'guest') g.push(row); else c.push(row)
    }
    const rank = { 'overdue': 0, 'never': 1, 'due-soon': 2, 'ok': 3 } as const
    const sortByStatus = (a: RowStatus, b: RowStatus) =>
      rank[a.state] - rank[b.state] || a.unit.label.localeCompare(b.unit.label)
    g.sort(sortByStatus); c.sort(sortByStatus)
    return { guest: g, crew: c }
  }, [events])

  return (
    <MenuLayout title="Air Handlers" showBack backHref="/maintenance">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Monthly service across every AHU on board. Tap <em>Service now</em> on either
          zone, tick the units you're servicing, and log the checklist in one shot.
        </p>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 text-xs p-2">
            {error}
          </div>
        )}

        {loading && events.length === 0 ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : (
          <>
            <ZoneTable zone="guest" rows={rowsByZone.guest} />
            <ZoneTable zone="crew" rows={rowsByZone.crew} />
          </>
        )}

        <div className="text-[11px] text-muted-foreground">
          Interval: every {AIR_HANDLER_INTERVAL_DAYS} days · grace period {AIR_HANDLER_OVERDUE_GRACE_DAYS} days
          before overdue.
        </div>
      </div>
    </MenuLayout>
  )
}
