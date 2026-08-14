// Client-side PDF export for the Purchase List.
//
// Uses pdf-lib (already bundled) so the PDF is built in-browser and offered
// as a download — no server round-trip. Layout mirrors the vessel's
// maintenance PDFs (Helvetica, red rule lines, boat header).

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import type { PurchaseItem } from '@/lib/purchase-list-api'

const RED = rgb(0.85, 0.15, 0.15)
const DARK = rgb(0.12, 0.12, 0.12)
const GREY = rgb(0.45, 0.45, 0.45)
const LIGHT_GREY = rgb(0.85, 0.85, 0.85)

interface ExportOpts {
  preparedBy?: string
  title?: string
}

interface Ctx {
  pdf: PDFDocument
  font: PDFFont
  bold: PDFFont
  page: PDFPage
  y: number
  pageNum: number
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.pdf.addPage([595.28, 841.89]) // A4
  ctx.pageNum++
  ctx.y = 800
  drawHeader(ctx)
}

function drawHeader(ctx: Ctx): void {
  const { page, bold, font } = ctx
  const width = page.getWidth()
  // Boat name banner
  page.drawText('M/Y RISE ABOVE', {
    x: 40, y: 810, size: 14, font: bold, color: DARK,
  })
  page.drawText('Purchase List', {
    x: width - 40 - font.widthOfTextAtSize('Purchase List', 11), y: 813, size: 11, font, color: GREY,
  })
  page.drawLine({
    start: { x: 40, y: 800 },
    end: { x: width - 40, y: 800 },
    thickness: 1.5, color: RED,
  })
  ctx.y = 780
}

function drawFooter(ctx: Ctx): void {
  const { page, font } = ctx
  const width = page.getWidth()
  const foot = `Page ${ctx.pageNum} · Generated ${new Date().toLocaleString()}`
  page.drawText(foot, {
    x: 40, y: 25, size: 8, font, color: GREY,
  })
  page.drawLine({
    start: { x: 40, y: 40 },
    end: { x: width - 40, y: 40 },
    thickness: 0.5, color: LIGHT_GREY,
  })
}

function ensureRoom(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < 60) {
    drawFooter(ctx)
    newPage(ctx)
  }
}

function drawWrappedText(
  ctx: Ctx,
  text: string,
  x: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
  color = DARK,
): void {
  const words = text.split(/\s+/)
  let line = ''
  const lineHeight = size + 3
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    const width = font.widthOfTextAtSize(test, size)
    if (width > maxWidth && line) {
      ensureRoom(ctx, lineHeight)
      ctx.page.drawText(line, { x, y: ctx.y, size, font, color })
      ctx.y -= lineHeight
      line = w
    } else {
      line = test
    }
  }
  if (line) {
    ensureRoom(ctx, lineHeight)
    ctx.page.drawText(line, { x, y: ctx.y, size, font, color })
    ctx.y -= lineHeight
  }
}

function download(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function exportPurchaseListPDF(
  items: PurchaseItem[],
  opts: ExportOpts = {},
): Promise<void> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ctx: Ctx = {
    pdf,
    font,
    bold,
    page: pdf.addPage([595.28, 841.89]),
    y: 800,
    pageNum: 1,
  }
  drawHeader(ctx)

  const width = ctx.page.getWidth()

  // Title / meta block
  const title = opts.title || 'Purchase List'
  ctx.page.drawText(title, { x: 40, y: ctx.y, size: 18, font: bold, color: DARK })
  ctx.y -= 22

  const now = new Date()
  const metaLines = [
    `Generated: ${now.toLocaleString()}`,
    opts.preparedBy ? `Prepared by: ${opts.preparedBy}` : '',
    `Items: ${items.length}`,
  ].filter(Boolean)
  for (const l of metaLines) {
    ctx.page.drawText(l, { x: 40, y: ctx.y, size: 9, font, color: GREY })
    ctx.y -= 12
  }
  ctx.y -= 8

  // Column headers
  const cols = {
    hash: 40,
    name: 70,
    partNumber: 320,
    qty: 460,
    status: 500,
  }
  const rowH = 18

  function drawTableHeader() {
    ctx.page.drawLine({
      start: { x: 40, y: ctx.y + 4 },
      end: { x: width - 40, y: ctx.y + 4 },
      thickness: 0.75, color: DARK,
    })
    ctx.page.drawText('#', { x: cols.hash, y: ctx.y - 10, size: 9, font: bold, color: DARK })
    ctx.page.drawText('Item', { x: cols.name, y: ctx.y - 10, size: 9, font: bold, color: DARK })
    ctx.page.drawText('Part number', { x: cols.partNumber, y: ctx.y - 10, size: 9, font: bold, color: DARK })
    ctx.page.drawText('Qty', { x: cols.qty, y: ctx.y - 10, size: 9, font: bold, color: DARK })
    ctx.page.drawText('Status', { x: cols.status, y: ctx.y - 10, size: 9, font: bold, color: DARK })
    ctx.y -= 16
    ctx.page.drawLine({
      start: { x: 40, y: ctx.y + 3 },
      end: { x: width - 40, y: ctx.y + 3 },
      thickness: 0.5, color: LIGHT_GREY,
    })
    ctx.y -= 4
  }

  drawTableHeader()

  // Rows
  let n = 0
  for (const it of items) {
    n++
    ensureRoom(ctx, rowH + 4)
    // Truncate/wrap the name column
    const nameSize = 10
    const nameCol = it.Name || '(unnamed)'
    const maxNameChars = 42
    const nameShort = nameCol.length > maxNameChars ? nameCol.slice(0, maxNameChars - 1) + '…' : nameCol
    ctx.page.drawText(String(n), { x: cols.hash, y: ctx.y, size: 9, font, color: GREY })
    ctx.page.drawText(nameShort, { x: cols.name, y: ctx.y, size: nameSize, font, color: DARK })
    if (it.PartNumber) {
      const pn = it.PartNumber.length > 18 ? it.PartNumber.slice(0, 17) + '…' : it.PartNumber
      ctx.page.drawText(pn, { x: cols.partNumber, y: ctx.y, size: 9, font, color: DARK })
    } else {
      ctx.page.drawText('—', { x: cols.partNumber, y: ctx.y, size: 9, font, color: LIGHT_GREY })
    }
    ctx.page.drawText(String(it.Qty || 1), { x: cols.qty, y: ctx.y, size: 9, font, color: DARK })
    const status = (it.Status || 'open').toLowerCase() === 'received' ? 'RECV' : 'OPEN'
    ctx.page.drawText(status, {
      x: cols.status, y: ctx.y, size: 9, font: bold,
      color: status === 'RECV' ? rgb(0.15, 0.55, 0.25) : RED,
    })
    ctx.y -= 12

    // Notes as secondary line
    if (it.Notes && it.Notes.trim()) {
      drawWrappedText(ctx, it.Notes, cols.name, width - cols.name - 40, 8, font, GREY)
    }
    // Received-detail line
    if ((it.Status || '').toLowerCase() === 'received' && it.StorageLocation) {
      const loc = [it.StorageLocation, it.SubLocation].filter(Boolean).join(' / ')
      const rcv = it.ReceivedAt ? ` · ${new Date(it.ReceivedAt).toLocaleDateString()}` : ''
      ctx.page.drawText(`Received: ${loc}${rcv}`, {
        x: cols.name, y: ctx.y, size: 8, font, color: GREY,
      })
      ctx.y -= 10
    }

    // Row separator
    ctx.page.drawLine({
      start: { x: 40, y: ctx.y + 2 },
      end: { x: width - 40, y: ctx.y + 2 },
      thickness: 0.25, color: LIGHT_GREY,
    })
    ctx.y -= 6
  }

  // Signature block
  ensureRoom(ctx, 90)
  ctx.y -= 20
  ctx.page.drawText('Vendor / notes:', { x: 40, y: ctx.y, size: 9, font: bold, color: DARK })
  ctx.y -= 14
  for (let i = 0; i < 3; i++) {
    ctx.page.drawLine({
      start: { x: 40, y: ctx.y },
      end: { x: width - 40, y: ctx.y },
      thickness: 0.5, color: LIGHT_GREY,
    })
    ctx.y -= 16
  }

  ensureRoom(ctx, 60)
  ctx.y -= 10
  const sigY = ctx.y
  ctx.page.drawLine({
    start: { x: 40, y: sigY }, end: { x: 250, y: sigY },
    thickness: 0.75, color: DARK,
  })
  ctx.page.drawLine({
    start: { x: width - 250, y: sigY }, end: { x: width - 40, y: sigY },
    thickness: 0.75, color: DARK,
  })
  ctx.y -= 12
  ctx.page.drawText('Ordered by', { x: 40, y: ctx.y, size: 8, font, color: GREY })
  ctx.page.drawText('Received by / date', { x: width - 250, y: ctx.y, size: 8, font, color: GREY })

  drawFooter(ctx)

  const bytes = await pdf.save()
  const stamp = new Date().toISOString().slice(0, 10)
  download(bytes, `purchase-list_${stamp}.pdf`)
}
