import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
  maxDuration: 60,
}

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const SPARE_HEADERS = [
  'ID', 'Part Number', 'Description', 'Manufacturer', 'System', 'Qty',
  'Location', 'Sub-Location', 'Min Qty', 'Last Used', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]
const CONSUMABLE_HEADERS = [
  'ID', 'Item', 'Category', 'Location', 'Sub-Location', 'Qty', 'Unit',
  'Min Qty', 'Max Qty', 'Last Used', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]
const TOOL_HEADERS = [
  'ID', 'Name', 'Category', 'Brand', 'Model / Serial',
  'Location', 'Sub-Location', 'Condition', 'Last Checked', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]
const SUPPLY_HEADERS = [
  'ID', 'Item', 'Category', 'Brand', 'Location', 'Sub-Location', 'Qty', 'Unit',
  'Min Qty', 'Max Qty', 'Last Used', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// Fallback: if Location wasn't provided, map a consumable sub-location to Interior/Exterior/etc.
function locationForConsumable(sub: string): string {
  const exterior = new Set([
    'Anchor Locker', 'Fly Storage', 'Bridge Deck Locker',
    'Aft Deck Locker - Port', 'Aft Deck Locker - STBD',
  ])
  if (!sub) return ''
  if (exterior.has(sub)) return 'Exterior'
  if (sub === 'Engine Room') return 'Engine Room'
  if (sub === 'Lazarette') return 'Lazarette'
  return 'Interior'
}

type SpareDraft = Record<string, string>
type ConsumableDraft = Record<string, string>
type ToolDraft = Record<string, string>
type SupplyDraft = Record<string, string>

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!INVENTORY_ID) {
    return res.status(500).json({
      error: 'Server not configured',
      detail: 'INVENTORY_SPREADSHEET_ID env var is not set',
    })
  }

  const { spares, consumables, tools, supplies, user } = (req.body || {}) as {
    spares?: SpareDraft[]
    consumables?: ConsumableDraft[]
    tools?: ToolDraft[]
    supplies?: SupplyDraft[]
    user?: string
  }

  if (
    (!spares || spares.length === 0) &&
    (!consumables || consumables.length === 0) &&
    (!tools || tools.length === 0) &&
    (!supplies || supplies.length === 0)
  ) {
    return res.status(400).json({ error: 'No items to save' })
  }

  const userName = user || 'crew'
  const now = new Date().toISOString()

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    let savedSpares = 0
    let savedConsumables = 0
    let savedTools = 0
    let savedSupplies = 0

    if (spares && spares.length > 0) {
      const rows = spares
        .filter(s => (s['Part Number'] || '').trim() || (s['Description'] || '').trim())
        .map(s => {
          const merged: SpareDraft = { ...s }
          if (!merged.ID) merged.ID = newId()
          if (!merged.Location) merged.Location = 'Engine Room'
          merged['Created At'] = now
          merged['Created By'] = userName
          return SPARE_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID,
          range: 'Spares!A:A',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows },
        })
        savedSpares = rows.length
      }
    }

    if (consumables && consumables.length > 0) {
      const rows = consumables
        .filter(c => (c.Item || '').trim())
        .map(c => {
          const merged: ConsumableDraft = { ...c }
          if (!merged.ID) merged.ID = newId()
          if (!merged.Location) merged.Location = locationForConsumable(merged['Sub-Location'] || '')
          if (!merged.Unit) merged.Unit = 'ea'
          merged['Created At'] = now
          merged['Created By'] = userName
          return CONSUMABLE_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID,
          range: 'Consumables!A:A',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows },
        })
        savedConsumables = rows.length
      }
    }

    if (tools && tools.length > 0) {
      const rows = tools
        .filter(t => (t.Name || '').trim())
        .map(t => {
          const merged: ToolDraft = { ...t }
          if (!merged.ID) merged.ID = newId()
          if (!merged.Location) merged.Location = 'Engine Room'
          if (!merged.Condition) merged.Condition = 'Good'
          merged['Created At'] = now
          merged['Created By'] = userName
          return TOOL_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID,
          range: 'Tools!A:A',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows },
        })
        savedTools = rows.length
      }
    }

    if (supplies && supplies.length > 0) {
      const rows = supplies
        .filter(s => (s.Item || '').trim())
        .map(s => {
          const merged: SupplyDraft = { ...s }
          if (!merged.ID) merged.ID = newId()
          if (!merged.Location) merged.Location = 'Exterior'
          if (!merged.Unit) merged.Unit = 'ea'
          merged['Created At'] = now
          merged['Created By'] = userName
          return SUPPLY_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID,
          range: 'Supplies!A:A',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows },
        })
        savedSupplies = rows.length
      }
    }

    return res.status(200).json({ ok: true, savedSpares, savedConsumables, savedTools, savedSupplies })
  } catch (error: any) {
    console.error('inventory-bulk-save error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to save items', detail })
  }
}
