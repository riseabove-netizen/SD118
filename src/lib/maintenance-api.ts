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

export async function fetchSystemState(systemId: string): Promise<MaintenanceSystemState> {
  const r = await authFetch(`/api/maintenance?op=system&systemId=${encodeURIComponent(systemId)}`)
  if (!r.ok) throw new Error(`fetchSystemState ${r.status}`)
  return r.json()
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
