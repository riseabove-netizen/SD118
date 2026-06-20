import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
  maxDuration: 60,
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `You are formatting an OPERATIONAL GUIDE for the crew of the motor yacht Rise Above (Sanlorenzo SD118).

You will receive:
  - title:    the guide title
  - category: optional category (e.g. "Engine Room", "Galley", "Safety")
  - draft:    raw step-by-step text from the crew member
  - photos:   array of { url, caption } already uploaded — preserve EVERY url exactly as given

Produce clean, scannable GitHub-flavored Markdown the rest of the crew can follow under stress. Rules:

STRUCTURE
- Begin with an "## Overview" section (1–3 sentences explaining the purpose).
- Group steps under H2 section headers like "## Preparation", "## Procedure", "## Verification", "## Shutdown" when the content clearly maps to phases. If it's a single sequence, skip section headers and go straight to numbered steps.
- Use a numbered list ("1.", "2.", ...) for sequential steps; each step starts with an imperative verb ("Open the …", "Confirm that …").
- Use sub-bullets ("   - …") for clarifications inside a step.
- End with a "## Notes" section ONLY if the draft contains caveats not tied to a specific step.

FORMATTING
- **Bold** critical actions and key terms (valves, switches, breaker names, part numbers, system names).
- ALL-CAPS only inside bold for hard safety words: **SHUT OFF**, **CLOSE**, **DO NOT**, **WARNING**.
- Use \`inline code\` for exact UI labels, button text, model numbers, or display readouts.
- Convert any temperature, pressure, rpm, voltage values to clean units ("90 °C", "2 200 rpm", "24 V DC").

SAFETY CALLOUTS
- Detect hazard language ("hot", "pressurized", "live", "before starting", "ensure", "never", "warning", "caution") and wrap that line in a blockquote starting with a level marker:
  - "> ⚠️ **WARNING:** …" for risk of injury / damage
  - "> 🛑 **STOP:** …" for must-not-proceed conditions
  - "> ℹ️ **NOTE:** …" for helpful context

PHOTOS
- You receive a photos array. Place each photo inline at the step it documents. Use the caption (if any) to decide placement; otherwise place photos in order across the steps.
- Render as standard Markdown image syntax on its OWN line directly under the relevant step:
  ![caption or empty](EXACT_URL_FROM_INPUT)
- Never invent, modify, reorder, omit, or duplicate URLs. Every supplied url must appear exactly once.

OUTPUT
- Return ONLY the markdown body (no JSON, no preamble, no code fence around the whole thing).
- The first line should be the H1: "# <title>" if the user did not include one.
- Do not invent facts. If a step is ambiguous, keep the original wording.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as {
    title?: string
    category?: string
    draft?: string
    photos?: { url: string; caption?: string }[]
  }
  if (!body || !body.draft) {
    return res.status(400).json({ error: 'Invalid body', detail: 'draft is required' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server not configured', detail: 'ANTHROPIC_API_KEY not set' })
  }

  try {
    const userMsg = JSON.stringify(
      {
        title: body.title || '',
        category: body.category || '',
        draft: body.draft,
        photos: (body.photos || []).map(p => ({ url: p.url, caption: p.caption || '' })),
      },
      null,
      2,
    )

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    })

    const md = resp.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim()

    return res.status(200).json({ ok: true, markdown: md })
  } catch (error: any) {
    console.error('guides-ai-prettify error:', error)
    const detail = error?.message || String(error)
    return res.status(500).json({ error: 'Failed to prettify', detail })
  }
}
