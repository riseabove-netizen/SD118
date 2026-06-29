import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { applyBranding, PDF_BRANDING_TOP_MARGIN, PDF_BRANDING_BOTTOM_MARGIN } from '../src/lib/pdfBranding'

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
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
const TRIPS_SHEET = 'Trips'
const WATCH_SHEET = 'WatchDuties'

// Watch-Duties PDF lands in WATCH_DUTIES_FOLDER_ID if set, else falls back to
// the existing INSPECTIONS_FOLDER_ID so it works out-of-the-box without new
// env-var work. User can move/rename the folder later.
const WATCH_FOLDER = cleanEnv(process.env.WATCH_DUTIES_FOLDER_ID) || cleanEnv(process.env.INSPECTIONS_FOLDER_ID)

function getSheetsAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
  })
}

/** Watch rotation calendar (Europe/Madrid). Service account must be granted read access. */
const WATCH_CALENDAR_ID =
  cleanEnv(process.env.WATCH_CALENDAR_ID) ||
  'c_73f50e718a59d11e5c7b773356918294dc20b765db2abf207e55d3c6449adece@group.calendar.google.com'

async function handleWatchCalendar(req: VercelRequest, res: VercelResponse) {
  const auth = getSheetsAuth()
  const calendar = google.calendar({ version: 'v3', auth })

  // Optional window: ?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults: today — today+60d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const defaultFrom = today.toISOString()
  const future = new Date(today)
  future.setDate(future.getDate() + 60)
  const defaultTo = future.toISOString()

  const fromQ = String(req.query.from || '').trim()
  const toQ = String(req.query.to || '').trim()
  const timeMin = fromQ ? new Date(fromQ).toISOString() : defaultFrom
  const timeMax = toQ ? new Date(toQ).toISOString() : defaultTo

  try {
    const resp = await calendar.events.list({
      calendarId: WATCH_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    })
    const items = (resp.data.items || []).map(ev => ({
      id: ev.id || '',
      summary: ev.summary || '',
      description: ev.description || '',
      location: ev.location || '',
      start: ev.start?.dateTime || ev.start?.date || '',
      end: ev.end?.dateTime || ev.end?.date || '',
      allDay: !!ev.start?.date && !ev.start?.dateTime,
      htmlLink: ev.htmlLink || '',
      attendees: (ev.attendees || []).map(a => ({
        email: a.email || '',
        displayName: a.displayName || '',
        responseStatus: a.responseStatus || '',
      })),
    }))
    return res.status(200).json({
      ok: true,
      events: items,
      timeZone: resp.data.timeZone || 'Europe/Madrid',
      calendarId: WATCH_CALENDAR_ID,
    })
  } catch (error: any) {
    const status = error?.code || error?.response?.status || 500
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    // 404 from Calendar API = service account doesn't have access to this calendar
    if (status === 404 || status === 403) {
      return res.status(200).json({
        ok: false,
        needsAccess: true,
        detail,
        calendarId: WATCH_CALENDAR_ID,
      })
    }
    return res.status(500).json({ ok: false, error: 'Calendar request failed', detail })
  }
}

async function ensureSheetExists(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const exists = (meta.data.sheets || []).some((s: any) => s.properties?.title === title)
  if (exists) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: INVENTORY_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: INVENTORY_ID,
    range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  })
}

// ============================================================================
// TRIPS — existing endpoints (unchanged behaviour)
// ============================================================================

async function handleTripsGet(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  const id = String(req.query.id || '').trim()
  if (!id) return res.status(400).json({ error: 'id required' })

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheetExists(sheets, TRIPS_SHEET, ['ID', 'JSON', 'UpdatedAt', 'UpdatedBy'])

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${TRIPS_SHEET}!A:D`,
  })
  const rows = resp.data.values || []
  const dataRow = rows.slice(1).find(r => r[0] === id)
  if (!dataRow) return res.status(200).json({ trip: null })

  let parsed: any = null
  try {
    parsed = JSON.parse(dataRow[1] || 'null')
  } catch {
    parsed = null
  }
  return res.status(200).json({
    trip: parsed,
    updatedAt: dataRow[2] || '',
    updatedBy: dataRow[3] || '',
  })
}

async function handleTripsPost(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  const body = req.body as { id?: string; trip?: any; user?: string }
  if (!body?.id || !body?.trip) {
    return res.status(400).json({ error: 'Invalid body', detail: 'id and trip are required' })
  }
  const id = String(body.id).trim()
  const user = String(body.user || 'crew').trim()
  const json = JSON.stringify(body.trip)
  const nowIso = new Date().toISOString()

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheetExists(sheets, TRIPS_SHEET, ['ID', 'JSON', 'UpdatedAt', 'UpdatedBy'])

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${TRIPS_SHEET}!A:D`,
  })
  const rows = resp.data.values || []
  const existingIdx = rows.slice(1).findIndex(r => r[0] === id)
  const rowValues = [id, json, nowIso, user]

  if (existingIdx >= 0) {
    const sheetRow = existingIdx + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${TRIPS_SHEET}!A${sheetRow}:D${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: `${TRIPS_SHEET}!A:D`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    })
  }

  return res.status(200).json({ ok: true, id, updatedAt: nowIso })
}

// ============================================================================
// WATCH DUTIES
// ============================================================================

type WatchState = {
  date: string
  crewOnDuty: string
  handoverTo: string
  checks: Record<string, boolean>
  sectionComments: Record<string, string>
  generalComments: string
  signoffs: Record<string, { name: string; time: string }>
  handoverSignature: { name: string; time: string }
  receiptSignature: { name: string; time: string }
  pdfLink?: string
  finalizedAt?: string
}

const WATCH_HEADERS = ['Date', 'JSON', 'UpdatedAt', 'UpdatedBy', 'PDFLink', 'FinalizedAt']

async function readWatchRow(sheets: any, date: string) {
  await ensureSheetExists(sheets, WATCH_SHEET, WATCH_HEADERS)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${WATCH_SHEET}!A:F`,
  })
  const rows = resp.data.values || []
  const idx = rows.slice(1).findIndex(r => r[0] === date)
  return { rows, idx, sheetRow: idx >= 0 ? idx + 2 : -1 }
}

async function handleWatchGet(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  const date = String(req.query.date || '').trim()
  if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' })

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const { rows, idx } = await readWatchRow(sheets, date)
  if (idx < 0) return res.status(200).json({ state: null })

  const row = rows[idx + 1]
  let parsed: WatchState | null = null
  try {
    parsed = JSON.parse(row[1] || 'null')
  } catch {
    parsed = null
  }
  return res.status(200).json({
    state: parsed,
    updatedAt: row[2] || '',
    updatedBy: row[3] || '',
    pdfLink: row[4] || '',
    finalizedAt: row[5] || '',
  })
}

async function writeWatchRow(sheets: any, state: WatchState, user: string, pdfLink: string, finalizedAt: string) {
  const json = JSON.stringify(state)
  const nowIso = new Date().toISOString()
  const rowValues = [state.date, json, nowIso, user, pdfLink, finalizedAt]
  const { idx, sheetRow } = await readWatchRow(sheets, state.date)
  if (idx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${WATCH_SHEET}!A${sheetRow}:F${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: `${WATCH_SHEET}!A:F`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    })
  }
  return { updatedAt: nowIso }
}

async function handleWatchSave(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  const body = req.body as { state?: WatchState; user?: string }
  if (!body?.state?.date) return res.status(400).json({ error: 'Invalid body', detail: 'state.date is required' })

  const user = String(body.user || body.state.crewOnDuty || 'crew').trim()
  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const { idx, rows } = await readWatchRow(sheets, body.state.date)
  // Preserve PDFLink + FinalizedAt if already present
  const existing = idx >= 0 ? rows[idx + 1] : []
  const existingPdf = existing[4] || body.state.pdfLink || ''
  const existingFinal = existing[5] || body.state.finalizedAt || ''
  const { updatedAt } = await writeWatchRow(sheets, body.state, user, existingPdf, existingFinal)
  return res.status(200).json({ ok: true, date: body.state.date, updatedAt })
}

// --- PDF rendering ---------------------------------------------------------

// Mirror of the client checklist so the PDF stays accurate even if a user
// edits offline. (We keep this in sync with src/data/watch-duties.ts.)
const WATCH_SECTIONS = [
  {
    id: 'morning',
    time: '07:45 – 08:00',
    title: 'Unlock doors — crew door, port and STB bridge doors (week days only)',
    signoffRange: '08:00 – 10:00',
    items: [
      { id: 'm1', label: 'Complete a full walk through of ALL areas of vessel INTERIOR AND DECK.' },
      { id: 'm2', label: 'Check Fridges and Freezer temps and fill in Fridge Log, TO BE DONE EVERY ROUND.' },
      { id: 'm3', label: 'Check Engine Room and report anything out of the ordinary to the Engineer.' },
      { id: 'm4', label: 'Check lines, fenders and gangway.' },
      { id: 'm5', label: 'Interior — Please make sure dishwasher is turned on if empty, not loaded before lunch.' },
      { id: 'm6', label: 'Turn off Exterior Lights.' },
      { id: 'm7', label: 'Bridge External Light Panel — Wheel house Panel.' },
      { id: 'm8', label: 'Remove cover from flag pole — SUNDECK.' },
    ],
  },
  {
    id: 'midday',
    time: '12:00',
    title: '',
    signoffRange: '12:00 – 14:00',
    items: [
      { id: 'l1', label: 'Interior — Please assist the chef in setting up for lunch.' },
      { id: 'l2', label: 'Complete Round — Check lines, fenders and gangway.' },
      { id: 'l3', label: 'CREW ON WATCH — Pack away after lunch, food in tupperwares, crew mess cleaned up.' },
    ],
  },
  {
    id: 'afternoon',
    time: '17:00',
    title: '',
    items: [
      { id: 'a1', label: 'Complete full round. Check lines, fenders and gangway.' },
      { id: 'a2', label: 'Lock all exterior doors but leave the crew door until 21:00. This should be completed as soon as the working day has come to a close.' },
    ],
  },
  {
    id: 'evening',
    time: '18:00',
    title: '',
    items: [
      { id: 'e1', label: 'Put all food away in Tupperware, in Galley fridge (food to be thrown away in CM bins only).' },
      { id: 'e2', label: 'Wash dishes, if you use Galley dishwasher, dry and put away.' },
      { id: 'e3', label: 'Wipe down all surfaces in Crew Mess. Hoover floor and wipe down seats if necessary.' },
    ],
  },
  {
    id: 'sunset',
    time: '10 min before sunset',
    title: 'Set up for crew dinner (mats, food, plates, cutlery, condiments etc.)',
    items: [
      { id: 's1', label: 'Turn on exterior lights.' },
      { id: 's2', label: 'Bridge External Light Panel (Marked).' },
      { id: 's3', label: 'Take Flag down at Sunset.' },
      { id: 's4', label: 'All lights in the interior guest areas must be switched off except corridors and ensure that all the interior doors are closed.' },
    ],
  },
  {
    id: 'before-bed',
    time: 'Before you retire for the night',
    title: '',
    items: [
      { id: 'b1', label: 'Clean and refill coffee machine.' },
      { id: 'b2', label: 'Restock fridges and crew mess water.' },
      { id: 'b3', label: 'Empty all Crew Mess rubbish bins and place in dock bins.' },
      { id: 'b4', label: 'Unpack dishwasher when cycle finished and put all dishes away.' },
    ],
  },
  {
    id: 'night',
    time: '21:00',
    title: '',
    items: [
      { id: 'n1', label: 'Check lines, fenders and gangway and complete final security round & re-check exterior doors.' },
      { id: 'n2', label: 'Carry Crew UHF radio left during the night while on watch in case of early hours emergency.' },
    ],
  },
] as const

async function buildWatchPdf(state: WatchState): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const margin = 38
  const pageWidth = 595.28
  const pageHeight = 841.89
  const contentWidth = pageWidth - margin * 2

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - PDF_BRANDING_TOP_MARGIN

  function ensureSpace(needed: number) {
    if (y - needed < PDF_BRANDING_BOTTOM_MARGIN) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - PDF_BRANDING_TOP_MARGIN
    }
  }

  function wrap(text: string, f: any, size: number, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line)
        line = w
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  function drawText(text: string, opts: { font?: any; size?: number; color?: any; gap?: number; x?: number; maxWidth?: number } = {}) {
    const f = opts.font || font
    const size = opts.size || 10.5
    const color = opts.color || rgb(0, 0, 0)
    const lineHeight = size * 1.3
    const x = opts.x ?? margin
    const maxW = opts.maxWidth ?? contentWidth - (x - margin)
    const lines = wrap(text, f, size, maxW)
    for (const ln of lines) {
      ensureSpace(lineHeight + 2)
      y -= lineHeight
      page.drawText(ln, { x, y, size, font: f, color })
    }
    y -= opts.gap ?? 3
  }

  function drawDivider(color = rgb(0.85, 0.85, 0.85)) {
    ensureSpace(10)
    y -= 4
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color,
    })
    y -= 4
  }

  function drawCheckbox(checked: boolean, cx: number, cy: number) {
    page.drawRectangle({
      x: cx,
      y: cy,
      width: 9,
      height: 9,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    })
    if (checked) {
      // X mark
      page.drawLine({ start: { x: cx + 1, y: cy + 1 }, end: { x: cx + 8, y: cy + 8 }, thickness: 1.2, color: rgb(0.7, 0.1, 0.1) })
      page.drawLine({ start: { x: cx + 8, y: cy + 1 }, end: { x: cx + 1, y: cy + 8 }, thickness: 1.2, color: rgb(0.7, 0.1, 0.1) })
    }
  }

  // Title band (sits below the branded logo header)
  const bandTop = pageHeight - PDF_BRANDING_TOP_MARGIN
  page.drawRectangle({
    x: margin,
    y: bandTop - 36,
    width: contentWidth,
    height: 36,
    color: rgb(0.07, 0.13, 0.28),
  })
  page.drawText('WATCH DUTIES', { x: margin + 12, y: bandTop - 16, size: 13, font: bold, color: rgb(1, 1, 1) })
  page.drawText('M/Y RISE ABOVE III', { x: margin + 12, y: bandTop - 30, size: 9, font: bold, color: rgb(0.85, 0.27, 0.27) })
  page.drawText('07:45 – 08:00 for 24 hours', {
    x: pageWidth - margin - 140,
    y: bandTop - 22,
    size: 9,
    font,
    color: rgb(1, 1, 1),
  })
  y = bandTop - 36 - 12

  // Date + crew strip
  const [yy, mm, dd] = state.date.split('-').map(Number)
  const dateDisplay = new Date(yy, mm - 1, dd).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  drawText(`Date: ${dateDisplay}`, { font: bold, size: 11, color: rgb(0.07, 0.13, 0.28), gap: 1 })
  drawText(`Crew member on duty: ${state.crewOnDuty || '—'}`, { size: 10, color: rgb(0.25, 0.25, 0.25), gap: 1 })
  drawText(`Watch handover to: ${state.handoverTo || '—'}`, { size: 10, color: rgb(0.25, 0.25, 0.25), gap: 4 })
  drawDivider(rgb(0.07, 0.13, 0.28))

  // Sections
  for (const section of WATCH_SECTIONS) {
    const total = section.items.length
    const done = section.items.filter(i => !!state.checks[i.id]).length

    // Section header bar
    ensureSpace(22)
    y -= 16
    page.drawRectangle({
      x: margin,
      y: y - 2,
      width: contentWidth,
      height: 18,
      color: rgb(0.94, 0.94, 0.96),
    })
    page.drawText(section.time, { x: margin + 6, y: y + 2, size: 9.5, font: bold, color: rgb(0.7, 0.1, 0.1) })
    if (section.title) {
      const titleLines = wrap(section.title, bold, 9, contentWidth - 200)
      page.drawText(titleLines[0] || '', { x: margin + 130, y: y + 2, size: 9, font: bold, color: rgb(0.07, 0.13, 0.28) })
    }
    page.drawText(`${done}/${total}`, { x: pageWidth - margin - 30, y: y + 2, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) })
    y -= 8

    // Items
    for (const item of section.items) {
      ensureSpace(14)
      const checked = !!state.checks[item.id]
      const itemX = margin + 18
      const lines = wrap(item.label, font, 9.5, contentWidth - 22)
      // First line aligns with checkbox
      drawCheckbox(checked, margin + 4, y - 9.5)
      page.drawText(lines[0] || '', { x: itemX, y: y - 9, size: 9.5, font, color: checked ? rgb(0.45, 0.45, 0.45) : rgb(0, 0, 0) })
      y -= 12
      for (let i = 1; i < lines.length; i++) {
        ensureSpace(11)
        page.drawText(lines[i], { x: itemX, y: y - 9, size: 9.5, font, color: checked ? rgb(0.45, 0.45, 0.45) : rgb(0, 0, 0) })
        y -= 11
      }
      y -= 1
    }

    // Section comments
    const sc = state.sectionComments[section.id]
    if (sc && sc.trim()) {
      y -= 2
      drawText('Comments:', { font: bold, size: 8.5, color: rgb(0.35, 0.35, 0.35), gap: 0, x: margin + 4 })
      drawText(sc.trim(), { size: 9, color: rgb(0.2, 0.2, 0.2), gap: 3, x: margin + 4 })
    }

    // Signoff line
    const so = state.signoffs[section.id]
    if (section.signoffRange || so) {
      y -= 2
      const lineY = y - 4
      page.drawLine({ start: { x: margin, y: lineY }, end: { x: pageWidth - margin, y: lineY }, thickness: 0.4, color: rgb(0.85, 0.85, 0.85) })
      y -= 14
      const range = section.signoffRange || section.time
      page.drawText(`${range}  ·  Duties completed — Crew signature:`, { x: margin + 4, y, size: 8.5, font: bold, color: rgb(0.07, 0.13, 0.28) })
      const sigText = so?.name ? `${so.name}${so.time ? '  ·  ' + so.time : ''}` : '___________________________'
      page.drawText(sigText, { x: margin + 270, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) })
      y -= 6
    }

    y -= 2
  }

  // General comments
  if (state.generalComments && state.generalComments.trim()) {
    drawDivider()
    drawText('General comments / Handover notes', { font: bold, size: 11, color: rgb(0.07, 0.13, 0.28), gap: 4 })
    drawText(state.generalComments.trim(), { size: 10, color: rgb(0.1, 0.1, 0.1), gap: 4 })
  }

  // Standing orders
  drawDivider()
  drawText('Standing Orders', { font: bold, size: 10, color: rgb(0.7, 0.1, 0.1), gap: 3 })
  const orders = [
    'You are responsible for the Safety & Security of the vessel on your watch day. Make sure duties are carried out diligently and on time. Pay close attention to weather changes and alert the Chief Officer/Captain with any concerns regarding Safety or Security of the vessel.',
    'Inform owner at all times and carry your radio with you. After work hours you need to be monitoring CCTV, phone calls and alarms.',
    'No drinking during, or 6 hrs prior to your watch. Make sure you are 100% fit for duty on your watch day.',
    'Watches may only be swapped with prior approval of the Chief Officer or Captain.',
  ]
  for (const o of orders) drawText('· ' + o, { size: 8.5, color: rgb(0.25, 0.25, 0.25), gap: 1 })

  // Bottom signatures
  drawDivider()
  ensureSpace(80)
  y -= 14
  page.drawText('HANDOVER SIGNATURE', { x: margin + 4, y, size: 9, font: bold, color: rgb(0.07, 0.13, 0.28) })
  page.drawText('RECEIPT SIGNATURE', { x: pageWidth / 2 + 12, y, size: 9, font: bold, color: rgb(0.07, 0.13, 0.28) })
  y -= 22
  page.drawText(state.handoverSignature?.name || '________________________', { x: margin + 4, y, size: 10, font })
  page.drawText(state.receiptSignature?.name || '________________________', { x: pageWidth / 2 + 12, y, size: 10, font })
  y -= 14
  page.drawText('DATE / TIME: ' + (state.handoverSignature?.time || '____________________'), { x: margin + 4, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('DATE / TIME: ' + (state.receiptSignature?.time || '____________________'), { x: pageWidth / 2 + 12, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
  y -= 18

  // Generated timestamp (placed above the branded footer band)
  ensureSpace(14)
  y -= 10
  page.drawText(`Generated: ${new Date().toLocaleString()}`, { x: margin, y, size: 7.5, font, color: rgb(0.55, 0.55, 0.55) })

  await applyBranding(pdf)
  return await pdf.save()
}

async function handleWatchFinalize(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  if (!WATCH_FOLDER) {
    return res.status(500).json({
      error: 'Server not configured',
      detail: 'WATCH_DUTIES_FOLDER_ID (or INSPECTIONS_FOLDER_ID) not set — cannot save PDF to Drive',
    })
  }
  const body = req.body as { state?: WatchState; user?: string }
  if (!body?.state?.date) return res.status(400).json({ error: 'Invalid body', detail: 'state.date is required' })

  const user = String(body.user || body.state.crewOnDuty || 'crew').trim()
  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  // 1. Build PDF
  const pdfBytes = await buildWatchPdf(body.state)
  const fileName = `Rise Above — Watch Duties — ${body.state.date}${body.state.crewOnDuty ? ' — ' + body.state.crewOnDuty.replace(/[^A-Za-z0-9 ._-]/g, '') : ''}.pdf`

  // 2. Upload to Drive
  const pdfStream = Readable.from(Buffer.from(pdfBytes))
  const uploadResp = await drive.files.create({
    requestBody: { name: fileName, parents: [WATCH_FOLDER] },
    media: { mimeType: 'application/pdf', body: pdfStream },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })
  const fileId = uploadResp.data.id || ''
  const pdfLink = uploadResp.data.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '')
  const finalizedAt = new Date().toISOString()

  // 3. Update sheet
  const updatedState: WatchState = { ...body.state, pdfLink, finalizedAt }
  await writeWatchRow(sheets, updatedState, user, pdfLink, finalizedAt)

  return res.status(200).json({ ok: true, pdfFileId: fileId, pdfLink, finalizedAt })
}

// ============================================================================
// ROUTER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const action = String(req.query.action || '').trim()
    if (req.method === 'GET') {
      if (action === 'watch-get') return await handleWatchGet(req, res)
      if (action === 'watch-calendar') return await handleWatchCalendar(req, res)
      // default: trips get
      return await handleTripsGet(req, res)
    }
    if (req.method === 'POST') {
      if (action === 'watch-save') return await handleWatchSave(req, res)
      if (action === 'watch-finalize') return await handleWatchFinalize(req, res)
      // default: trips post
      return await handleTripsPost(req, res)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('trips/watch handler error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Request failed', detail })
  }
}
