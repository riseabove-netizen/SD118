// Client helpers for the Watch Duties backend (routed through api/trips.ts).
import type { WatchDutyState } from '@/data/watch-duties'

export async function loadWatchDay(date: string): Promise<WatchDutyState | null> {
  try {
    const resp = await fetch(`/api/trips?action=watch-get&date=${encodeURIComponent(date)}`, { cache: 'no-store' })
    if (!resp.ok) return null
    const data = (await resp.json()) as { state: WatchDutyState | null }
    return data?.state || null
  } catch {
    return null
  }
}

export async function saveWatchDay(state: WatchDutyState, user?: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const resp = await fetch('/api/trips?action=watch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, user: user || state.crewOnDuty || 'crew' }),
    })
    if (!resp.ok) {
      const text = await resp.text()
      return { ok: false, detail: text }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Network error' }
  }
}

export async function finalizeWatchDay(
  state: WatchDutyState,
  user?: string,
): Promise<{ ok: boolean; pdfLink?: string; detail?: string }> {
  try {
    const resp = await fetch('/api/trips?action=watch-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, user: user || state.crewOnDuty || 'crew' }),
    })
    if (!resp.ok) {
      const text = await resp.text()
      return { ok: false, detail: text }
    }
    const data = (await resp.json()) as { ok: true; pdfLink?: string }
    return { ok: true, pdfLink: data.pdfLink }
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Network error' }
  }
}
