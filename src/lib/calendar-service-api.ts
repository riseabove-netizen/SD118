// Client wrappers for /api/calendar-service.

import type { CalendarSystem, Interval } from '@/data/calendar-systems'
import { intervalDays } from '@/data/calendar-systems'

export interface CalendarServiceEvent {
  EventId: string
  Timestamp: string
  SystemId: string
  UnitId: string
  ItemId: string
  Technician: string
  Notes: string
  ServiceDate: string
}

export interface CalendarLogInput {
  systemId: string
  unitIds: string[]
  itemIds: string[]
  technician: string
  notes: string
  serviceDate?: string
}

export async function fetchCalendarServiceEvents(systemId?: string): Promise<CalendarServiceEvent[]> {
  const url = '/api/calendar-service?op=list' + (systemId ? `&systemId=${encodeURIComponent(systemId)}` : '')
  const r = await fetch(url)
  if (!r.ok) throw new Error('list failed: ' + r.status)
  const d = await r.json()
  return d.events || []
}

export async function logCalendarService(input: CalendarLogInput): Promise<{ eventId: string; count: number }> {
  const r = await fetch('/api/calendar-service?op=log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!r.ok) throw new Error('log failed: ' + await r.text())
  return r.json()
}

// Most-recent service date per (unit × item), keyed as "unitId|itemId".
export function lastByUnitItem(events: CalendarServiceEvent[]): Record<string, CalendarServiceEvent> {
  const out: Record<string, CalendarServiceEvent> = {}
  for (const ev of events) {
    if (!ev.UnitId || !ev.ItemId) continue
    const key = `${ev.UnitId}|${ev.ItemId}`
    const cur = out[key]
    if (!cur || (ev.Timestamp || '') > (cur.Timestamp || '')) out[key] = ev
  }
  return out
}

export interface CellStatus {
  lastDate: string | null    // ISO date
  daysAgo: number            // Infinity when never
  daysUntilDue: number       // -Infinity when never
  state: 'never' | 'ok' | 'due-soon' | 'overdue' | 'as-needed'
}

export function daysSinceIso(iso: string): number {
  if (!iso) return Infinity
  const d = new Date(iso).getTime()
  if (isNaN(d)) return Infinity
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))
}

export function computeStatus(
  interval: Interval,
  lastDate: string | null,
  overdueGraceDays = 7,
): CellStatus {
  if (interval.kind === 'as-needed') {
    return {
      lastDate,
      daysAgo: lastDate ? daysSinceIso(lastDate) : Infinity,
      daysUntilDue: Infinity,
      state: 'as-needed',
    }
  }
  if (!lastDate) {
    return { lastDate: null, daysAgo: Infinity, daysUntilDue: -Infinity, state: 'never' }
  }
  const daysAgo = daysSinceIso(lastDate)
  const iv = intervalDays(interval)
  const daysUntilDue = iv - daysAgo
  let state: CellStatus['state'] = 'ok'
  if (daysAgo > iv + overdueGraceDays) state = 'overdue'
  else if (daysAgo >= iv)              state = 'due-soon'
  return { lastDate, daysAgo, daysUntilDue, state }
}

// Effective last-done date for a cell: pick whichever is more recent —
// the seedLastDone (from data file) or a real logged event.
export function effectiveLastDate(
  seed: string | undefined,
  event: CalendarServiceEvent | undefined,
): string | null {
  const evDate = event ? (event.ServiceDate || event.Timestamp?.slice(0, 10) || null) : null
  if (seed && evDate) return evDate > seed ? evDate : seed
  return evDate || seed || null
}

// Convenience: build a { unitId|itemId -> CellStatus } map for a system.
export function buildStatusMap(
  system: CalendarSystem,
  events: CalendarServiceEvent[],
): Record<string, CellStatus> {
  const last = lastByUnitItem(events)
  const out: Record<string, CellStatus> = {}
  for (const u of system.units) {
    for (const it of system.items) {
      const key = `${u.id}|${it.id}`
      const eff = effectiveLastDate(it.seedLastDone, last[key])
      out[key] = computeStatus(it.interval, eff)
    }
  }
  return out
}
