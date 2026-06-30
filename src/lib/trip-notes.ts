// Client helpers for trip / day notes.
// Backend lives inside api/trips.ts (actions `notes-list`, `notes-add`,
// `notes-update`, `notes-delete`) to stay under the Vercel Hobby 12-function
// cap.

import { getToken } from './auth'

export type TripNote = {
  id: string
  tripId: string
  dayIso: string // '' for trip-level notes, YYYY-MM-DD for a specific day
  author: string
  text: string
  createdAt: string // ISO timestamp
}

export async function listNotes(tripId: string): Promise<TripNote[]> {
  try {
    const resp = await fetch(`/api/trips?action=notes-list&tripId=${encodeURIComponent(tripId)}`, { cache: 'no-store' })
    if (!resp.ok) return []
    const data = (await resp.json()) as { notes?: TripNote[] }
    return Array.isArray(data?.notes) ? data.notes : []
  } catch {
    return []
  }
}

export async function addNote(params: {
  tripId: string
  dayIso?: string
  author: string
  text: string
}): Promise<{ ok: boolean; note?: TripNote; detail?: string }> {
  try {
    const resp = await fetch('/api/trips?action=notes-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: params.tripId,
        dayIso: params.dayIso || '',
        author: params.author || 'guest',
        text: params.text,
      }),
    })
    if (!resp.ok) {
      let detail = ''
      try {
        const d = await resp.json()
        detail = d?.error || d?.detail || ''
      } catch {
        detail = await resp.text()
      }
      return { ok: false, detail: detail || `HTTP ${resp.status}` }
    }
    const data = (await resp.json()) as { ok: boolean; note: TripNote }
    return { ok: true, note: data.note }
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Network error' }
  }
}

/**
 * Edit an existing note. Server-side rule: admin OR matching author.
 */
export async function updateNote(params: {
  id: string
  author: string // current viewer’s name (used for author-match)
  text: string
}): Promise<{ ok: boolean; note?: TripNote; detail?: string }> {
  try {
    const resp = await fetch('/api/trips?action=notes-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: params.id,
        text: params.text,
        author: params.author || '',
        token: getToken() || '',
      }),
    })
    if (!resp.ok) {
      let detail = ''
      try {
        const d = await resp.json()
        detail = d?.error || d?.detail || ''
      } catch {
        detail = await resp.text()
      }
      return { ok: false, detail: detail || `HTTP ${resp.status}` }
    }
    const data = (await resp.json()) as { ok: boolean; note: TripNote }
    return { ok: true, note: data.note }
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Network error' }
  }
}

/**
 * Delete a note. Admin-only on the server.
 */
export async function deleteNote(id: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const resp = await fetch('/api/trips?action=notes-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, token: getToken() || '' }),
    })
    if (!resp.ok) {
      let detail = ''
      try {
        const d = await resp.json()
        detail = d?.error || d?.detail || ''
      } catch {
        detail = await resp.text()
      }
      return { ok: false, detail: detail || `HTTP ${resp.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Network error' }
  }
}

/**
 * Format a relative-ish timestamp suitable for the notes list:
 *   "2m ago", "3h ago", "Yesterday 14:32", "Aug 14 · 09:12"
 */
export function formatNoteTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = Date.now()
  const diff = now - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
