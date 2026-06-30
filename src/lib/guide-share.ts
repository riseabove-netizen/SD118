// Share/PDF helpers for Operational Guides.
// Uses native Web Share API where available (iOS/Android share sheets),
// falls back to clipboard copy. PDF is generated via a hidden iframe
// rendered with print-friendly CSS — user picks "Save as PDF" from the
// system print dialog. Works on iOS Safari, macOS Safari, Chrome, etc.

import { marked } from 'marked'

export type ShareLinkResult = 'shared' | 'copied' | 'failed'

export async function shareGuideLink(args: { title: string; url: string }): Promise<ShareLinkResult> {
  const { title, url } = args
  // Web Share API (iOS Safari, Android Chrome, recent desktop browsers)
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, text: title, url })
      return 'shared'
    } catch (err: any) {
      // user cancelled — treat as silent success
      if (err?.name === 'AbortError') return 'shared'
      // fall through to clipboard
    }
  }
  // Clipboard fallback
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(url)
      return 'copied'
    }
  } catch {
    /* swallow */
  }
  // Last resort: legacy execCommand
  try {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok ? 'copied' : 'failed'
  } catch {
    return 'failed'
  }
}

export interface PrintGuideArgs {
  title: string
  category: string
  version: string | number
  updatedAt: string
  updatedBy: string
  markdown: string
}

export function printGuideAsPdf(g: PrintGuideArgs) {
  const html = buildPrintableHtml(g)

  // Create a hidden iframe, write the document, then print it.
  // Using an iframe (rather than window.open) avoids popup blockers
  // and keeps the print dialog scoped to the guide content only.
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    // Fallback: open in new window
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 600)
    }
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Wait for images to load before triggering print so they appear in the PDF
  const win = iframe.contentWindow
  if (!win) return

  const triggerPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      /* ignore */
    }
    // Remove the iframe a moment after the print dialog closes
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 1000)
  }

  const imgs = Array.from(doc.images)
  if (imgs.length === 0) {
    setTimeout(triggerPrint, 200)
    return
  }
  let pending = imgs.length
  let done = false
  const finish = () => {
    if (done) return
    pending -= 1
    if (pending <= 0) {
      done = true
      setTimeout(triggerPrint, 150)
    }
  }
  imgs.forEach(img => {
    if (img.complete) finish()
    else {
      img.addEventListener('load', finish)
      img.addEventListener('error', finish)
    }
  })
  // Safety timeout — print anyway after 8s even if some images stall
  setTimeout(() => {
    if (!done) {
      done = true
      triggerPrint()
    }
  }, 8000)
}

function buildPrintableHtml(g: PrintGuideArgs): string {
  const bodyHtml = renderMarkdownForPrint(g.markdown)
  const updated = g.updatedAt ? new Date(g.updatedAt).toLocaleString() : ''
  const safeTitle = escapeHtml(g.title || 'Operational Guide')
  const safeCategory = escapeHtml(g.category || '')
  const safeUpdatedBy = escapeHtml(g.updatedBy || '')
  const updatedSafe = escapeHtml(updated)
  const versionSafe = escapeHtml(String(g.version || ''))
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #111;
    background: #fff;
    font-size: 11pt;
    line-height: 1.5;
  }
  .header {
    border-bottom: 2px solid #b91c1c;
    padding-bottom: 8px;
    margin-bottom: 18px;
  }
  .vessel {
    font-size: 9pt;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #b91c1c;
    font-weight: 700;
    margin-bottom: 4px;
  }
  h1 { font-size: 22pt; margin: 0 0 4px 0; line-height: 1.15; }
  .meta {
    color: #555;
    font-size: 9pt;
    margin-top: 2px;
  }
  .meta .pill {
    display: inline-block;
    border: 1px solid #ddd;
    padding: 1px 6px;
    border-radius: 4px;
    margin-right: 6px;
  }
  h2 {
    font-size: 14pt;
    margin: 18px 0 6px 0;
    padding-bottom: 3px;
    border-bottom: 1px solid #eee;
    page-break-after: avoid;
  }
  h3 { font-size: 12pt; margin: 14px 0 4px 0; page-break-after: avoid; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0 6px 22px; padding: 0; }
  li { margin: 3px 0; }
  code {
    background: #f3f4f6;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 10pt;
  }
  pre {
    background: #f3f4f6;
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 9.5pt;
  }
  blockquote {
    margin: 10px 0;
    padding: 8px 12px;
    border-left: 4px solid #b91c1c;
    background: #fef2f2;
    color: #7f1d1d;
    page-break-inside: avoid;
  }
  blockquote.note { border-left-color: #2563eb; background: #eff6ff; color: #1e3a8a; }
  blockquote.stop { border-left-color: #b91c1c; background: #fef2f2; color: #7f1d1d; }
  blockquote p { margin: 2px 0; }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10px auto;
    border-radius: 6px;
    page-break-inside: avoid;
  }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; font-size: 10pt; text-align: left; }
  th { background: #f9fafb; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 14px 0; }
  .footer {
    margin-top: 24px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    color: #777;
    font-size: 8.5pt;
  }
  @media print {
    a { color: #111; text-decoration: none; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="vessel">M/Y Rise Above · Operational Guide</div>
    <h1>${safeTitle}</h1>
    <div class="meta">
      ${safeCategory ? `<span class="pill">${safeCategory}</span>` : ''}
      <span class="pill">v${versionSafe}</span>
      ${updatedSafe ? `Updated ${updatedSafe}` : ''}
      ${safeUpdatedBy ? ` by ${safeUpdatedBy}` : ''}
    </div>
  </div>
  <article>${bodyHtml}</article>
  <div class="footer">Generated from the Rise Above Operations app · ${escapeHtml(new Date().toLocaleString())}</div>
</body>
</html>`
}

function renderMarkdownForPrint(md: string): string {
  if (!md) return '<p><em>Empty guide.</em></p>'
  // marked is synchronous when using marked.parse with default options
  const raw = marked.parse(md, { async: false, breaks: false, gfm: true }) as string
  // Tag blockquote variants based on prefix for color-coded callouts
  return raw
    .replace(/<blockquote>\s*<p>(⚠️|🛑|ℹ️|WARNING|STOP|NOTE)/g, (m, marker) => {
      const cls = marker === '🛑' || /STOP/i.test(marker) ? 'stop'
        : marker === 'ℹ️' || /NOTE/i.test(marker) ? 'note'
        : ''
      return `<blockquote class="${cls}"><p>${marker}`
    })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;'
    : c === '<' ? '&lt;'
    : c === '>' ? '&gt;'
    : c === '"' ? '&quot;'
    : '&#39;',
  )
}
