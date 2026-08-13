// Maintenance module API.
//
// Ops (dispatched via ?op=):
//   - GET  op=list        -> list every logged maintenance event
//   - GET  op=system      -> get system state (current hours + last kit
//                            services, computed from the log rows)
//   - POST op=hours       -> update the current-hours reading for a system
//   - POST op=log         -> record a maintenance event: builds a PDF,
//                            uploads photos + supporting PDFs to Drive
//                            under Maintenance/<Type>/<Side>/<eventId>/,
//                            writes a MaintenanceLog row to the inventory
//                            sheet, and returns the Drive link.
//
// Storage layout in the inventory spreadsheet:
//   Sheet `MaintenanceLog` (created on first use):
//     EventId | Timestamp | SystemId | SystemLabel | KitIds | HoursAtService | Technician | Notes | InventoryUsedJson | DriveFileId | DriveLink | AttachmentsJson
//   Sheet `MaintenanceHours`:
//     SystemId | CurrentHours | UpdatedAt | UpdatedBy
//
// Google Drive layout:
//   Root (env MAINTENANCE_FOLDER_ID -- if not set, INSPECTIONS_FOLDER_ID's
//   parent is used, and a subfolder "Maintenance" is created there):
//     Maintenance/
//       Generator/
//         Port/
//           2026-08-13-1400_generator-port_250h.pdf
//           <eventId>/photo-1.jpg
//         Starboard/
//       Main Engine/
//         Port/
//         Starboard/
//       ...
//
// Folder resolution is cached per-parent for the lifetime of one function
// invocation (folders are created if missing).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ---------------- env + auth ----------------

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)
// Preferred: dedicated Maintenance root folder id. If not set we fall
// back to the inspection folder's parent so everything stays under the
// existing Rise Above tree.
const MAINTENANCE_FOLDER_ID = cleanEnv(process.env.MAINTENANCE_FOLDER_ID)
const INSPECTIONS_FOLDER_ID = cleanEnv(process.env.INSPECTIONS_FOLDER_ID)

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

// ---------------- sheet helpers ----------------

const LOG_HEADERS = [
  'EventId',
  'Timestamp',
  'SystemId',
  'SystemLabel',
  'KitIds',
  'HoursAtService',
  'Technician',
  'Notes',
  'InventoryUsedJson',
  'DriveFileId',
  'DriveLink',
  'AttachmentsJson',
]

const HOURS_HEADERS = ['SystemId', 'CurrentHours', 'UpdatedAt', 'UpdatedBy']

async function ensureSheet(sheets: any, title: string, headers: string[]) {
  // Look up sheet by title; create if absent, write headers.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === title)
  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: INVENTORY_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    })
    return
  }
  // Sheet exists — verify header row exists.
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${title}!A1:Z1`,
  })
  if (!cur.data.values || cur.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    })
  }
}

// ---------------- drive folder tree ----------------

async function resolveMaintenanceRoot(drive: any): Promise<string> {
  if (MAINTENANCE_FOLDER_ID) return MAINTENANCE_FOLDER_ID
  // Fallback: parent of the inspection folder.
  if (!INSPECTIONS_FOLDER_ID) {
    throw new Error('Neither MAINTENANCE_FOLDER_ID nor INSPECTIONS_FOLDER_ID is set')
  }
  const inspMeta = await drive.files.get({
    fileId: INSPECTIONS_FOLDER_ID,
    fields: 'id, parents',
    supportsAllDrives: true,
  })
  const parents: string[] = inspMeta.data.parents || []
  const parentId = parents[0]
  if (!parentId) throw new Error('Inspection folder has no parent to nest Maintenance under')
  // Look for a "Maintenance" folder under that parent; create if missing.
  return await getOrCreateChildFolder(drive, parentId, 'Maintenance')
}

async function getOrCreateChildFolder(drive: any, parentId: string, name: string): Promise<string> {
  const escaped = name.replace(/'/g, "\\'")
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents and name='${escaped}'`
  const list = await drive.files.list({
    q,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existing = list.data.files?.[0]
  if (existing?.id) return existing.id
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.data.id
}

async function resolveFolderPath(drive: any, path: string[]): Promise<string> {
  // path[0] is expected to be "Maintenance" — we skip it and start at the
  // Maintenance root, so path = ["Maintenance", "Generator", "Port"] lands
  // in Root/Maintenance/Generator/Port.
  let current = await resolveMaintenanceRoot(drive)
  const rest = path[0]?.toLowerCase() === 'maintenance' ? path.slice(1) : path
  for (const segment of rest) {
    current = await getOrCreateChildFolder(drive, current, segment)
  }
  return current
}

// ---------------- image helpers ----------------

function detectImageMime(b64: string): 'image/jpeg' | 'image/png' {
  try {
    const head = Buffer.from(b64.slice(0, 16), 'base64').toString('binary')
    if (head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8) return 'image/jpeg'
    if (head.charCodeAt(0) === 0x89 && head.charCodeAt(1) === 0x50) return 'image/png'
  } catch {}
  return 'image/jpeg'
}

// ---------------- PDF builder ----------------

interface PdfInputChecklistItem {
  label: string
  kitShortLabel: string
  done: boolean
  notes?: string
}
interface PdfInputInventory {
  name: string
  qty: number | string
  partNumber?: string
}
interface PdfInputPhoto {
  base64: string
  label?: string
}
interface PdfInput {
  eventId: string
  systemLabel: string
  kitLabels: string[]
  hoursAtService: string | number
  technician: string
  timestamp: string
  notes: string
  checklist: PdfInputChecklistItem[]
  inventory: PdfInputInventory[]
  photos: PdfInputPhoto[]
  // A user-attached PDF (e.g. sub-contractor invoice). If present, it's
  // merged as additional pages after the main record pages.
  attachedPdfBase64?: string | null
}

async function buildMaintenancePdf(input: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 612
  const pageHeight = 792
  const margin = 48
  const contentWidth = pageWidth - 2 * margin

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const line = (text: string, opts: { size?: number; font?: any; color?: any; indent?: number } = {}) => {
    const size = opts.size || 11
    const useFont = opts.font || font
    const color = opts.color || rgb(0, 0, 0)
    const indent = opts.indent || 0
    if (y - size < margin) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
    page.drawText(text, {
      x: margin + indent,
      y: y - size,
      size,
      font: useFont,
      color,
    })
    y -= size + 4
  }

  const rule = () => {
    if (y - 10 < margin) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
    page.drawLine({
      start: { x: margin, y: y - 4 },
      end: { x: margin + contentWidth, y: y - 4 },
      thickness: 0.6,
      color: rgb(0.7, 0.1, 0.1),
    })
    y -= 12
  }

  const wrapAndDraw = (text: string, opts: { size?: number; indent?: number; font?: any } = {}) => {
    const size = opts.size || 11
    const indent = opts.indent || 0
    const useFont = opts.font || font
    const maxWidth = contentWidth - indent
    const words = text.split(/\s+/)
    let cur = ''
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w
      const width = useFont.widthOfTextAtSize(trial, size)
      if (width > maxWidth) {
        line(cur, { size, indent, font: useFont })
        cur = w
      } else {
        cur = trial
      }
    }
    if (cur) line(cur, { size, indent, font: useFont })
  }

  // Header
  line('M/Y RISE ABOVE', { size: 20, font: bold, color: rgb(0.7, 0.1, 0.1) })
  line('Maintenance Record', { size: 14, font: bold })
  rule()

  // Metadata block
  line(`Event ID: ${input.eventId}`, { size: 10 })
  line(`System: ${input.systemLabel}`, { size: 12, font: bold })
  line(`Service performed: ${input.kitLabels.join(', ') || '—'}`, { size: 11 })
  line(`Hours at service: ${input.hoursAtService}`, { size: 11 })
  line(`Technician: ${input.technician}`, { size: 11 })
  line(`Date/time: ${input.timestamp}`, { size: 11 })
  if (input.notes) {
    y -= 4
    line('Notes:', { size: 10, font: bold })
    wrapAndDraw(input.notes, { size: 10, indent: 8 })
  }
  rule()

  // Checklist
  line('Checklist', { size: 13, font: bold })
  y -= 2
  if (input.checklist.length === 0) {
    line('(no checklist items recorded)', { size: 10, color: rgb(0.4, 0.4, 0.4) })
  } else {
    // Group by kit label so the reader can see which kit each item came from.
    const byKit: Record<string, PdfInputChecklistItem[]> = {}
    for (const item of input.checklist) {
      const k = item.kitShortLabel || 'Other'
      byKit[k] = byKit[k] || []
      byKit[k].push(item)
    }
    for (const [kitLabel, items] of Object.entries(byKit)) {
      line(kitLabel, { size: 11, font: bold, color: rgb(0.7, 0.1, 0.1) })
      for (const item of items) {
        const mark = item.done ? '[x]' : '[ ]'
        wrapAndDraw(`${mark} ${item.label}`, { size: 10, indent: 8 })
        if (item.notes) {
          wrapAndDraw(`— ${item.notes}`, { size: 9, indent: 20, font })
        }
      }
      y -= 4
    }
  }
  rule()

  // Inventory used
  line('Inventory used', { size: 13, font: bold })
  y -= 2
  if (input.inventory.length === 0) {
    line('(none)', { size: 10, color: rgb(0.4, 0.4, 0.4) })
  } else {
    for (const it of input.inventory) {
      const parts = [`• ${it.name}`, `qty ${it.qty}`]
      if (it.partNumber) parts.push(`P/N ${it.partNumber}`)
      wrapAndDraw(parts.join('  ·  '), { size: 10, indent: 8 })
    }
  }
  rule()

  // Photos — one per page after this, up to 8, embedded at full width.
  const photoLimit = Math.min(8, input.photos.length)
  if (photoLimit > 0) {
    for (let i = 0; i < photoLimit; i++) {
      const ph = input.photos[i]
      try {
        const bytes = Buffer.from(ph.base64, 'base64')
        const mime = detectImageMime(ph.base64)
        const img = mime === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
        page = pdf.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
        line(`Photo ${i + 1}${ph.label ? ` — ${ph.label}` : ''}`, { size: 12, font: bold })
        const maxW = contentWidth
        const maxH = pageHeight - margin - (pageHeight - y) - margin
        const scale = Math.min(maxW / img.width, maxH / img.height)
        const w = img.width * scale
        const h = img.height * scale
        page.drawImage(img, {
          x: margin + (maxW - w) / 2,
          y: margin,
          width: w,
          height: h,
        })
        y = margin
      } catch (e) {
        // Skip bad image, keep going.
      }
    }
  }

  // Merge attached PDF (sub-contractor invoice etc.) as extra pages.
  if (input.attachedPdfBase64) {
    try {
      const attachedBytes = Buffer.from(input.attachedPdfBase64, 'base64')
      const attached = await PDFDocument.load(attachedBytes, { ignoreEncryption: true })
      const copied = await pdf.copyPages(attached, attached.getPageIndices())
      for (const p of copied) pdf.addPage(p)
    } catch (e) {
      // Silently skip malformed PDFs.
    }
  }

  return pdf.save()
}

// ---------------- handlers ----------------

async function handleList(_req: VercelRequest, res: VercelResponse) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheet(sheets, 'MaintenanceLog', LOG_HEADERS)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'MaintenanceLog!A:Z',
  })
  const rows = resp.data.values || []
  if (rows.length < 2) return res.status(200).json({ events: [] })
  const headers = rows[0]
  const events = rows.slice(1).map((row: any[]) => {
    const obj: Record<string, any> = {}
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] || ''
    })
    // Decode JSON blobs
    try { obj.InventoryUsed = obj.InventoryUsedJson ? JSON.parse(obj.InventoryUsedJson) : [] } catch { obj.InventoryUsed = [] }
    try { obj.Attachments = obj.AttachmentsJson ? JSON.parse(obj.AttachmentsJson) : [] } catch { obj.Attachments = [] }
    try { obj.KitIds = obj.KitIds ? String(obj.KitIds).split(',').map((s: string) => s.trim()).filter(Boolean) : [] } catch { obj.KitIds = [] }
    return obj
  })
  return res.status(200).json({ events })
}

async function handleSystemState(req: VercelRequest, res: VercelResponse) {
  const systemId = String(req.query.systemId || '').trim()
  if (!systemId) return res.status(400).json({ error: 'systemId required' })
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheet(sheets, 'MaintenanceLog', LOG_HEADERS)
  await ensureSheet(sheets, 'MaintenanceHours', HOURS_HEADERS)

  // Current hours
  const hoursResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'MaintenanceHours!A:D',
  })
  const hoursRows = hoursResp.data.values || []
  const hoursRow = hoursRows.slice(1).find((r: any[]) => String(r[0] || '').trim() === systemId)
  const currentHours = hoursRow ? Number(hoursRow[1] || 0) : null
  const hoursUpdatedAt = hoursRow ? String(hoursRow[2] || '') : ''

  // Past services for this system
  const logResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'MaintenanceLog!A:Z',
  })
  const logRows = logResp.data.values || []
  const headers = logRows[0] || LOG_HEADERS
  const idxSystem = headers.indexOf('SystemId')
  const events = logRows.slice(1)
    .filter((r: any[]) => (r[idxSystem] || '') === systemId)
    .map((r: any[]) => {
      const obj: Record<string, any> = {}
      headers.forEach((h: string, i: number) => { obj[h] = r[i] || '' })
      try { obj.KitIds = obj.KitIds ? String(obj.KitIds).split(',').map((s: string) => s.trim()).filter(Boolean) : [] } catch { obj.KitIds = [] }
      try { obj.InventoryUsed = obj.InventoryUsedJson ? JSON.parse(obj.InventoryUsedJson) : [] } catch { obj.InventoryUsed = [] }
      try { obj.Attachments = obj.AttachmentsJson ? JSON.parse(obj.AttachmentsJson) : [] } catch { obj.Attachments = [] }
      return obj
    })

  // Sort by timestamp desc
  events.sort((a: any, b: any) => String(b.Timestamp).localeCompare(String(a.Timestamp)))

  // Compute last service hours per kit id (the maximum hours-at-service
  // across events where that kit id appears).
  const lastServiceHoursByKit: Record<string, number> = {}
  for (const e of events) {
    const h = Number(e.HoursAtService || 0)
    if (!Number.isFinite(h) || h <= 0) continue
    for (const kitId of e.KitIds || []) {
      const prev = lastServiceHoursByKit[kitId]
      if (prev == null || h > prev) lastServiceHoursByKit[kitId] = h
    }
  }

  return res.status(200).json({
    systemId,
    currentHours,
    hoursUpdatedAt,
    lastServiceHoursByKit,
    events,
  })
}

async function handleUpdateHours(req: VercelRequest, res: VercelResponse) {
  const body = (req.body || {}) as { systemId?: string; hours?: number; user?: string }
  const systemId = String(body.systemId || '').trim()
  const hours = Number(body.hours)
  const user = String(body.user || '').trim() || 'crew'
  if (!systemId) return res.status(400).json({ error: 'systemId required' })
  if (!Number.isFinite(hours) || hours < 0) return res.status(400).json({ error: 'hours must be a non-negative number' })

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheet(sheets, 'MaintenanceHours', HOURS_HEADERS)

  // Load current sheet to find the row for this systemId.
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'MaintenanceHours!A:D',
  })
  const rows = cur.data.values || []
  const now = new Date().toISOString()
  let rowIdx = -1
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString().trim() === systemId) {
      rowIdx = i
      break
    }
  }
  const newRow = [systemId, String(hours), now, user]
  if (rowIdx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `MaintenanceHours!A${rowIdx + 1}:D${rowIdx + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [newRow] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: 'MaintenanceHours!A:D',
      valueInputOption: 'RAW',
      requestBody: { values: [newRow] },
    })
  }
  return res.status(200).json({ ok: true, systemId, hours, updatedAt: now })
}

interface LogRequestBody {
  systemId: string
  systemLabel: string
  driveFolderPath: string[]
  kitIds: string[]
  kitLabels: string[]
  hoursAtService: number | string
  technician: string
  notes?: string
  checklist: PdfInputChecklistItem[]
  inventory: PdfInputInventory[]
  photos: PdfInputPhoto[]
  attachedPdfBase64?: string | null
  attachedPdfFileName?: string | null
}

async function handleLog(req: VercelRequest, res: VercelResponse) {
  const body = (req.body || {}) as LogRequestBody
  if (!body.systemId) return res.status(400).json({ error: 'systemId required' })
  if (!Array.isArray(body.kitIds) || body.kitIds.length === 0) return res.status(400).json({ error: 'at least one kitId required' })

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  await ensureSheet(sheets, 'MaintenanceLog', LOG_HEADERS)
  await ensureSheet(sheets, 'MaintenanceHours', HOURS_HEADERS)

  const eventId = 'MTN-' + Date.now().toString(36)
  const ts = new Date().toISOString()
  const dateStr = ts.slice(0, 10)
  const timeStr = ts.slice(11, 16).replace(':', '')

  // 1) Build PDF
  const pdfBytes = await buildMaintenancePdf({
    eventId,
    systemLabel: body.systemLabel,
    kitLabels: body.kitLabels || [],
    hoursAtService: body.hoursAtService,
    technician: body.technician,
    timestamp: ts,
    notes: body.notes || '',
    checklist: body.checklist || [],
    inventory: body.inventory || [],
    photos: body.photos || [],
    attachedPdfBase64: body.attachedPdfBase64 || null,
  })

  // 2) Resolve destination folder and upload the PDF
  const folderId = await resolveFolderPath(drive, body.driveFolderPath || ['Maintenance', 'Misc'])
  const kitSlug = (body.kitIds || []).join('+') || 'service'
  const fileName = `${dateStr}_${timeStr}_${body.systemId}_${kitSlug}.pdf`
  const pdfStream = Readable.from(Buffer.from(pdfBytes))
  const uploadResp = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: pdfStream },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })
  const fileId = uploadResp.data.id
  const fileLink = uploadResp.data.webViewLink

  // 3) Also upload each raw photo as a sibling for archival purposes.
  const attachments: { name: string; fileId: string; webViewLink?: string | null }[] = []
  if (body.photos && body.photos.length) {
    // Nest photos in a sub-folder named with the event ID for easy grouping.
    const eventFolderId = await getOrCreateChildFolder(drive, folderId, eventId)
    let idx = 0
    for (const ph of body.photos) {
      idx++
      try {
        const bytes = Buffer.from(ph.base64, 'base64')
        const mime = detectImageMime(ph.base64)
        const ext = mime === 'image/png' ? 'png' : 'jpg'
        const photoName = `photo-${idx}.${ext}`
        const stream = Readable.from(bytes)
        const up = await drive.files.create({
          requestBody: { name: photoName, parents: [eventFolderId] },
          media: { mimeType: mime, body: stream },
          fields: 'id, webViewLink',
          supportsAllDrives: true,
        })
        attachments.push({ name: photoName, fileId: up.data.id!, webViewLink: up.data.webViewLink })
      } catch (e) {
        // Continue; the log row will still note attachment count.
      }
    }
  }

  // 4) Write the log row
  const inventoryUsedJson = JSON.stringify(body.inventory || [])
  const attachmentsJson = JSON.stringify(attachments)
  await sheets.spreadsheets.values.append({
    spreadsheetId: INVENTORY_ID,
    range: 'MaintenanceLog!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        eventId,
        ts,
        body.systemId,
        body.systemLabel,
        (body.kitIds || []).join(','),
        String(body.hoursAtService || ''),
        body.technician || '',
        body.notes || '',
        inventoryUsedJson,
        fileId || '',
        fileLink || '',
        attachmentsJson,
      ]],
    },
  })

  // 5) Bump the current-hours reading to at least this event's hours
  const hoursAtService = Number(body.hoursAtService)
  if (Number.isFinite(hoursAtService) && hoursAtService > 0) {
    const cur = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTORY_ID,
      range: 'MaintenanceHours!A:D',
    })
    const rows = cur.data.values || []
    let rowIdx = -1
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] || '').toString().trim() === body.systemId) { rowIdx = i; break }
    }
    const now = new Date().toISOString()
    const existing = rowIdx >= 0 ? Number(rows[rowIdx][1] || 0) : 0
    if (hoursAtService >= existing) {
      const newRow = [body.systemId, String(hoursAtService), now, body.technician || 'crew']
      if (rowIdx >= 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: INVENTORY_ID,
          range: `MaintenanceHours!A${rowIdx + 1}:D${rowIdx + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [newRow] },
        })
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID,
          range: 'MaintenanceHours!A:D',
          valueInputOption: 'RAW',
          requestBody: { values: [newRow] },
        })
      }
    }
  }

  return res.status(200).json({
    ok: true,
    eventId,
    fileId,
    fileLink,
    attachments,
    folderId,
  })
}

// ---------------- dispatcher ----------------

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb', // photos + PDFs can be chunky
    },
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const op = String(req.query.op || '').trim()

  try {
    if (op === 'list') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
      return await handleList(req, res)
    }
    if (op === 'system') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
      return await handleSystemState(req, res)
    }
    if (op === 'hours') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      return await handleUpdateHours(req, res)
    }
    if (op === 'log') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      return await handleLog(req, res)
    }
    return res.status(400).json({ error: 'op required: list | system | hours | log' })
  } catch (e: any) {
    console.error('maintenance error', e)
    return res.status(500).json({ error: 'internal', detail: e?.message || String(e) })
  }
}
