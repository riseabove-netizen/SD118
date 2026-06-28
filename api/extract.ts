import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  maxDuration: 60,
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const EXTRACTION_PROMPT = `You are an expert marine engineer reading Caterpillar engine display screens for the M/Y Rise Above (Sanlorenzo SD118).

For each engine (Port and Starboard), extract the following readings from the engine display photos. Use null for any value not visible. Numeric values only — no units.

Fields per engine (prefix with port_ or stbd_):
  engine_hours, rpm, fuel_rate, coolant_temp, trans_oil_temp, oil_temp,
  trans_oil_press, fuel_temp, fuel_pressure, engine_load, coolant_level,
  battery_voltage, exhaust_temp_l, exhaust_temp_r, inlet_manifold_temp

Also extract from the navigation / chartplotter screen if visible:
  date         — date shown on the display, formatted as YYYY-MM-DD
  time         — time shown on the display, formatted as HH:MM (24-hour)
  latitude     — decimal degrees, negative for South (convert from DMS if shown that way)
  longitude    — decimal degrees, negative for West (convert from DMS if shown that way)
  cog          — course over ground in degrees
  sog          — speed over ground in knots

Also extract fuel TANK level readings from any tank monitor / Naviop / SeaTouch / tank-gauge screen if visible.
These are TANK LEVELS in litres, NOT engine fuel rate. Look for labels like "Daily",
"Daily Tank", "Service", "Aft", "Aft Main", "FWD", "Forward", "Forward Main" on a tank/gauge page:
  fuel_daily   — Daily / Service tank level in litres
  fuel_aft     — Aft Main tank level in litres
  fuel_fwd     — Forward (FWD) Main tank level in litres
Return just the number (no "L" suffix). Use null if no tank screen is visible.

Return a JSON object in this exact shape (all fields included, null when missing):

{
  "date_time": { "date": null, "time": null },
  "navigation": { "latitude": null, "longitude": null, "cog": null, "sog": null },
  "fuel_tanks": { "fuel_daily": null, "fuel_aft": null, "fuel_fwd": null },
  "port_engine": {
    "port_engine_hours": null, "port_rpm": null, "port_fuel_rate": null,
    "port_coolant_temp": null, "port_trans_oil_temp": null, "port_oil_temp": null,
    "port_trans_oil_press": null, "port_fuel_temp": null, "port_fuel_pressure": null,
    "port_engine_load": null, "port_coolant_level": null, "port_battery_voltage": null,
    "port_exhaust_temp_l": null, "port_exhaust_temp_r": null, "port_inlet_manifold_temp": null
  },
  "stbd_engine": {
    "stbd_engine_hours": null, "stbd_rpm": null, "stbd_fuel_rate": null,
    "stbd_coolant_temp": null, "stbd_trans_oil_temp": null, "stbd_oil_temp": null,
    "stbd_trans_oil_press": null, "stbd_fuel_temp": null, "stbd_fuel_pressure": null,
    "stbd_engine_load": null, "stbd_coolant_level": null, "stbd_battery_voltage": null,
    "stbd_exhaust_temp_l": null, "stbd_exhaust_temp_r": null, "stbd_inlet_manifold_temp": null
  }
}

Return ONLY valid JSON, no other text.`

function detectMediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  // Decode first few bytes to sniff magic numbers
  // JPEG: FFD8FF, PNG: 89504E47, GIF: 47494638, WEBP: starts with RIFF...WEBP
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
  } catch {
    // fall through
  }
  return 'image/jpeg'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server' })
  }

  const { images } = req.body as { images?: string[] }

  if (!images || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' })
  }

  try {
    // Process all uploaded images (Claude supports up to 20 per request).
    // Photos are pre-compressed client-side (compressImageToJpegBase64) so
    // the combined payload stays under Vercel's body-size limit.
    const imageContent: Anthropic.ImageBlockParam[] = images.slice(0, 20).map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: detectMediaType(img),
        data: img,
      },
    }))

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let data: Record<string, unknown> = {}
    try {
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch (e) {
      console.error('JSON parse failed. Raw text:', text)
      return res.status(502).json({ error: 'AI returned non-JSON response', raw: text.slice(0, 500) })
    }

    // Attach a small debug echo so the client (and you) can confirm how
    // many photos were actually sent to the model in this request.
    ;(data as Record<string, unknown>)._meta = {
      images_received: images.length,
      images_processed: imageContent.length,
    }
    return res.status(200).json(data)
  } catch (error: any) {
    console.error('Extract error:', error)
    // Surface Anthropic API error details to the client for easier debugging
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