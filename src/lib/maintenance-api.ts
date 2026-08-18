// Thin client for /api/maintenance. Deliberately mirrors the server op names.

import { getToken } from '@/lib/auth'

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...init, headers, credentials: 'include' })
}

export interface MaintenanceEvent {
  EventId: string
  Timestamp: string
  SystemId: string
  SystemLabel: string
  KitIds: string[]
  HoursAtService: string
  Technician: string
  Notes: string
  DriveFileId: string
  DriveLink: string
  InventoryUsed: { name: string; qty: number | string; partNumber?: string }[]
  Attachments: { name: string; fileId: string; webViewLink?: string | null }[]
}

export interface MaintenanceSystemState {
  systemId: string
  currentHours: number | null
  hoursUpdatedAt: string
  lastServiceHoursByKit: Record<string, number>
  events: MaintenanceEvent[]
}

// ---- localStorage cache (stale-while-revalidate) ----
// The Sheets read-quota (300 req/min/user) is easily saturated when the
// hub or a detail page revalidates. Cache the last good response per
// system so navigation returns instantly and transient upstream failures
// don't wipe the UI back to catalog hints.
const CACHE_KEY_PREFIX = 'maint:sysState:'
const CACHE_TTL_MS = 60_000 // treat cached data as fresh for 60s

interface CachedState { at: number; data: MaintenanceSystemState }

function readCache(systemId: string): CachedState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + systemId)
    if (!raw) return null
    const v = JSON.parse(raw) as CachedState
    if (!v || typeof v.at !== 'number' || !v.data) return null
    return v
  } catch {
    return null
  }
}

function writeCache(systemId: string, data: MaintenanceSystemState) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + systemId, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* quota / private mode - ignore */
  }
}

export function readCachedSystemState(systemId: string): MaintenanceSystemState | null {
  return readCache(systemId)?.data ?? null
}

export async function fetchSystemState(systemId: string): Promise<MaintenanceSystemState> {
  const r = await authFetch(`/api/maintenance?op=system&systemId=${encodeURIComponent(systemId)}`)
  if (!r.ok) throw new Error(`fetchSystemState ${r.status}`)
  const data = await r.json() as MaintenanceSystemState
  writeCache(systemId, data)
  return data
}

// One aggregated call for the Maintenance hub. Serializes the whole hub
// into a single Sheets read on the server side, avoiding the parallel
// per-tile burst that saturated the read quota.
export interface AllSystemsState {
  systems: Record<string, {
    currentHours: number | null
    hoursUpdatedAt: string
    lastServiceHoursByKit: Record<string, number>
    eventsCount: number
  }>
}

export async function fetchAllSystemsState(): Promise<AllSystemsState> {
  const r = await authFetch('/api/maintenance?op=allSystems')
  if (!r.ok) throw new Error(`fetchAllSystemsState ${r.status}`)
  const data = await r.json() as AllSystemsState
  // Warm the per-system cache with what we can — detail pages will show
  // hours + last-service-by-kit instantly on first click even if the
  // detail-page fetch happens to fail.
  try {
    for (const [sid, s] of Object.entries(data.systems || {})) {
      const prev = readCache(sid)?.data
      const merged: MaintenanceSystemState = {
        systemId: sid,
        currentHours: s.currentHours,
        hoursUpdatedAt: s.hoursUpdatedAt,
        lastServiceHoursByKit: s.lastServiceHoursByKit,
        // Preserve the last-known events list; op=allSystems does not
        // ship events to keep the payload small.
        events: prev?.events || [],
      }
      writeCache(sid, merged)
    }
  } catch { /* ignore cache warm failures */ }
  return data
}

export async function updateHours(systemId: string, hours: number, user?: string): Promise<{ ok: boolean; updatedAt: string }> {
  const r = await authFetch('/api/maintenance?op=hours', {
    method: 'POST',
    body: JSON.stringify({ systemId, hours, user }),
  })
  if (!r.ok) {
    let msg = ''
    try { msg = (await r.json()).error } catch {}
    throw new Error(`updateHours ${r.status}${msg ? `: ${msg}` : ''}`)
  }
  return r.json()
}

export interface LogPayload {
  systemId: string
  systemLabel: string
  driveFolderPath: string[]
  kitIds: string[]
  kitLabels: string[]
  hoursAtService: number
  technician: string
  notes?: string
  checklist: { label: string; kitShortLabel: string; done: boolean; notes?: string }[]
  inventory: { name: string; qty: number | string; partNumber?: string }[]
  photos: { base64: string; label?: string }[]
  attachedPdfBase64?: string | null
  attachedPdfFileName?: string | null
}

export interface LogResponse {
  ok: boolean
  eventId: string
  fileId: string | null
  fileLink: string | null
  attachments: { name: string; fileId: string; webViewLink?: string | null }[]
  folderId: string
}

export async function submitMaintenanceLog(payload: LogPayload): Promise<LogResponse> {
  const r = await authFetch('/api/maintenance?op=log', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    let msg = ''
    try { msg = (await r.json()).error } catch {}
    throw new Error(`submitMaintenanceLog ${r.status}${msg ? `: ${msg}` : ''}`)
  }
  return r.json()
}

// Utility: read a File as base64 (strip data: prefix).
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result || '')
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
