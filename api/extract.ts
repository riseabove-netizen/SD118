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
  latitude     — STRING in degrees + decimal-minutes format with hemisphere letter, e.g. "39°27.479'N" or "40°12.227'N".
                 Format: DD°MM.MMM'H where H is N or S. Pad degrees to 2 digits.
                 If the display shows decimal degrees instead (e.g. 39.477768), convert to DM:
                   sign → N/S (positive = N, negative = S)
                   degrees = integer part of absolute value
                   minutes = (absolute value − degrees) × 60, keep 3 decimal places
                 If the display shows D°M'S" (degrees/minutes/seconds), convert seconds to decimal minutes: minutes_decimal = M + S/60.
  longitude    — STRING in degrees + decimal-minutes format with hemisphere letter, e.g. "002°32.569'E" or "003°24.540'W".
                 Format: DDD°MM.MMM'H where H is E or W. Pad degrees to 3 digits.
                 Same conversion rules as latitude (positive = E, negative = W).
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

// Convert a coordinate value to DM format "DD°MM.MMM'H" (lat) or "DDD°MM.MMM'H" (lon).
// Accepts:
//   - already-DM strings ("39°27.479'N") → pass through (re-formatted to canonical padding)
//   - decimal numbers or numeric strings (39.477768 or "-2.6502") → convert
//   - D°M'S" strings (39°27'28.7"N) → convert seconds to decimal minutes
//   - null / empty → return as-is
function normalizeCoord(value: unknown, kind: 'lat' | 'lon'): unknown {
  if (value === null || value === undefined || value === '') return value
  const str = String(value).trim()
  if (!str) return value

  const posHem = kind === 'lat' ? 'N' : 'E'
  const negHem = kind === 'lat' ? 'S' : 'W'
  const degPad = kind === 'lat' ? 2 : 3

  // Parse degrees + decimal minutes + optional hemisphere: "39°27.479'N" or "39 27.479 N"
  const dmMatch = str.match(/^\s*(-?)(\d{1,3})[°\s:]+(\d{1,2}(?:\.\d+)?)['′\s]*([NSEWnsew])?\s*$/)
  if (dmMatch) {
    const sign = dmMatch[1] === '-' ? -1 : 1
    const deg = parseInt(dmMatch[2], 10)
    const min = parseFloat(dmMatch[3])
    let hem = (dmMatch[4] || '').toUpperCase()
    if (!hem) hem = sign < 0 ? negHem : posHem
    return formatDM(deg, min, hem, degPad)
  }

  // Parse degrees, minutes, seconds: "39°27'28.7\"N"
  const dmsMatch = str.match(/^\s*(-?)(\d{1,3})[°\s:]+(\d{1,2})['′\s:]+(\d{1,2}(?:\.\d+)?)["″\s]*([NSEWnsew])?\s*$/)
  if (dmsMatch) {
    const sign = dmsMatch[1] === '-' ? -1 : 1
    const deg = parseInt(dmsMatch[2], 10)
    const min = parseInt(dmsMatch[3], 10) + parseFloat(dmsMatch[4]) / 60
    let hem = (dmsMatch[5] || '').toUpperCase()
    if (!hem) hem = sign < 0 ? negHem : posHem
    return formatDM(deg, min, hem, degPad)
  }

  // Parse decimal-degree number ("-2.6502" or 39.477768)
  const decMatch = str.match(/^\s*(-?\d+(?:\.\d+)?)\s*([NSEWnsew])?\s*$/)
  if (decMatch) {
    const num = parseFloat(decMatch[1])
    let hem = (decMatch[2] || '').toUpperCase()
    if (!hem) hem = num < 0 ? negHem : posHem
    const abs = Math.abs(num)
    const deg = Math.floor(abs)
    const min = (abs - deg) * 60
    return formatDM(deg, min, hem, degPad)
  }

  // Unrecognised format — return original string
  return str
}

function formatDM(deg: number, min: number, hem: string, degPad: number): string {
  const degStr = String(deg).padStart(degPad, '0')
  const minStr = min.toFixed(3).padStart(6, '0') // "05.430" or "27.479"
  return `${degStr}°${minStr}'${hem}`
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

    // Model selection: prefer the env override, then the current recommended
    // Sonnet model, with a fallback to the previous 4.6 generation in case
    // the account hasn't been upgraded yet. If Anthropic returns a
    // model-not-found error we retry with the next candidate.
    const modelCandidates = [
      process.env.ANTHROPIC_MODEL,
      'claude-sonnet-5',
      'claude-sonnet-4-6',
    ].filter((m): m is string => !!m)

    let message: Anthropic.Message | null = null
    let lastErr: any = null
    for (const model of modelCandidates) {
      try {
        message = await client.messages.create({
          model,
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
        break
      } catch (err: any) {
        lastErr = err
        // Retry only on model-not-found / 404 errors; surface everything else.
        const status = err?.status
        const type = err?.error?.error?.type || err?.error?.type
        const msg  = (err?.error?.error?.message || err?.message || '').toLowerCase()
        const isModelMiss =
          status === 404 ||
          type === 'not_found_error' ||
          msg.includes('model') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('invalid'))
        if (!isModelMiss) throw err
        // Otherwise continue to the next candidate.
      }
    }
    if (!message) {
      throw lastErr || new Error('No usable Anthropic model available')
    }

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let data: Record<string, unknown> = {}
    try {
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch (e) {
      console.error('JSON parse failed. Raw text:', text)
      return res.status(502).json({ error: 'AI returned non-JSON response', raw: text.slice(0, 500) })
    }

    // Safety net: convert any decimal-degree coordinates the model returned
    // into the DM format the sheet expects: DD°MM.MMM'H / DDD°MM.MMM'H.
    // Existing DM strings pass through untouched.
    const nav = (data as any)?.navigation
    if (nav && typeof nav === 'object') {
      nav.latitude = normalizeCoord(nav.latitude, 'lat')
      nav.longitude = normalizeCoord(nav.longitude, 'lon')
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