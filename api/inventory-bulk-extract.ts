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

Classify each item as one of two categories:

  "Spare"       \u2014 a mechanical replacement part identified by a manufacturer part number
                  (filters, gaskets, impellers, belts, sensors, pumps, hoses, fuses, etc.).
                  Typically stored in the engine room.
  "Consumable"  \u2014 supplies that get used and restocked: galley provisions, cleaning chemicals,
                  toiletries, lines, fenders, safety gear, deck supplies, office supplies, etc.

If the user explicitly says "spare" or "consumable", honor that. If part number is mentioned, prefer Spare. If category is ambiguous, make your best guess.

For EACH distinct item across the text and images, output a record with the relevant fields below.

For Spares, fields:
  type        = "Spare"
  part_number = manufacturer part number (string). If not stated, null.
  description = short description
  manufacturer = brand if known, else ""
  system      = one of: "Main Engines", "Generators", "Watermaker", "Hydraulics", "AC / Refrigeration", "Electrical", "Plumbing", "Steering", "Stabilizers", "Fuel System", "Other"
  sub_location = one of: "Engine Room - Port Locker", "Engine Room - STBD Locker", "Engine Room - Forward Bin", "Engine Room - Aft Bin", "Engine Room - Gen Toolbox", "Engine Room - Workbench", "Other"  (best guess if not stated, default "Other")
  qty         = integer count (default 1)
  notes       = any extra info from the user, else ""

For Consumables, fields:
  type        = "Consumable"
  item        = item name (e.g. "Dish soap")
  category    = one of: "Galley", "Cleaning", "Toiletries", "Lines & Fenders", "Safety", "Deck Supplies", "Tools", "Spare Parts", "Office", "Other"
  sub_location = one of: "Anchor Locker", "Fly Storage", "Bridge Deck Locker", "Aft Deck Locker - Port", "Aft Deck Locker - STBD", "Galley", "Engine Room", "Crew Mess", "Lazarette", "Master Stateroom", "Guest Cabin", "Salon", "Other" (best guess if not stated)
  qty         = integer count (default 1)
  unit        = unit of measure ("ea", "bottle", "roll", "L", "kg", "box"). Default "ea".
  notes       = any extra info, else ""

Combine identical units (same part_number or same item+sub_location) into a single entry with qty=N.

Also produce a short one-sentence "summary" describing what you detected.

Return ONLY valid JSON in this exact shape (no prose, no markdown):
{
  "summary": "Detected 3 spares and 5 consumables across 2 locations.",
  "items": [
    { "type": "Spare", "part_number": "1R-1808", "description": "Fuel filter element", "manufacturer": "CAT", "system": "Main Engines", "sub_location": "Engine Room - Port Locker", "qty": 3, "notes": "" },
    { "type": "Consumable", "item": "Dish soap", "category": "Galley", "sub_location": "Galley", "qty": 12, "unit": "bottle", "notes": "" }
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

    const userContent: Anthropic.ContentBlockParam[] = [...imageContent]
    if (text && text.trim()) {
      userContent.push({ type: 'text', text: `User dictation:\n${text.trim()}\n\n${PROMPT}` })
    } else {
      userContent.push({ type: 'text', text: PROMPT })
    }

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4096,
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

    if (!Array.isArray((data as any).items)) {
      return res.status(502).json({ error: 'AI response missing items array', raw: responseText.slice(0, 800) })
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