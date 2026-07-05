// Client-side helpers for GET/POST /api/anchor-schedule

export interface ScheduleState {
  schedule: Record<string, string>
  notified: Record<string, string>
}

export async function fetchSchedule(startedAt: string): Promise<ScheduleState> {
  const resp = await fetch(`/api/anchor-schedule?startedAt=${encodeURIComponent(startedAt)}`)
  if (!resp.ok) return { schedule: {}, notified: {} }
  const j = await resp.json()
  return { schedule: j.schedule || {}, notified: j.notified || {} }
}

export async function saveSchedule(startedAt: string, schedule: Record<string, string>, user: string): Promise<ScheduleState> {
  const resp = await fetch('/api/anchor-schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ startedAt, schedule, user }),
  })
  if (!resp.ok) throw new Error('Failed to save schedule')
  const j = await resp.json()
  return { schedule: j.schedule || schedule, notified: j.notified || {} }
}

/**
 * Build the list of upcoming hour slots, top-of-hour aligned, starting from
 * the next full hour after `startedAt`.
 */
export function buildHourSlots(startedAt: string, hours: number = 12): string[] {
  const start = new Date(startedAt)
  if (isNaN(start.getTime())) return []
  const first = new Date(start)
  first.setMinutes(0, 0, 0)
  first.setHours(first.getHours() + 1)
  const out: string[] = []
  for (let i = 0; i < hours; i++) {
    const d = new Date(first)
    d.setHours(d.getHours() + i)
    out.push(d.toISOString())
  }
  return out
}

export function formatHourLocal(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}
