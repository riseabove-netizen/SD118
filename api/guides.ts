import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
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

function getSheetsAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function newId() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  return `G-${stamp}-${Math.random().toString(36).slice(2, 6)}`
}

// ------------------- list -------------------

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Failed to load guides', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }

  const guideId = String(req.query.id || '').trim()
  const withContent = String(req.query.withContent || '') === '1' || !!guideId

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const metaResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'Guides!A:H',
  })
  const metaRows = metaResp.data.values || []
  if (metaRows.length < 2) return res.status(200).json({ guides: [], guide: null })

  const metaHeaders = metaRows[0]
  let guides = metaRows.slice(1).map((row, i) => {
    const obj: Record<string, any> = { rowIndex: i + 2 }
    metaHeaders.forEach((h, j) => {
      obj[h] = row[j] || ''
    })
    return obj
  })

  if (guideId) {
    guides = guides.filter(g => g.ID === guideId)
    if (guides.length === 0) {
      // Well-known caller-seeded IDs (e.g. FIRE-..., DRILLS-...) may not
      // exist yet on first read — return null so the client can fall back
      // to its seed data instead of erroring out.
      if (!guideId.startsWith('G-')) {
        return res.status(200).json({ guide: null })
      }
      return res.status(404).json({ error: 'Guide not found' })
    }
  }

  if (!withContent) {
    return res.status(200).json({ guides })
  }

  const versionsResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'GuideVersions!A:F',
  })
  const vRows = versionsResp.data.values || []
  const vHeaders = vRows[0] || []
  const allVersions = vRows.slice(1).map(row => {
    const obj: Record<string, any> = {}
    vHeaders.forEach((h, j) => {
      obj[h] = row[j] || ''
    })
    return obj
  })

  const enriched = guides.map(g => {
    const versions = allVersions
      .filter(v => v['Guide ID'] === g.ID)
      .sort((a, b) => Number(b.Version || 0) - Number(a.Version || 0))
    const currentVersion = String(g['Current Version'] || versions[0]?.Version || '1')
    const current = versions.find(v => String(v.Version) === currentVersion) || versions[0]
    return {
      ...g,
      Markdown: current?.Markdown || '',
      versions: versions.map(v => ({
        version: Number(v.Version || 0),
        createdAt: v['Created At'] || '',
        createdBy: v['Created By'] || '',
        note: v.Note || '',
      })),
    }
  })

  if (guideId) {
    return res.status(200).json({ guide: enriched[0] })
  }
  return res.status(200).json({ guides: enriched })
}

// ------------------- upsert -------------------

async function handleUpsert(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }

  const body = req.body as {
    id?: string
    title?: string
    category?: string
    markdown?: string
    note?: string
    user?: string
  }
  if (!body || !body.title || !body.markdown) {
    return res.status(400).json({ error: 'Invalid body', detail: 'title and markdown are required' })
  }

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const nowIso = new Date().toISOString()
  const user = (body.user || 'crew').trim()
  const category = (body.category || '').trim()
  const title = body.title.trim()
  const markdown = body.markdown
  const note = (body.note || '').trim()

  const metaResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'Guides!A:H',
  })
  const metaRows = metaResp.data.values || []
  const headers = metaRows[0] || ['ID', 'Title', 'Category', 'Current Version', 'Updated At', 'Updated By', 'Created At', 'Created By']

  let guideId = (body.id || '').trim()
  let isNew = !guideId
  let createdAt = nowIso
  let createdBy = user
  let nextVersion = 1
  let existingRowIdx = -1

  if (!isNew) {
    existingRowIdx = metaRows.slice(1).findIndex(r => r[0] === guideId)
    if (existingRowIdx < 0) {
      // Allow callers to seed a record at a well-known ID (e.g. FIRE-...,
      // DRILLS-...) the first time it's saved. Auto-generated IDs always
      // start with "G-" so any non-G prefix is treated as caller-supplied
      // and accepted as a new record.
      if (!guideId.startsWith('G-')) {
        isNew = true
      } else {
        return res.status(404).json({ error: 'Guide not found' })
      }
    } else {
      const existing = metaRows[existingRowIdx + 1]
      createdAt = existing[6] || nowIso
      createdBy = existing[7] || user
      nextVersion = Number(existing[3] || 0) + 1
    }
  }
  if (isNew && !guideId) {
    guideId = newId()
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: INVENTORY_ID,
    range: 'GuideVersions!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[guideId, String(nextVersion), nowIso, user, markdown, note]],
    },
  })

  const rowValues = [guideId, title, category, String(nextVersion), nowIso, user, createdAt, createdBy]

  if (isNew) {
    if (metaRows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: INVENTORY_ID,
        range: 'Guides!A1:H1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      })
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: 'Guides!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] },
    })
  } else {
    const sheetRow = existingRowIdx + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `Guides!A${sheetRow}:H${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] },
    })
  }

  return res.status(200).json({ ok: true, id: guideId, version: nextVersion })
}

// ------------------- prettify -------------------

const PRETTIFY_PROMPT = `You are formatting an OPERATIONAL GUIDE for the crew of the motor yacht Rise Above (Sanlorenzo SD118).

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

async function handlePrettify(req: VercelRequest, res: VercelResponse) {
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    system: PRETTIFY_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  })

  const md = resp.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim()

  return res.status(200).json({ ok: true, markdown: md })
}


// ------------------- router -------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const action = String(req.query.action || '').trim() || (req.method === 'GET' ? 'list' : '')
    if (req.method === 'GET') {
      return await handleList(req, res)
    }
    if (req.method === 'POST') {
      if (action === 'prettify') return await handlePrettify(req, res)
      // action=archive lives in /api/guide-archive.ts to keep pdf-lib out of
      // this function's bundle (it was pushing Vercel over the size limit and
      // causing FUNCTION_INVOCATION_FAILED on every guides.* call).
      if (action === 'archive') {
        return res.status(410).json({
          error: 'Moved',
          detail: 'Archive endpoint moved to /api/guide-archive. Update the client.',
        })
      }
      if (action === 'upsert' || !action) return await handleUpsert(req, res)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('guides handler error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Guide request failed', detail })
  }
}
