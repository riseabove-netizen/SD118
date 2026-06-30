/**
 * Shared PDF branding helper.
 *
 * Applies a consistent header (Rise Above wordmark), footer (boat profile
 * illustration), and page numbers to every page of a pdf-lib PDFDocument.
 *
 * USAGE:
 *   import { applyBranding } from '@/lib/pdfBranding'
 *   const pdf = await PDFDocument.create()
 *   // ... add pages and content ...
 *   await applyBranding(pdf)  // call once, just before pdf.save()
 *   return pdf.save()
 *
 * Designed to be called after all content is laid out. The branding draws
 * INTO the existing margins of each page, so PDF builders should reserve
 * roughly 50pt of top margin and 60pt of bottom margin for clean spacing.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
  RISE_ABOVE_LOGO_PNG_BASE64,
  RISE_ABOVE_BOAT_PNG_BASE64,
  RISE_ABOVE_LOGO_PNG_W,
  RISE_ABOVE_LOGO_PNG_H,
  RISE_ABOVE_BOAT_PNG_W,
  RISE_ABOVE_BOAT_PNG_H,
} from './pdfAssets'

function b64ToBytes(b64: string): Uint8Array {
  // Works in browser AND in Vercel serverless (Node).
  if (typeof atob !== 'undefined') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  // Node fallback
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

export interface BrandingOptions {
  /** Override the right-aligned header text. Defaults to "M/Y Rise Above". */
  vesselLabel?: string
  /** Set to false to hide the page number row entirely. Default true. */
  pageNumbers?: boolean
  /** Set to false to skip footer boat image (e.g. for very small page sizes). Default true. */
  showFooter?: boolean
}

/**
 * Draw the Rise Above logo (top-left), vessel label (top-right), boat
 * illustration (bottom-center) and page number (bottom-right) on every page.
 *
 * Safe to call multiple times — does not duplicate; each call adds another
 * overlay. Only call once per PDFDocument lifecycle.
 */
export async function applyBranding(pdf: PDFDocument, opts: BrandingOptions = {}): Promise<void> {
  const { vesselLabel = 'M/Y Rise Above', pageNumbers = true, showFooter = true } = opts

  const logoImg = await pdf.embedPng(b64ToBytes(RISE_ABOVE_LOGO_PNG_BASE64))
  const boatImg = showFooter ? await pdf.embedPng(b64ToBytes(RISE_ABOVE_BOAT_PNG_BASE64)) : null
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const ink = rgb(0.06, 0.07, 0.09)
  const muted = rgb(0.45, 0.47, 0.5)
  const ruleColor = rgb(0.85, 0.85, 0.85)

  const pages = pdf.getPages()
  const total = pages.length
  for (let i = 0; i < total; i++) {
    const page = pages[i]
    const w = page.getWidth()
    const h = page.getHeight()
    const margin = 36

    // ----- Header: logo top-left, vessel label top-right, hairline rule below
    const logoH = 18 // displayed height in PDF points
    const logoW = (RISE_ABOVE_LOGO_PNG_W / RISE_ABOVE_LOGO_PNG_H) * logoH
    const headerY = h - margin / 2 - logoH
    page.drawImage(logoImg, {
      x: margin,
      y: headerY,
      width: logoW,
      height: logoH,
    })
    // Vessel label, baseline-aligned with the wordmark
    const labelSize = 9
    page.drawText(vesselLabel, {
      x: w - margin - helv.widthOfTextAtSize(vesselLabel, labelSize),
      y: headerY + 4,
      size: labelSize,
      font: helv,
      color: muted,
    })
    // Hairline rule just under header
    page.drawLine({
      start: { x: margin, y: headerY - 4 },
      end: { x: w - margin, y: headerY - 4 },
      color: ruleColor,
      thickness: 0.4,
    })

    // ----- Footer: large boat illustration centered, page number + vessel
    // name on a meta row above it.
    const boatBaseY = 12 // boat sits ~12pt above page bottom
    const boatH = 38 // displayed height in PDF points (bumped from 22pt)
    const boatW = boatImg ? (RISE_ABOVE_BOAT_PNG_W / RISE_ABOVE_BOAT_PNG_H) * boatH : 0
    if (boatImg) {
      page.drawImage(boatImg, {
        x: (w - boatW) / 2,
        y: boatBaseY,
        width: boatW,
        height: boatH,
      })
    }
    // Meta row (vessel + page number) sits above the boat illustration
    const metaY = boatBaseY + boatH + 6
    // Hairline rule above the meta row
    page.drawLine({
      start: { x: margin, y: metaY + 10 },
      end: { x: w - margin, y: metaY + 10 },
      color: ruleColor,
      thickness: 0.4,
    })
    if (pageNumbers) {
      const pageText = `Page ${i + 1} of ${total}`
      const pageSize = 8
      page.drawText(pageText, {
        x: w - margin - helv.widthOfTextAtSize(pageText, pageSize),
        y: metaY,
        size: pageSize,
        font: helvBold,
        color: muted,
      })
      // Left side: vessel name in footer (small)
      page.drawText('M/Y Rise Above', {
        x: margin,
        y: metaY,
        size: pageSize,
        font: helv,
        color: muted,
      })
    }
  }
}

/**
 * Reserve top/bottom margins so branding doesn't collide with content.
 * Use these constants in the page-content loop of each PDF builder.
 *
 * Footer now needs more room because the boat illustration is ~38pt tall and
 * sits below a meta row with hairline rule (~16pt). 80pt gives a clean gap
 * between content and footer.
 */
export const PDF_BRANDING_TOP_MARGIN = 56 // top margin reserved for header band
export const PDF_BRANDING_BOTTOM_MARGIN = 80 // bottom margin reserved for footer band
