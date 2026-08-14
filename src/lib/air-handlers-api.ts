// Client wrappers for /api/air-handlers.

export interface AirHandlerEvent {
  EventId: string
  Timestamp: string
  UnitId: string
  Zone: string
  Technician: string
  ChecklistIdsCsv: string
  Notes: string
  ServiceDate: string
}

export interface AirHandlerLogInput {
  unitIds: string[]
  zone: 'guest' | 'crew'
  technician: string
  notes: string
  checklistIds: string[]
  serviceDate?: string
}

export async function fetchAirHandlerEvents(): Promise<AirHandlerEvent[]> {
  const r = await fetch('/api/air-handlers?op=list')
  if (!r.ok) throw new Error('list failed: ' + r.status)
  const d = await r.json()
  return d.events || []
}

export async function logAirHandlerService(input: AirHandlerLogInput): Promise<{ eventId: string; count: number }> {
  const r = await fetch('/api/air-handlers?op=log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error('log failed: ' + t)
  }
  return r.json()
}

// Compute the most-recent service date per unit from the events list.
export function lastServiceByUnit(events: AirHandlerEvent[]): Record<string, AirHandlerEvent> {
  const out: Record<string, AirHandlerEvent> = {}
  for (const ev of events) {
    if (!ev.UnitId) continue
    const cur = out[ev.UnitId]
    if (!cur || (ev.Timestamp || '') > (cur.Timestamp || '')) out[ev.UnitId] = ev
  }
  return out
}

export function daysSince(iso: string): number {
  if (!iso) return Infinity
  const t = new Date(iso).getTime()
  if (isNaN(t)) return Infinity
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24))
}
