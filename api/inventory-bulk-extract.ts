import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = {
  api: { bodyParser: { sizeLimit: '40mb' } },
  maxDuration: 60,
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const PROMPT = `You are cataloging items onboard the M/Y Rise Above (Sanlorenzo SD118, yacht). The user is dictating and/or attaching photos to add MULTIPLE inventory items at once.

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

function detectMediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        media_type: detectMediaType(img),
        data: img,
      },
    }))

    const userContent: any[] = [...imageContent]
    if (text && text.trim()) {
      userContent.push({ type: 'text', text: `USER TEXT:\n${text.trim()}\n\n${PROMPT}` })
    } else {
      userContent.push({ type: 'text', text: PROMPT })
    }

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
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
