// Send one or more receipt images to OpenAI GPT-4o Vision and extract merchant,
// date, EUR amount, USD amount, plus a coarse category hint.
//
// Falls back to Anthropic Claude Vision if OPENAI_API_KEY is unset (kept as a
// safety net so intake keeps working even if the OpenAI env var is missing).
// TODO: remove the Anthropic fallback once OPENAI_API_KEY is confirmed set in Vercel.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

const EXTRACTION_PROMPT = `You are an OCR service reading a photo of a paper or digital receipt for a private yacht (M/Y Rise Above).

You MUST respond with a single JSON object matching the schema below. Do NOT include any prose, apologies, refusals, explanations, or code fences. First character MUST be '{' and last MUST be '}'.

Schema (per receipt image; return one object per image in the "receipts" array, IN THE SAME ORDER as the images were provided):
{
  "receipts": [
    {
      "merchant": string | null,       // Store / vendor name as printed
      "date": string | null,           // YYYY-MM-DD if a date is visible; null otherwise
      "eur": number | null,            // Total amount charged in EUR, if the receipt is priced in euros. Numeric only.
      "usd": number | null,            // Total amount charged in USD, if the receipt is priced in dollars. Numeric only.
      "currency_hint": "EUR" | "USD" | "OTHER" | null,
      "category_hint": "grocery" | "fuel" | "restaurant" | "hardware" | "pharmacy" | "other" | null,
      "notes": string | null           // 1-line summary; keep short
    }
  ]
}

Rules:
- Read the GRAND TOTAL only (not subtotals, not individual line items).
- If a receipt shows only euros, put the number in "eur" and leave "usd" null. If only dollars, vice versa. If both are printed (rare — some card slips show both), fill both.
- "grocery" applies to supermarkets, corner stores, alimentari, mercati, etc. Anything a stew would buy provisions from.
- "fuel" for gas stations / marina fuel docks.
- "restaurant" for restaurants, cafes, bars where you sit down.
- "hardware" for chandleries, tool stores, hardware stores.
- "pharmacy" for pharmacies / drugstores.
- Anything else → "other".
- If the image is unreadable, return every field null but STILL include the object.`

const SYSTEM_MSG = 'You are a strict JSON extractor for yacht crew expense receipts. ALWAYS respond with a single JSON object matching the requested schema and NOTHING else. First character MUST be `{`, last MUST be `}`. Use null for unreadable fields.'

type ImageIn = { base64: string; mime?: string }

async function readViaOpenAI(images: ImageIn[]): Promise<{ ok: true; receipts: any[] } | { ok: false; error: string; reply?: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY not set' }
  const model = process.env.OPENAI_MODEL || 'gpt-4o'
  const content: any[] = [{ type: 'text', text: EXTRACTION_PROMPT }]
  for (const im of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${im.mime || 'image/jpeg'};base64,${im.base64}` },
    })
  }
  const body = {
    model,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_MSG },
      { role: 'user', content },
    ],
  }
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text()
    return { ok: false, error: `OpenAI HTTP ${resp.status}: ${text.slice(0, 400)}` }
  }
  const data: any = await resp.json()
  const text: string = data?.choices?.[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { ok: false, error: 'OpenAI returned no JSON', reply: text.slice(0, 2000) }
  try {
    const parsed = JSON.parse(jsonMatch[0])
    const receipts = Array.isArray(parsed?.receipts) ? parsed.receipts : []
    return { ok: true, receipts }
  } catch {
    return { ok: false, error: 'OpenAI JSON parse failed', reply: text.slice(0, 2000) }
  }
}

async function readViaAnthropic(images: ImageIn[]): Promise<{ ok: true; receipts: any[] } | { ok: false; error: string; reply?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not set' }
  const client = new Anthropic({ apiKey })
  const imageContent = images.map((im) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: (im.mime || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: im.base64,
    },
  }))
  const modelCandidates = [
    process.env.ANTHROPIC_MODEL,
    'claude-sonnet-4-6',
    'claude-sonnet-5',
  ].filter((m): m is string => !!m)
  let message: Anthropic.Message | null = null
  let lastErr: any = null
  for (const model of modelCandidates) {
    try {
      message = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_MSG,
        messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: EXTRACTION_PROMPT }] }],
      })
      break
    } catch (err: any) {
      lastErr = err
      const status = err?.status
      const isModelMiss = status === 404 || (err?.message || '').toLowerCase().includes('not found')
      if (!isModelMiss) throw err
    }
  }
  if (!message) return { ok: false, error: lastErr?.message || 'No usable Anthropic model available' }
  const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { ok: false, error: 'Claude returned no JSON', reply: text.slice(0, 2000) }
  try {
    const parsed = JSON.parse(jsonMatch[0])
    const receipts = Array.isArray(parsed?.receipts) ? parsed.receipts : []
    return { ok: true, receipts }
  } catch {
    return { ok: false, error: 'Anthropic JSON parse failed', reply: text.slice(0, 2000) }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { images: ImageIn[] }
  if (!body?.images?.length) return res.status(400).json({ error: 'images[] required' })
  if (body.images.length > 10) return res.status(400).json({ error: 'Max 10 images per call' })

  try {
    const useOpenAI = !!process.env.OPENAI_API_KEY
    const primary = useOpenAI ? await readViaOpenAI(body.images) : await readViaAnthropic(body.images)
    if (primary.ok) return res.status(200).json({ ok: true, receipts: primary.receipts, provider: useOpenAI ? 'openai' : 'anthropic' })

    // If OpenAI was the primary and failed, fall back to Anthropic if we have a key.
    if (useOpenAI && process.env.ANTHROPIC_API_KEY) {
      const fb = await readViaAnthropic(body.images)
      if (fb.ok) return res.status(200).json({ ok: true, receipts: fb.receipts, provider: 'anthropic-fallback', primary_error: primary.error })
      return res.status(200).json({ ok: false, error: fb.error, primary_error: primary.error, reply: fb.reply })
    }
    return res.status(200).json({ ok: false, error: primary.error, reply: primary.reply })
  } catch (err: any) {
    console.error('expense-read-receipts error:', err)
    return res.status(500).json({ error: 'Failed to read receipts', detail: err?.message || String(err) })
  }
}
