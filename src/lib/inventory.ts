// Shared inventory types and fetchers

export type InventoryTab = 'Spares' | 'Consumables'

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

export const SPARE_SUB_LOCATIONS = [
  'Engine Room - Port Locker',
  'Engine Room - STBD Locker',
  'Engine Room - Forward Bin',
  'Engine Room - Aft Bin',
  'Engine Room - Bin #1',
  'Engine Room - Bin #2',
  'Engine Room - Bin #3',
  'Engine Room - Workbench',
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

export const CONSUMABLE_SUB_LOCATIONS = [
  'Anchor Locker',
  'Fly Storage',
  'Bridge Deck Locker',
  'Aft Deck Locker - Port',
  'Aft Deck Locker - STBD',
  'Galley',
  'Engine Room',
  'Crew Mess',
  'Lazarette',
  'Master Stateroom',
  'Guest Cabin',
  'Salon',
  'Other',
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