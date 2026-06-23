import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
  maxDuration: 60,
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SPARES_PROMPT = `You are cataloging mechanical spare parts onboard the M/Y Rise Above (Sanlorenzo SD118). The photos show packaging, labels, boxes, or bins of marine spare parts (filters, gaskets, impellers, belts, sensors, pumps, etc.).

For EACH distinct part visible across the photos, extract:
  part_number    — the manufacturer part number printed on the label/box (string). Required.
  description    — short human description (e.g. "Fuel filter element", "Raw water impeller").
  manufacturer   — brand if visible (CAT, Racor, Jabsco, etc.). Null if unknown.
  system         — one of: "Main Engines", "Generators", "Watermaker", "Hydraulics", "AC / Refrigeration", "Electrical", "Plumbing", "Steering", "Stabilizers", "Fuel System", "Other". Guess based on context.
  qty            — count of identical units visible in the photo (integer). Default 1.

If multiple copies of the same part are visible, return ONE entry with qty=N (not N entries).
If you can't read a part number clearly, still include the item with part_number set to your best guess and add notes describing uncertainty.

Return ONLY valid JSON in this shape:
{ "items": [ { "part_number": "...", "description": "...", "manufacturer": "...", "system": "...", "qty": 1 } ] }`

const CONSUMABLES_PROMPT = `You are cataloging consumable supplies onboard the M/Y Rise Above (Sanlorenzo SD118). The photos show items on shelves, in lockers, or in pantries — cleaning supplies, galley provisions, toiletries, lines/fenders, safety gear, deck supplies, etc.

For EACH distinct item visible across the photos, extract:
  item        — name of the item (e.g. "Dish soap", "Bleach", "Mooring line 30m").
  category    — one of: "Galley", "Cleaning", "Toiletries", "Lines & Fenders", "Safety", "Deck Supplies", "Tools", "Spare Parts", "Office", "Other".
  qty         — count of units visible (integer).
  unit        — unit of measure if relevant ("bottle", "roll", "box", "L", "kg", "ea"). Default "ea".

Combine identical items into a single entry with qty=N.

Return ONLY valid JSON in this shape:
{ "items": [ { "item": "...", "category": "...", "qty": 1, "unit": "ea" } ] }`

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

  const { tab, imagesBase64 } = (req.body || {}) as { tab?: string; imagesBase64?: string[] }
  if (tab !== 'Spares' && tab !== 'Consumables') {
    return res.status(400).json({ error: 'tab must be "Spares" or "Consumables"' })
  }
  if (!imagesBase64 || imagesBase64.length === 0) {
    return res.status(400).json({ error: 'No images provided' })
  }

  const prompt = tab === 'Spares' ? SPARES_PROMPT : CONSUMABLES_PROMPT

  try {
    const imageContent: Anthropic.ImageBlockParam[] = imagesBase64.slice(0, 8).map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: detectMediaType(img),
        data: img,
      },
    }))

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [...imageContent, { type: 'text', text: prompt }],
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let data: Record<string, unknown> = {}
    try {
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      return res.status(502).json({ error: 'AI returned non-JSON response', raw: text.slice(0, 500) })
    }
    return res.status(200).json(data)
  } catch (error: any) {
    console.error('inventory-extract error:', error)
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