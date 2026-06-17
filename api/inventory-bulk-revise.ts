import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
  maxDuration: 60,
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const PROMPT = `You are helping the user clean up a list of inventory items they're about to save to the Rise Above (Sanlorenzo SD118) inventory.

You will be given:
  1. The CURRENT list of draft items (as JSON).
  2. A natural-language INSTRUCTION from the user describing changes to apply across the list (e.g. "all of these are spares for the main engines", "change all sub-locations to STBD locker", "set qty to 2 for every item", "remove the duplicates", "everything is from CAT", "all these are Racor filters").

Apply the instruction to the list and return the FULL revised list. You may:
  - modify any field on any item
  - change an item's type between "Spare" and "Consumable"
  - delete items (omit them from the output)
  - add items (only if explicitly requested)
  - merge duplicates

Allowed values:

Spare fields:
  type         = "Spare"
  part_number  = string (manufacturer part number)
  description  = short description
  manufacturer = brand (e.g. CAT, Racor, Jabsco)
  system       = one of: "Main Engines", "Generators", "Watermaker", "Hydraulics", "AC / Refrigeration", "Electrical", "Plumbing", "Steering", "Stabilizers", "Fuel System", "Other"
  sub_location = string. Prefer one of the existing values: "Engine Room - Port Locker", "Engine Room - STBD Locker", "Engine Room - Forward Bin", "Engine Room - Aft Bin", "Engine Room - Gen Toolbox", "Engine Room - Workbench", "Other". If the user explicitly asks for a NEW sub-location name (e.g. "create a new sub-location called Bin#1-STBD Gen" or "label them as Bin#1-STBD Gen"), use the exact name they gave — do NOT force it back to the list.
  qty          = integer (default 1)
  notes        = string

Consumable fields:
  type         = "Consumable"
  item         = item name
  category     = one of: "Galley", "Cleaning", "Toiletries", "Lines & Fenders", "Safety", "Deck Supplies", "Tools", "Spare Parts", "Office", "Other"
  sub_location = string. Prefer one of: "Anchor Locker", "Fly Storage", "Bridge Deck Locker", "Aft Deck Locker - Port", "Aft Deck Locker - STBD", "Galley", "Engine Room", "Crew Mess", "Lazarette", "Master Stateroom", "Guest Cabin", "Salon", "Other". If the user explicitly asks for a NEW sub-location name, use the exact name they gave.
  qty          = integer (default 1)
  unit         = "ea", "bottle", "roll", "L", "kg", "box" (default "ea")
  notes        = string

Also write a short one-sentence "summary" describing what you changed.

Return ONLY valid JSON in this exact shape (no prose, no markdown):
{
  "summary": "Set system to Main Engines on all 5 spares.",
  "items": [
    { "type": "Spare", "part_number": "1R-1808", "description": "Fuel filter element", "manufacturer": "CAT", "system": "Main Engines", "sub_location": "Engine Room - Port Locker", "qty": 3, "notes": "" }
  ]
}`

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      PROMPT

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
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