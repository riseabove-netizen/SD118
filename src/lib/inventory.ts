// Shared inventory types and fetchers

export type InventoryTab = 'Spares' | 'Consumables' | 'Tools'

export type SpareItem = {
  rowIndex: number // 1-based row in the sheet (header is row 1, first data row is 2)
  ID: string
  'Part Number': string
  Description: string
  Manufacturer: string
  System: string
  Qty: string
  Location: string
  'Sub-Location': string
  'Min Qty': string
  'Last Used': string
  Notes: string
  'Photo URL': string
  'Created At': string
  'Created By': string
}

export type ConsumableItem = {
  rowIndex: number
  ID: string
  Item: string
  Category: string
  Location: string
  'Sub-Location': string
  Qty: string
  Unit: string
  'Min Qty': string
  'Max Qty': string
  'Last Used': string
  Notes: string
  'Photo URL': string
  'Created At': string
  'Created By': string
}

export type ToolItem = {
  rowIndex: number
  ID: string
  Name: string
  Category: string
  Brand: string
  'Model / Serial': string
  Location: string
  'Sub-Location': string
  Condition: string
  'Last Checked': string
  Notes: string
  'Photo URL': string
  'Created At': string
  'Created By': string
}

export type Transaction = {
  Timestamp: string
  Tab: string
  'Item ID': string
  'Item Name': string
  Delta: string
  'Qty After': string
  Reason: string
  User: string
  Notes: string
}

// Spare systems
export const SPARE_SYSTEMS = [
  'Main Engines',
  'Generators',
  'Watermaker',
  'Hydraulics',
  'AC / Refrigeration',
  'Electrical',
  'Plumbing',
  'Steering',
  'Stabilizers',
  'Fuel System',
  'Other',
]

// Locations (level 1) — broad areas of the vessel
export const SPARE_LOCATIONS = [
  'Engine Room',
  'Lazarette',
  'Bridge',
  'Interior',
  'Exterior',
  'Other',
]

export const SPARE_SUB_LOCATIONS = [
  'Port Locker',
  'STBD Locker',
  'Forward Bin',
  'Aft Bin',
  'Bin #1',
  'Bin #2',
  'Bin #3',
  'Bin #1 - STBD Gen',
  'Workbench',
  'Other',
]

export const CONSUMABLE_CATEGORIES = [
  'Galley',
  'Cleaning',
  'Toiletries',
  'Lines & Fenders',
  'Safety',
  'Deck Supplies',
  'Tools',
  'Spare Parts',
  'Office',
  'Other',
]

export const CONSUMABLE_LOCATIONS = [
  'Interior',
  'Exterior',
  'Engine Room',
  'Bridge',
  'Lazarette',
  'Other',
]

export const CONSUMABLE_SUB_LOCATIONS = [
  'Salon',
  'Galley',
  'Master Stateroom',
  'Guest Cabin',
  'Crew Mess',
  'Anchor Locker',
  'Fly Storage',
  'Bridge Deck Locker',
  'Aft Deck Locker - Port',
  'Aft Deck Locker - STBD',
  'Lazarette',
  'Engine Room',
  'Other',
]

// Tools
export const TOOL_CATEGORIES = [
  'Hand Tool',
  'Power Tool',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'Diagnostic',
  'Safety',
  'Measurement',
  'Diving / Snorkeling',
  'Other',
]

export const TOOL_LOCATIONS = [
  'Engine Room',
  'Lazarette',
  'Bridge',
  'Interior',
  'Exterior',
  'Other',
]

export const TOOL_SUB_LOCATIONS = [
  'Workbench',
  'Toolbox',
  'Tool Cabinet',
  'Port Locker',
  'STBD Locker',
  'Forward Bin',
  'Aft Bin',
  'Crew Mess',
  'Garage',
  'Other',
]

export const TOOL_CONDITIONS = [
  'New',
  'Good',
  'Fair',
  'Needs Service',
  'Broken',
]

async function jsonOrError(res: Response) {
  const text = await res.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text || res.statusText)
  }
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || res.statusText)
  }
  return data
}

export async function fetchInventory(tab: InventoryTab): Promise<any[]> {
  const res = await fetch(`/api/inventory-list?tab=${encodeURIComponent(tab)}`)
  const data = await jsonOrError(res)
  return data.items || []
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch('/api/inventory-list?tab=Transactions')
  const data = await jsonOrError(res)
  return data.items || []
}

export async function upsertInventoryItem(args: {
  tab: InventoryTab
  rowIndex?: number // omit to create new
  values: Record<string, string | number>
  user: string
  qtyDelta?: number // if provided, logs to Transactions
  reason?: string
}) {
  const res = await fetch('/api/inventory-upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  return jsonOrError(res)
}

export async function extractInventoryFromPhotos(args: {
  tab: InventoryTab
  imagesBase64: string[]
}): Promise<{ items: any[] }> {
  const res = await fetch('/api/inventory-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  return jsonOrError(res)
}

// Helper for combo fields: merge presets + user-seen values, dedup, keep order
export function mergeOptions(presets: string[], used: Iterable<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of presets) {
    if (!seen.has(p)) { seen.add(p); out.push(p) }
  }
  for (const v of used) {
    const s = (v || '').trim()
    if (s && !seen.has(s)) { seen.add(s); out.push(s) }
  }
  return out
}
