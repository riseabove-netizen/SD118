import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { google } from 'googleapis'

export const config = {
  api: { bodyParser: { sizeLimit: '40mb' } },
  maxDuration: 60,
}

// ============================================================
// EXTRACT
// ============================================================
const extractClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const EXTRACT_PROMPT = `You are cataloging items onboard the M/Y Rise Above (Sanlorenzo SD118, yacht). The user is dictating and/or attaching photos to add MULTIPLE inventory items at once.

Classify each item as one of FOUR types:

  "Spare"       — a mechanical replacement part identified by a manufacturer part number
                  (filters, gaskets, impellers, belts, sensors, pumps, hoses, fuses, etc.).
  "Consumable"  — provisions that get used and restocked frequently: galley provisions,
                  cleaning chemicals, toiletries, food, office supplies, etc.
  "Supply"      — durable supplies stored in lockers: lines, fenders, paint, hardware,
                  fasteners, lubricants, deck supplies, safety gear, hoses, etc. Not a tool,
                  not a spare part with a part number, and not a quickly-consumed provision.
  "Tool"        — a durable tool the crew uses (hand tools, power tools, diagnostic gear,
                  measurement instruments, safety equipment, diving gear, etc.).

If the user explicitly says "spare", "consumable", "supply", or "tool", honor that. If a part number is mentioned, prefer Spare. If category is ambiguous, make your best guess.

For EACH distinct item across the text and images, output a record with the relevant fields below.

Location is TWO fields:
  location     = broad area of the vessel: "Engine Room", "Lazarette", "Bridge", "Interior", "Exterior", "Other"
  sub_location = specific place inside that area (string). Prefer one of the suggestions below for each type, but if the user explicitly names a NEW location (e.g. "Bin#1-STBD Gen", "Crew Cabin 3 Locker"), use the exact name they gave — do NOT force it back to the list.

For Spares, fields:
  type         = "Spare"
  part_number  = manufacturer part number (string). If not stated, "".
  description  = short description
  manufacturer = brand if known, else ""
  system       = one of: "Main Engines", "Generators", "Watermaker", "Hydraulics", "AC / Refrigeration", "Electrical", "Plumbing", "Steering", "Stabilizers", "Fuel System", "Other"
  location     = default "Engine Room" unless the user said otherwise
  sub_location = e.g. "Port Locker", "STBD Locker", "Bin #1", "Bin #2", "Bin #3", "Bin #1 - STBD Gen", "Workbench", "Other"
  qty          = integer count (default 1)
  notes        = any extra info from the user, else ""

For Consumables, fields:
  type         = "Consumable"
  item         = item name (e.g. "Dish soap")
  category     = one of: "Galley", "Cleaning", "Toiletries", "Lines & Fenders", "Safety", "Deck Supplies", "Tools", "Spare Parts", "Office", "Other"
  location     = "Interior", "Exterior", "Engine Room", "Bridge", "Lazarette", or "Other"
  sub_location = e.g. "Salon", "Galley", "Crew Mess", "Master Stateroom", "Guest Cabin", "Anchor Locker", "Fly Storage", "Bridge Deck Locker", "Aft Deck Locker - Port", "Aft Deck Locker - STBD", "Lazarette", "Engine Room", "Other"
  qty          = integer count (default 1)
  unit         = unit of measure ("ea", "bottle", "roll", "L", "kg", "box"). Default "ea".
  notes        = any extra info, else ""

For Supplies, fields:
  type         = "Supply"
  item         = item name (e.g. "3/4 inch dock line", "5200 sealant")
  category     = one of: "Deck Supplies", "Lines & Fenders", "Cleaning", "Safety", "Paint & Coatings", "Hardware", "Fasteners", "Lubricants", "Electrical", "Plumbing", "Galley", "Office", "Other"
  brand        = brand if known, else ""
  location     = "Engine Room", "Lazarette", "Bridge", "Interior", "Exterior", or "Other"
  sub_location = e.g. "Port Locker", "STBD Locker", "Forward Bin", "Aft Bin", "Aft Deck Locker - Port", "Aft Deck Locker - STBD", "Anchor Locker", "Bridge Deck Locker", "Fly Storage", "Workbench", "Garage", "Other"
  qty          = integer count (default 1)
  unit         = unit of measure ("ea", "bottle", "m", "ft", "box", "roll"). Default "ea".
  notes        = any extra info, else ""

For Tools, fields:
  type           = "Tool"
  name           = tool name (e.g. "3/8 inch Drive Socket Set", "Fluke 117 Multimeter")
  category       = one of: "Hand Tool", "Power Tool", "Mechanical", "Electrical", "Plumbing", "Diagnostic", "Safety", "Measurement", "Diving / Snorkeling", "Other"
  brand          = brand if visible/known, else ""
  model_serial   = model number or serial if visible, else ""
  location       = default "Engine Room" unless the user said otherwise
  sub_location   = e.g. "Workbench", "Toolbox", "Tool Cabinet", "Port Locker", "STBD Locker", "Forward Bin", "Aft Bin", "Crew Mess", "Garage", "Other"
  condition      = "New", "Good", "Fair", "Needs Service", or "Broken". Default "Good".
  qty            = integer count (default 1, although tools are usually unique units — use higher qty only when several identical units exist)
  notes          = any extra info, else ""

Combine identical units (same part_number / same item+sub_location / same tool name+brand) into a single entry with qty=N.

Also produce a short one-sentence "summary" describing what you detected.

Return ONLY valid JSON in this exact shape (no prose, no markdown):
{
  "summary": "Detected 3 spares, 5 consumables, 4 supplies, and 2 tools.",
  "items": [
    { "type": "Spare", "part_number": "1R-1808", "description": "Fuel filter element", "manufacturer": "CAT", "system": "Main Engines", "location": "Engine Room", "sub_location": "Bin #1", "qty": 3, "notes": "" },
    { "type": "Consumable", "item": "Dish soap", "category": "Galley", "location": "Interior", "sub_location": "Galley", "qty": 12, "unit": "bottle", "notes": "" },
    { "type": "Supply", "item": "3/4 inch dock line", "category": "Lines & Fenders", "brand": "New England Ropes", "location": "Exterior", "sub_location": "Aft Deck Locker - STBD", "qty": 4, "unit": "ea", "notes": "" },
    { "type": "Tool", "name": "Fluke 117 Multimeter", "category": "Diagnostic", "brand": "Fluke", "model_serial": "117", "location": "Engine Room", "sub_location": "Workbench", "condition": "Good", "qty": 1, "notes": "" }
  ]
}`

function detectMediaTypeExtract(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  try {
    const head = atob(b64.slice(0, 32))
    const bytes = new Uint8Array(head.length)
    for (let i = 0; i < head.length; i++) bytes[i] = head.charCodeAt(i)
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return 'image/webp'
  } catch {}
  return 'image/jpeg'
}

async function extractHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server' })
  }

  const { text, imagesBase64 } = (req.body || {}) as { text?: string; imagesBase64?: string[] }

  if ((!text || !text.trim()) && (!imagesBase64 || imagesBase64.length === 0)) {
    return res.status(400).json({ error: 'Provide text, photos, or both.' })
  }

  try {
    const imageContent: Anthropic.ImageBlockParam[] = (imagesBase64 || []).slice(0, 12).map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: detectMediaTypeExtract(img),
        data: img,
      },
    }))

    const userContent: any[] = [...imageContent]
    if (text && text.trim()) {
      userContent.push({ type: 'text', text: `USER TEXT:\n${text.trim()}\n\n${EXTRACT_PROMPT}` })
    } else {
      userContent.push({ type: 'text', text: EXTRACT_PROMPT })
    }

    const message = await extractClient.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 6000,
      messages: [{ role: 'user', content: userContent }],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    let data: Record<string, unknown> = {}
    try {
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      return res.status(502).json({ error: 'AI returned non-JSON response', raw: responseText.slice(0, 800) })
    }

    return res.status(200).json(data)
  } catch (error: any) {
    console.error('inventory-bulk-extract error:', error)
    const status = error?.status || 500
    const detail =
      error?.error?.error?.message ||
      error?.error?.message ||
      error?.message ||
      String(error)
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'Extraction failed',
      detail,
    })
  }
}

// ============================================================
// REVISE
// ============================================================
const reviseClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const REVISE_PROMPT = `You are helping the user clean up a list of inventory items they're about to save to the Rise Above (Sanlorenzo SD118) inventory.

You will be given:
  1. The CURRENT list of draft items (as JSON).
  2. A natural-language INSTRUCTION from the user describing changes to apply across the list (e.g. "all of these are spares for the main engines", "change all sub-locations to STBD locker", "set qty to 2 for every item", "remove the duplicates", "everything is from CAT", "the multimeter is a tool not a consumable").

Apply the instruction to the list and return the FULL revised list. You may:
  - modify any field on any item
  - change an item's type between "Spare", "Consumable", "Supply", and "Tool"
  - delete items (omit them from the output)
  - add items (only if explicitly requested)
  - merge duplicates

Location is TWO fields:
  location     = broad area: "Engine Room", "Lazarette", "Bridge", "Interior", "Exterior", "Other"
  sub_location = specific place inside that area (string). If the user explicitly asks for a NEW location/sub-location name (e.g. "create a new sub-location called Bin#1-STBD Gen" or "label them as Bin#1-STBD Gen"), use the exact name they gave — do NOT force it back to a preset list.

Spare fields:
  type         = "Spare"
  part_number  = string (manufacturer part number, optional)
  description  = short description
  manufacturer = brand (e.g. CAT, Racor, Jabsco)
  system       = one of: "Main Engines", "Generators", "Watermaker", "Hydraulics", "AC / Refrigeration", "Electrical", "Plumbing", "Steering", "Stabilizers", "Fuel System", "Other"
  location     = default "Engine Room"
  sub_location = e.g. "Port Locker", "STBD Locker", "Bin #1", "Bin #2", "Bin #3", "Bin #1 - STBD Gen", "Workbench", "Other"
  qty          = integer (default 1)
  notes        = string

Consumable fields:
  type         = "Consumable"
  item         = item name
  category     = one of: "Galley", "Cleaning", "Toiletries", "Lines & Fenders", "Safety", "Deck Supplies", "Office", "Other"
  location     = "Interior", "Exterior", "Engine Room", "Bridge", "Lazarette", or "Other"
  sub_location = e.g. "Salon", "Galley", "Crew Mess", "Master Stateroom", "Guest Cabin", "Anchor Locker", "Fly Storage", "Bridge Deck Locker", "Aft Deck Locker - Port", "Aft Deck Locker - STBD", "Lazarette", "Engine Room", "Other"
  qty          = integer (default 1)
  unit         = "ea", "bottle", "roll", "L", "kg", "box" (default "ea")
  notes        = string

Supply fields:
  type         = "Supply"
  item         = item name
  category     = one of: "Deck Supplies", "Lines & Fenders", "Cleaning", "Safety", "Paint & Coatings", "Hardware", "Fasteners", "Lubricants", "Electrical", "Plumbing", "Galley", "Office", "Other"
  brand        = brand if known, else ""
  location     = "Engine Room", "Lazarette", "Bridge", "Interior", "Exterior", or "Other"
  sub_location = string
  qty          = integer
  unit         = unit of measure (default "ea")
  notes        = string
  photo_url    = PRESERVE VERBATIM — do not modify or remove

Tool fields:
  type         = "Tool"
  name         = tool name (e.g. "3/8 inch Drive Socket Set", "Fluke 117 Multimeter")
  category     = one of: "Hand Tool", "Power Tool", "Mechanical", "Electrical", "Plumbing", "Diagnostic", "Safety", "Measurement", "Diving / Snorkeling", "Other"
  brand        = brand if known, else ""
  model_serial = model number or serial if known, else ""
  location     = default "Engine Room"
  sub_location = e.g. "Workbench", "Toolbox", "Tool Cabinet", "Port Locker", "STBD Locker", "Forward Bin", "Aft Bin", "Garage", "Other"
  condition    = "New", "Good", "Fair", "Needs Service", or "Broken". Default "Good".
  qty          = integer (default 1)
  notes        = string

Also write a short one-sentence "summary" describing what you changed.

Return ONLY valid JSON in this exact shape (no prose, no markdown):
{
  "summary": "Set system to Main Engines on all 5 spares.",
  "items": [
    { "type": "Spare", "part_number": "1R-1808", "description": "Fuel filter element", "manufacturer": "CAT", "system": "Main Engines", "location": "Engine Room", "sub_location": "Bin #1", "qty": 3, "notes": "", "photo_url": "" },
    { "type": "Tool", "name": "Fluke 117 Multimeter", "category": "Diagnostic", "brand": "Fluke", "model_serial": "117", "location": "Engine Room", "sub_location": "Workbench", "condition": "Good", "qty": 1, "notes": "", "photo_url": "" }
  ]
}

IMPORTANT: If any input item has a "photo_url" field, ALWAYS preserve that exact value on the corresponding output item. The photo_url ties a row to its photo and must not be dropped, modified, or moved to another item, even when the user asks for changes to other fields.`

async function reviseHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server' })
  }

  const { instruction, items } = (req.body || {}) as {
    instruction?: string
    items?: any[]
  }

  if (!instruction || !instruction.trim()) {
    return res.status(400).json({ error: 'Provide an instruction.' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items to revise.' })
  }

  try {
    const userText =
      `CURRENT LIST (${items.length} items):\n` +
      JSON.stringify(items, null, 2) +
      `\n\nUSER INSTRUCTION:\n${instruction.trim()}\n\n` +
      REVISE_PROMPT

    const message = await reviseClient.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 6000,
      messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    let data: Record<string, unknown> = {}
    try {
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      return res.status(502).json({ error: 'AI returned non-JSON response', raw: responseText.slice(0, 800) })
    }

    if (!Array.isArray((data as any).items)) {
      return res.status(502).json({ error: 'AI response missing items array', raw: responseText.slice(0, 800) })
    }

    return res.status(200).json(data)
  } catch (error: any) {
    console.error('inventory-bulk-revise error:', error)
    const status = error?.status || 500
    const detail =
      error?.error?.error?.message ||
      error?.error?.message ||
      error?.message ||
      String(error)
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'Revision failed',
      detail,
    })
  }
}

// ============================================================
// SAVE
// ============================================================
function cleanEnvBulk(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const INVENTORY_ID_BULK = cleanEnvBulk(process.env.INVENTORY_SPREADSHEET_ID)

function getAuthBulk() {
  const keyJson = cleanEnvBulk(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
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

function newIdBulk() {
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

async function saveHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!INVENTORY_ID_BULK) {
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
    const auth = getAuthBulk()
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
          if (!merged.ID) merged.ID = newIdBulk()
          if (!merged.Location) merged.Location = 'Engine Room'
          merged['Created At'] = now
          merged['Created By'] = userName
          return SPARE_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID_BULK,
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
          if (!merged.ID) merged.ID = newIdBulk()
          if (!merged.Location) merged.Location = locationForConsumable(merged['Sub-Location'] || '')
          if (!merged.Unit) merged.Unit = 'ea'
          merged['Created At'] = now
          merged['Created By'] = userName
          return CONSUMABLE_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID_BULK,
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
          if (!merged.ID) merged.ID = newIdBulk()
          if (!merged.Location) merged.Location = 'Engine Room'
          if (!merged.Condition) merged.Condition = 'Good'
          merged['Created At'] = now
          merged['Created By'] = userName
          return TOOL_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID_BULK,
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
          if (!merged.ID) merged.ID = newIdBulk()
          if (!merged.Location) merged.Location = 'Exterior'
          if (!merged.Unit) merged.Unit = 'ea'
          merged['Created At'] = now
          merged['Created By'] = userName
          return SUPPLY_HEADERS.map(h => (merged[h] !== undefined && merged[h] !== null ? String(merged[h]) : ''))
        })
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID_BULK,
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

// ============================================================
// ROUTER
// ============================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '').trim()
  try {
    if (action === 'extract') return extractHandler(req, res)
    if (action === 'revise') return reviseHandler(req, res)
    if (action === 'save') return saveHandler(req, res)
    return res.status(400).json({ error: 'Invalid action', detail: 'action must be extract|revise|save' })
  } catch (error: any) {
    console.error('inventory-bulk router error:', error)
    return res.status(500).json({ error: 'Bulk request failed', detail: error?.message || String(error) })
  }
}
