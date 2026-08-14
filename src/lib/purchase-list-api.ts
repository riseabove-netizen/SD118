// Thin client for /api/purchase-list.

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

export interface PurchaseItem {
  rowIndex: number
  Id: string
  AddedAt: string
  AddedBy: string
  Name: string
  PartNumber: string
  Qty: string
  SourceTab: string
  SourceRow: string
  SourceEventId: string
  Status: string   // "open" | "received"
  StorageLocation: string
  SubLocation: string
  ReceivedAt: string
  ReceivedBy: string
  Notes: string
}

export interface PurchaseAddInput {
  name: string
  partNumber?: string
  qty?: number | string
  sourceTab?: string
  sourceRow?: number | string
  notes?: string
}

export async function fetchPurchaseList(): Promise<PurchaseItem[]> {
  const r = await authFetch('/api/purchase-list?op=list')
  if (!r.ok) throw new Error('Failed to load purchase list')
  const j = await r.json()
  return j.items || []
}

export async function addToPurchaseList(
  items: PurchaseAddInput[],
  opts: { addedBy?: string; sourceEventId?: string; force?: boolean } = {}
): Promise<{ added: number; skipped: string[] }> {
  const r = await authFetch('/api/purchase-list', {
    method: 'POST',
    body: JSON.stringify({ op: 'add', items, ...opts }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Failed to add')
  return j
}

export async function removeFromPurchaseList(ids: string[]): Promise<{ removed: number }> {
  const r = await authFetch('/api/purchase-list', {
    method: 'POST',
    body: JSON.stringify({ op: 'remove', ids }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Failed to remove')
  return j
}

export async function moveToStorage(
  ids: string[],
  location: string,
  opts: {
    subLocation?: string
    receivedBy?: string
    notes?: string
    incrementStock?: boolean
  } = {}
): Promise<{ moved: number; stockBumped: number }> {
  const r = await authFetch('/api/purchase-list', {
    method: 'POST',
    body: JSON.stringify({ op: 'move', ids, location, ...opts }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Failed to move')
  return j
}
