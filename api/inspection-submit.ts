import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
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

const RUNNING_LOG_ID = cleanEnv(process.env.SPREADSHEET_ID)
const FOLDER_ID = cleanEnv(process.env.INSPECTIONS_FOLDER_ID)

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

type CheckItem = { label: string; ok: boolean }
type PhotoItem = { label: string; base64: string }

type Section = {
  title: string
  checks: CheckItem[]
  photos: PhotoItem[]
  comments: string
}

type InspectionBody = {
  user: string
  timestamp: string
  coordinates?: {
    lat: string
    lon: string
    formatted: string
  }
  generator: {
    running: 'Port' | 'Starboard' | 'Both' | 'None' | ''
    portHours: string
    stbdHours: string
  }
  sections: Section[]
}

function detectImageMime(b64: string): 'image/jpeg' | 'image/png' {
  try {
    const head = atob(b64.slice(0, 16))
    if (head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8) return 'image/jpeg'
    if (head.charCodeAt(0) === 0x89 && head.charCodeAt(1) === 0x50) return 'image/png'
  } catch {}
  return 'image/jpeg'
}

async function buildPdf(body: InspectionBody, inspectionId: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const margin = 40
  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const contentWidth = pageWidth - margin * 2

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function drawText(text: string, opts: { font?: any; size?: number; color?: any; gap?: number } = {}) {
    const f = opts.font || font
    const size = opts.size || 11
    const color = opts.color || rgb(0, 0, 0)
    const lineHeight = size * 1.3

    // wrap
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      const width = f.widthOfTextAtSize(test, size)
      if (width > contentWidth && line) {
        lines.push(line)
        line = w
      } else {
        line = test
      }
    }
    if (line) lines.push(line)

    for (const ln of lines) {
      ensureSpace(lineHeight + 2)
      y -= lineHeight
      page.drawText(ln, { x: margin, y, size, font: f, color })
    }
    y -= (opts.gap ?? 4)
  }

  function drawDivider() {
    ensureSpace(12)
    y -= 6
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    })
    y -= 6
  }

  // Header
  drawText('M/Y Rise Above — Engine Room Inspection', { font: bold, size: 18, color: rgb(0.7, 0.1, 0.1), gap: 6 })
  drawText(`Date: ${new Date(body.timestamp).toLocaleString()}`, { size: 10, color: rgb(0.3, 0.3, 0.3), gap: 2 })
  drawText(`Inspector: ${body.user || '—'}`, { size: 10, color: rgb(0.3, 0.3, 0.3), gap: 2 })
  const coordLine =
    body.coordinates?.formatted ||
    (body.coordinates?.lat && body.coordinates?.lon
      ? `${body.coordinates.lat}, ${body.coordinates.lon}`
      : '')
  if (coordLine) {
    drawText(`Coordinates: ${coordLine}`, { size: 10, color: rgb(0.3, 0.3, 0.3), gap: 2 })
  }
  drawText(`Inspection ID: ${inspectionId}`, { size: 10, color: rgb(0.3, 0.3, 0.3), gap: 2 })

  // Generator summary
  drawDivider()
  drawText('Generator Status', { font: bold, size: 13, gap: 4 })
  drawText(`Running: ${body.generator.running || '—'}`, { size: 11 })
  drawText(`Port gen hours: ${body.generator.portHours || '—'}`, { size: 11 })
  drawText(`STBD gen hours: ${body.generator.stbdHours || '—'}`, { size: 11, gap: 8 })

  // Sections
  for (const section of body.sections) {
    drawDivider()
    drawText(section.title, { font: bold, size: 14, color: rgb(0.7, 0.1, 0.1), gap: 6 })

    if (section.checks.length > 0) {
      drawText('Checks', { font: bold, size: 11, gap: 2 })
      for (const c of section.checks) {
        const mark = c.ok ? '[OK]' : '[ISSUE]'
        const color = c.ok ? rgb(0.1, 0.5, 0.1) : rgb(0.8, 0.1, 0.1)
        ensureSpace(14)
        y -= 13
        page.drawText(mark, { x: margin, y, size: 10, font: bold, color })
        const labelText = '  ' + c.label
        page.drawText(labelText, { x: margin + 50, y, size: 10, font })
      }
      y -= 6
    }

    if (section.comments && section.comments.trim()) {
      drawText('Comments', { font: bold, size: 11, gap: 2 })
      drawText(section.comments, { size: 10, gap: 6 })
    }

    if (section.photos.length > 0) {
      drawText('Photos', { font: bold, size: 11, gap: 4 })
      for (const photo of section.photos) {
        try {
          const mime = detectImageMime(photo.base64)
          const bytes = new Uint8Array(Buffer.from(photo.base64, 'base64'))
          const img = mime === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
          // Fit image to contentWidth max, max height 360
          const maxW = contentWidth
          const maxH = 360
          const scale = Math.min(maxW / img.width, maxH / img.height, 1)
          const w = img.width * scale
          const h = img.height * scale

          ensureSpace(h + 22)
          y -= 14
          page.drawText(photo.label, { x: margin, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) })
          y -= h + 4
          page.drawImage(img, { x: margin, y, width: w, height: h })
          y -= 8
        } catch (e) {
          drawText(`(could not embed photo: ${photo.label})`, { size: 9, color: rgb(0.6, 0.1, 0.1) })
        }
      }
    }
  }

  return await pdf.save()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!RUNNING_LOG_ID || !FOLDER_ID) {
    return res.status(500).json({
      error: 'Server not configured',
      detail: `Missing env: ${!RUNNING_LOG_ID ? 'SPREADSHEET_ID ' : ''}${!FOLDER_ID ? 'INSPECTIONS_FOLDER_ID' : ''}`,
    })
  }

  const body = req.body as InspectionBody
  if (!body || !Array.isArray(body.sections)) {
    return res.status(400).json({ error: 'Invalid body' })
  }

  const inspectionId = 'INS-' + Date.now().toString(36)
  const ts = body.timestamp || new Date().toISOString()
  const dt = new Date(ts)
  const dateStr = dt.toISOString().slice(0, 10)
  const timeStr = dt.toTimeString().slice(0, 5)

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const drive = google.drive({ version: 'v3', auth })

    // 1) Build PDF
    const pdfBytes = await buildPdf(body, inspectionId)

    // 2) Upload PDF to Drive
    const fileName = `Rise Above — Engine Room Inspection — ${dateStr} ${timeStr.replace(':', '')}.pdf`
    const fileMeta = {
      name: fileName,
      parents: [FOLDER_ID],
    }

    const pdfStream = Readable.from(Buffer.from(pdfBytes))
    const uploadResp = await drive.files.create({
      requestBody: fileMeta,
      media: {
        mimeType: 'application/pdf',
        body: pdfStream,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })

    const fileId = uploadResp.data.id
    const fileLink = uploadResp.data.webViewLink

    // 3) Write generator row to Running Log spreadsheet (Generator Log tab)
    // Always write a row — even with no generator data — so every inspection is
    // discoverable in the sheet with its date/coords/PDF link.
    const genRow = [
      dateStr,
      timeStr,
      body.generator.running || '',
      body.generator.portHours || '',
      body.generator.stbdHours || '',
      body.coordinates?.lat || '',
      body.coordinates?.lon || '',
      'Engine Room Inspection',
      body.user || '',
      inspectionId,
      fileLink || '',
    ]
    await sheets.spreadsheets.values.append({
      spreadsheetId: RUNNING_LOG_ID,
      range: 'Generator Log!A:A',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [genRow] },
    })

    return res.status(200).json({
      ok: true,
      inspectionId,
      pdfFileId: fileId,
      pdfLink: fileLink,
    })
  } catch (error: any) {
    console.error('inspection-submit error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to submit inspection', detail })
  }
}