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

// Detect iOS / iPadOS — including iPadOS Safari that masquerades as macOS.
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports "MacIntel" — detect via touch points on "Mac".
  return navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1
}

export function printGuideAsPdf(g: PrintGuideArgs) {
  const html = buildPrintableHtml(g)

  // Strategy:
  //   1) Open a real top-level tab with the printable HTML. This works
  //      on iOS Safari, macOS Safari, Chrome, Firefox. Hidden iframes'
  //      .print() is blocked by iOS Safari entirely, which is why the
  //      previous version silently did nothing on the crew's phones.
  //   2) Once images have loaded, call window.print() from inside that
  //      tab. If print() is blocked, the guide is still visible and the
  //      user can use the browser's own Share → "Save as PDF" / "Print".
  //   3) If popup blocking prevents the tab from opening (common when
  //      the call didn't originate from a user gesture, or from an
  //      installed PWA on iOS), fall back to a full-page navigation via
  //      a blob URL — no popup needed.

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  // Some browsers require a synchronous window.open() from the user
  // gesture. We call it immediately and let the new tab load the blob.
  const w = window.open(url, '_blank')
  const revoke = () => setTimeout(() => URL.revokeObjectURL(url), 60_000)

  if (w) {
    // iOS Safari will NOT honor window.print() called from the parent
    // frame after navigation completes — the printable HTML itself
    // includes a small script that fires print() after images load and
    // also exposes a "Save as PDF" button as a manual fallback.
    revoke()
    return
  }

  // Popup was blocked — navigate the current tab instead. The user can
  // hit "back" once the PDF is saved. Not as nice, but it always works.
  if (isIOS()) {
    // On iOS, opening a blob: URL in the same tab is reliable; on other
    // platforms we do the same for consistency.
    window.location.href = url
  } else {
    window.location.href = url
  }
  revoke()
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
  .toolbar {
    position: sticky;
    top: 0;
    background: #b91c1c;
    color: #fff;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: -8px -8px 14px -8px;
    font-size: 12pt;
    z-index: 10;
  }
  .toolbar .btn {
    background: #fff;
    color: #b91c1c;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-weight: 700;
    font-size: 11pt;
    cursor: pointer;
  }
  .toolbar .hint { font-size: 9.5pt; opacity: 0.9; }
  @media print {
    a { color: #111; text-decoration: none; }
    .no-print, .toolbar { display: none !important; }
    body { padding: 0 !important; }
  }
  body { padding: 8px; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="btn" onclick="window.print()">Save as PDF</button>
    <span class="hint">Then choose “Save to Files” or “Print → Save as PDF”</span>
  </div>
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
<script>
(function () {
  // Give images a chance to load before triggering print on desktops.
  // Skip on iOS Safari (window.print inside a fresh blob tab is unreliable
  // there); the user taps the red "Save as PDF" button instead.
  var ua = navigator.userAgent || '';
  var isIos = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return;
  var imgs = Array.from(document.images);
  var pending = imgs.length;
  var done = false;
  function go() {
    if (done) return;
    done = true;
    setTimeout(function () { try { window.print(); } catch (e) {} }, 200);
  }
  if (pending === 0) { go(); return; }
  imgs.forEach(function (img) {
    if (img.complete) { pending--; if (pending <= 0) go(); }
    else {
      img.addEventListener('load', function () { pending--; if (pending <= 0) go(); });
      img.addEventListener('error', function () { pending--; if (pending <= 0) go(); });
    }
  });
  setTimeout(go, 8000);
})();
</script>
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
