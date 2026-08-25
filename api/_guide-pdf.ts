// Server-side PDF renderer for operational guides.
// Uses pdf-lib (already a dep) — no headless Chrome needed.
//
// Renders a subset of GitHub-flavored Markdown:
//   - # H1 / ## H2 / ### H3 headings
//   - Paragraphs with **bold** spans
//   - Ordered ("1.") and unordered ("-") lists (nested one level via "   -")
//   - Blockquotes ("> …") rendered as callout boxes
//   - Inline images (![alt](url)) fetched and embedded as JPEGs/PNGs
//   - Horizontal rules ("---")
//
// The design mirrors the printable HTML in src/lib/guide-share.ts:
//   * Red accent (#b91c1c) header rule
//   * "M/Y RISE ABOVE · OPERATIONAL GUIDE" small caps
//   * Title h1, meta pills (category · v… · updated …)
//   * A4 page with generous margins

import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFPage,
} from 'pdf-lib'

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = { top: 46, right: 40, bottom: 46, left: 40 }

const RED = rgb(0xb9 / 255, 0x1c / 255, 0x1c / 255)
const INK = rgb(0x11 / 255, 0x11 / 255, 0x11 / 255)
const MUTED = rgb(0x55 / 255, 0x55 / 255, 0x55 / 255)
const RULE = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255)
const CALLOUT_BG = rgb(0xfe / 255, 0xf2 / 255, 0xf2 / 255)
const CALLOUT_INK = rgb(0x7f / 255, 0x1d / 255, 0x1d / 255)

export interface GuidePdfInput {
  title: string
  category: string
  version: string | number
  updatedAt: string
  updatedBy: string
  markdown: string
}

interface Ctx {
  doc: PDFDocument
  page: PDFPage
  y: number
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([A4.width, A4.height])
  ctx.y = A4.height - MARGIN.top
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN.bottom) {
    newPage(ctx)
  }
}

// Wrap plain text by width. Returns array of lines.
function wrapText(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  if (!text) return ['']
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial
    } else {
      if (cur) lines.push(cur)
      // If the single word is wider than maxWidth, hard-break it
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = ''
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
            chunk += ch
          } else {
            lines.push(chunk)
            chunk = ch
          }
        }
        cur = chunk
      } else {
        cur = w
      }
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// Draw a bold/regular styled line with **spans**. Returns lines drawn (for wrapping the whole paragraph).
function tokenizeBold(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = []
  const re = /\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false })
    parts.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false })
  return parts
}

// Wrap tokenized (bold-run) text by width. Returns lines of tokens.
function wrapTokens(
  regular: PDFFont,
  bold: PDFFont,
  size: number,
  tokens: { text: string; bold: boolean }[],
  maxWidth: number,
): { text: string; bold: boolean }[][] {
  const lines: { text: string; bold: boolean }[][] = [[]]
  let curWidth = 0
  const space = regular.widthOfTextAtSize(' ', size)

  for (const tok of tokens) {
    const font = tok.bold ? bold : regular
    // Split on whitespace but keep runs intact within a token
    const words = tok.text.split(/(\s+)/) // keep separators
    for (const w of words) {
      if (!w) continue
      const isSpace = /^\s+$/.test(w)
      if (isSpace) {
        if (curWidth === 0) continue // leading space on line: skip
        // Just append a single space to current line
        const last = lines[lines.length - 1]
        last.push({ text: ' ', bold: tok.bold })
        curWidth += space
        continue
      }
      const wWidth = font.widthOfTextAtSize(w, size)
      if (curWidth + wWidth <= maxWidth) {
        lines[lines.length - 1].push({ text: w, bold: tok.bold })
        curWidth += wWidth
      } else {
        // wrap
        // trim trailing space on prior line
        const prev = lines[lines.length - 1]
        while (prev.length && /^\s+$/.test(prev[prev.length - 1].text)) prev.pop()
        lines.push([{ text: w, bold: tok.bold }])
        curWidth = wWidth
      }
    }
  }
  // trim trailing space on last line
  const prev = lines[lines.length - 1]
  while (prev.length && /^\s+$/.test(prev[prev.length - 1].text)) prev.pop()
  return lines.filter(l => l.length > 0 || lines.length === 1)
}

function drawTokenizedLine(ctx: Ctx, line: { text: string; bold: boolean }[], x: number, size: number) {
  let cursorX = x
  for (const tok of line) {
    const font = tok.bold ? ctx.bold : ctx.regular
    ctx.page.drawText(tok.text, {
      x: cursorX,
      y: ctx.y,
      size,
      font,
      color: INK,
    })
    cursorX += font.widthOfTextAtSize(tok.text, size)
  }
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    // Drive thumbnail URLs sometimes 302 to lh3; fetch follows by default in Node 18+.
    const resp = await fetch(url, { redirect: 'follow' })
    if (!resp.ok) return null
    const buf = new Uint8Array(await resp.arrayBuffer())
    const ct = resp.headers.get('content-type') || ''
    let mime = ct.split(';')[0].trim()
    // Sniff from bytes if server lied
    if (buf[0] === 0xff && buf[1] === 0xd8) mime = 'image/jpeg'
    else if (buf[0] === 0x89 && buf[1] === 0x50) mime = 'image/png'
    return { bytes: buf, mime }
  } catch {
    return null
  }
}

// ----- Text sanitisation -----
// pdf-lib Standard fonts only support WinAnsi. Replace common Unicode
// characters we know appear in guides (arrows, degree signs, emoji safety
// markers, curly quotes, en/em dashes) with WinAnsi-safe equivalents.
function sanitiseText(s: string): string {
  if (!s) return s
  return s
    // Arrows
    .replace(/[\u2192\u21D2\u27A1]/g, '->')  // → ⇒ ➡
    .replace(/[\u2190\u21D0]/g, '<-')
    .replace(/[\u2194\u21D4]/g, '<->')
    // Emoji safety markers used by the prettify prompt
    .replace(/\u26A0(?:\uFE0F)?/g, '[!]')      // ⚠️ warning
    .replace(/\uD83D\uDED1/g, '[STOP]')          // 🛑
    .replace(/\u2139(?:\uFE0F)?/g, '[i]')      // ℹ️ info
    .replace(/\uD83D\uDD25/g, '[FIRE]')
    .replace(/\uD83D\uDCA7/g, '[H2O]')
    // Bullets / middle dot
    .replace(/\u2022/g, '\u2022')                // U+2022 IS in WinAnsi
    .replace(/[\u00B7\u2027]/g, '·')
    // Curly quotes / apostrophes
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Dashes
    .replace(/[\u2013\u2014]/g, '\u2013')         // en-dash IS in WinAnsi
    // Ellipsis (in WinAnsi already at U+2026, kept)
    // Non-breaking space
    .replace(/\u00A0/g, ' ')
    // Any remaining variation selectors
    .replace(/[\uFE00-\uFE0F]/g, '')
    // Zero-width joiners / non-joiners
    .replace(/[\u200B-\u200D\u2060]/g, '')
    // Emoji surrogate pairs we didn't map explicitly -> drop
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
}

// ----- Markdown line classifier -----

type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ol'; items: { text: string; sub: string[] }[] }
  | { kind: 'ul'; items: { text: string; sub: string[] }[] }
  | { kind: 'quote'; text: string }
  | { kind: 'img'; alt: string; url: string }
  | { kind: 'hr' }

function parseMarkdown(mdRaw: string): Block[] {
  const md = sanitiseText(mdRaw)
  const lines = md.split(/\r?\n/)
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trimEnd()

    if (!line.trim()) {
      i++
      continue
    }
    // Headings
    let m = line.match(/^(#{1,3})\s+(.+)$/)
    if (m) {
      const level = m[1].length
      blocks.push({ kind: (`h${level}` as 'h1' | 'h2' | 'h3'), text: m[2].trim() })
      i++
      continue
    }
    // HR
    if (/^---+\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }
    // Image (standalone)
    m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/)
    if (m) {
      blocks.push({ kind: 'img', alt: m[1], url: m[2] })
      i++
      continue
    }
    // Blockquote (single or multi-line)
    if (line.startsWith('>')) {
      const parts: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        parts.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ kind: 'quote', text: parts.join(' ').trim() })
      continue
    }
    // Ordered list
    m = line.match(/^(\d+)\.\s+(.+)$/)
    if (m) {
      const items: { text: string; sub: string[] }[] = []
      while (i < lines.length) {
        const olMatch = lines[i].match(/^(\d+)\.\s+(.+)$/)
        if (olMatch) {
          items.push({ text: olMatch[2], sub: [] })
          i++
          // absorb sub-bullets (indented "  - ..." or "   - ...")
          while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
            items[items.length - 1].sub.push(lines[i].replace(/^\s{2,}[-*]\s+/, ''))
            i++
          }
        } else if (!lines[i].trim()) {
          i++
          // consecutive OL after blank? Check next non-blank
          let j = i
          while (j < lines.length && !lines[j].trim()) j++
          if (j < lines.length && /^\d+\.\s+/.test(lines[j])) {
            i = j
            continue
          } else {
            break
          }
        } else {
          break
        }
      }
      blocks.push({ kind: 'ol', items })
      continue
    }
    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: { text: string; sub: string[] }[] = []
      while (i < lines.length) {
        const ulMatch = lines[i].match(/^[-*]\s+(.+)$/)
        if (ulMatch) {
          items.push({ text: ulMatch[1], sub: [] })
          i++
          while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
            items[items.length - 1].sub.push(lines[i].replace(/^\s{2,}[-*]\s+/, ''))
            i++
          }
        } else if (!lines[i].trim()) {
          i++
          let j = i
          while (j < lines.length && !lines[j].trim()) j++
          if (j < lines.length && /^[-*]\s+/.test(lines[j])) {
            i = j
            continue
          } else {
            break
          }
        } else {
          break
        }
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    // Paragraph — collect until blank / heading / list
    const paraLines: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>\s|!\[|\d+\.\s|[-*]\s|---+\s*$)/.test(lines[i])) {
      paraLines.push(lines[i].trim())
      i++
    }
    blocks.push({ kind: 'p', text: paraLines.join(' ') })
  }
  return blocks
}

// ----- Rendering -----

function drawHeader(ctx: Ctx, inputRaw: GuidePdfInput) {
  const input: GuidePdfInput = {
    ...inputRaw,
    title: sanitiseText(inputRaw.title || ''),
    category: sanitiseText(inputRaw.category || ''),
    updatedBy: sanitiseText(inputRaw.updatedBy || ''),
  }
  const x = MARGIN.left
  const contentW = A4.width - MARGIN.left - MARGIN.right

  // small-caps kicker
  const kicker = 'M/Y RISE ABOVE · OPERATIONAL GUIDE'
  ctx.page.drawText(kicker, {
    x,
    y: ctx.y,
    size: 8,
    font: ctx.bold,
    color: RED,
  })
  ctx.y -= 24

  // title
  const titleLines = wrapText(ctx.bold, 22, input.title, contentW)
  for (const line of titleLines) {
    ctx.page.drawText(line, {
      x,
      y: ctx.y,
      size: 22,
      font: ctx.bold,
      color: INK,
    })
    ctx.y -= 24
  }

  // meta line
  const meta: string[] = []
  if (input.category) meta.push(input.category)
  if (input.version) meta.push(`v${input.version}`)
  if (input.updatedAt) {
    try {
      meta.push('Updated ' + new Date(input.updatedAt).toLocaleString())
    } catch {
      /* skip */
    }
  }
  if (input.updatedBy) meta.push('by ' + input.updatedBy)
  const metaStr = meta.join(' · ')
  if (metaStr) {
    ctx.page.drawText(metaStr, {
      x,
      y: ctx.y,
      size: 8.5,
      font: ctx.regular,
      color: MUTED,
    })
    ctx.y -= 8
  }

  ctx.y -= 4
  // red rule
  ctx.page.drawLine({
    start: { x, y: ctx.y },
    end: { x: A4.width - MARGIN.right, y: ctx.y },
    thickness: 1.5,
    color: RED,
  })
  ctx.y -= 14
}

async function drawBlocks(ctx: Ctx, blocks: Block[]) {
  const contentW = A4.width - MARGIN.left - MARGIN.right
  const x = MARGIN.left

  for (const block of blocks) {
    switch (block.kind) {
      case 'h2': {
        ensure(ctx, 26)
        ctx.y -= 6
        const lines = wrapText(ctx.bold, 14, block.text, contentW)
        for (const line of lines) {
          ctx.page.drawText(line, { x, y: ctx.y, size: 14, font: ctx.bold, color: INK })
          ctx.y -= 16
        }
        // subtle underline
        ctx.page.drawLine({
          start: { x, y: ctx.y + 4 },
          end: { x: A4.width - MARGIN.right, y: ctx.y + 4 },
          thickness: 0.5,
          color: RULE,
        })
        ctx.y -= 4
        break
      }
      case 'h3': {
        ensure(ctx, 20)
        ctx.y -= 4
        const lines = wrapText(ctx.bold, 12, block.text, contentW)
        for (const line of lines) {
          ctx.page.drawText(line, { x, y: ctx.y, size: 12, font: ctx.bold, color: INK })
          ctx.y -= 14
        }
        ctx.y -= 2
        break
      }
      case 'h1': {
        // Guides start with H1 title already in header — treat body H1 as H2
        ensure(ctx, 26)
        ctx.y -= 6
        const lines = wrapText(ctx.bold, 15, block.text, contentW)
        for (const line of lines) {
          ctx.page.drawText(line, { x, y: ctx.y, size: 15, font: ctx.bold, color: INK })
          ctx.y -= 18
        }
        ctx.y -= 2
        break
      }
      case 'p': {
        const tokens = tokenizeBold(block.text)
        const lines = wrapTokens(ctx.regular, ctx.bold, 10.5, tokens, contentW)
        for (const line of lines) {
          ensure(ctx, 14)
          drawTokenizedLine(ctx, line, x, 10.5)
          ctx.y -= 14
        }
        ctx.y -= 3
        break
      }
      case 'ol':
      case 'ul': {
        for (let i = 0; i < block.items.length; i++) {
          const item = block.items[i]
          const marker = block.kind === 'ol' ? `${i + 1}.` : '•'
          const markerWidth = ctx.bold.widthOfTextAtSize(marker, 10.5)
          const indent = 18
          const tokens = tokenizeBold(item.text)
          const lines = wrapTokens(ctx.regular, ctx.bold, 10.5, tokens, contentW - indent)
          for (let li = 0; li < lines.length; li++) {
            ensure(ctx, 14)
            if (li === 0) {
              ctx.page.drawText(marker, {
                x,
                y: ctx.y,
                size: 10.5,
                font: ctx.bold,
                color: block.kind === 'ol' ? RED : INK,
              })
            }
            drawTokenizedLine(ctx, lines[li], x + indent, 10.5)
            ctx.y -= 14
          }
          for (const sub of item.sub) {
            const subTokens = tokenizeBold(sub)
            const subLines = wrapTokens(ctx.regular, ctx.bold, 10, subTokens, contentW - indent - 14)
            for (const subLine of subLines) {
              ensure(ctx, 13)
              ctx.page.drawText('–', { x: x + indent, y: ctx.y, size: 10, font: ctx.regular, color: MUTED })
              drawTokenizedLine(ctx, subLine, x + indent + 14, 10)
              ctx.y -= 13
            }
          }
        }
        ctx.y -= 3
        break
      }
      case 'quote': {
        const tokens = tokenizeBold(block.text)
        const innerW = contentW - 16
        const lines = wrapTokens(ctx.regular, ctx.bold, 10.5, tokens, innerW)
        const boxH = lines.length * 14 + 10
        ensure(ctx, boxH + 4)
        // background
        ctx.page.drawRectangle({
          x,
          y: ctx.y - boxH + 8,
          width: contentW,
          height: boxH,
          color: CALLOUT_BG,
        })
        // left bar
        ctx.page.drawRectangle({
          x,
          y: ctx.y - boxH + 8,
          width: 3,
          height: boxH,
          color: RED,
        })
        // text
        const savedY = ctx.y
        ctx.y = savedY - 4
        for (const line of lines) {
          // Draw with callout ink color
          let cursorX = x + 12
          for (const tok of line) {
            const font = tok.bold ? ctx.bold : ctx.regular
            ctx.page.drawText(tok.text, {
              x: cursorX,
              y: ctx.y,
              size: 10.5,
              font,
              color: CALLOUT_INK,
            })
            cursorX += font.widthOfTextAtSize(tok.text, 10.5)
          }
          ctx.y -= 14
        }
        ctx.y -= 4
        break
      }
      case 'img': {
        const fetched = await fetchImage(block.url)
        if (!fetched) {
          // Placeholder
          ensure(ctx, 18)
          ctx.page.drawText(`[image failed: ${block.alt || block.url}]`, {
            x,
            y: ctx.y,
            size: 9,
            font: ctx.italic,
            color: MUTED,
          })
          ctx.y -= 14
          break
        }
        let img
        try {
          img = fetched.mime === 'image/png'
            ? await ctx.doc.embedPng(fetched.bytes)
            : await ctx.doc.embedJpg(fetched.bytes)
        } catch {
          // Try the other decoder if magic-byte sniff was wrong
          try {
            img = fetched.mime === 'image/png'
              ? await ctx.doc.embedJpg(fetched.bytes)
              : await ctx.doc.embedPng(fetched.bytes)
          } catch {
            ensure(ctx, 18)
            ctx.page.drawText(`[image unsupported: ${block.alt || block.url}]`, {
              x, y: ctx.y, size: 9, font: ctx.italic, color: MUTED,
            })
            ctx.y -= 14
            break
          }
        }
        // Scale to fit content width, cap height so a single image doesn't dominate a page
        const maxImgW = contentW
        const maxImgH = 320
        let iw = img.width
        let ih = img.height
        const scaleW = maxImgW / iw
        const scaleH = maxImgH / ih
        const scale = Math.min(scaleW, scaleH, 1)
        iw = iw * scale
        ih = ih * scale
        ensure(ctx, ih + 8)
        ctx.page.drawImage(img, {
          x: x + (contentW - iw) / 2,
          y: ctx.y - ih,
          width: iw,
          height: ih,
        })
        ctx.y -= ih + 8
        if (block.alt) {
          ensure(ctx, 12)
          ctx.page.drawText(block.alt, {
            x,
            y: ctx.y,
            size: 8.5,
            font: ctx.italic,
            color: MUTED,
          })
          ctx.y -= 12
        }
        ctx.y -= 4
        break
      }
      case 'hr': {
        ensure(ctx, 8)
        ctx.page.drawLine({
          start: { x, y: ctx.y },
          end: { x: A4.width - MARGIN.right, y: ctx.y },
          thickness: 0.5,
          color: RULE,
        })
        ctx.y -= 10
        break
      }
    }
  }
}

function drawFooterAll(ctx: Ctx, inputRaw: GuidePdfInput) {
  const pages = ctx.doc.getPages()
  const now = new Date().toLocaleString()
  const title = sanitiseText(inputRaw.title || '')
  const kicker = `M/Y Rise Above · ${title}` +
    (inputRaw.version ? ` · Rev ${inputRaw.version}` : '') +
    ` · generated ${now}`
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    p.drawLine({
      start: { x: MARGIN.left, y: MARGIN.bottom - 12 },
      end: { x: A4.width - MARGIN.right, y: MARGIN.bottom - 12 },
      thickness: 0.4,
      color: RULE,
    })
    p.drawText(kicker, {
      x: MARGIN.left,
      y: MARGIN.bottom - 24,
      size: 7.5,
      font: ctx.regular,
      color: MUTED,
    })
    const pageLabel = `Page ${i + 1} of ${pages.length}`
    const w = ctx.regular.widthOfTextAtSize(pageLabel, 7.5)
    p.drawText(pageLabel, {
      x: A4.width - MARGIN.right - w,
      y: MARGIN.bottom - 24,
      size: 7.5,
      font: ctx.regular,
      color: MUTED,
    })
  }
}

export async function renderGuidePdf(input: GuidePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`M/Y Rise Above — ${input.title}`)
  doc.setAuthor('Rise Above Operations')
  doc.setSubject(input.category || 'Operational Guide')
  doc.setCreator('Rise Above Operations app')
  doc.setProducer('pdf-lib')
  doc.setCreationDate(new Date())

  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)

  const firstPage = doc.addPage([A4.width, A4.height])
  const ctx: Ctx = {
    doc,
    page: firstPage,
    y: A4.height - MARGIN.top,
    regular,
    bold,
    italic,
  }

  drawHeader(ctx, input)

  // Strip a leading H1 (guides typically start with one; header shows the title already)
  const rawMd = (input.markdown || '').replace(/^\s*#\s+.+\n+/, '')
  const blocks = parseMarkdown(rawMd)
  await drawBlocks(ctx, blocks)

  drawFooterAll(ctx, input)

  return await doc.save()
}
