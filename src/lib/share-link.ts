// Generic share-link helper used by Guides and Schedule.
// Uses the native Web Share API on iOS/Android, falls back to clipboard copy.

export type ShareLinkResult = 'shared' | 'copied' | 'failed'

export async function shareLink(args: { title: string; url: string; text?: string }): Promise<ShareLinkResult> {
  const { title, url, text } = args
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, text: text || title, url })
      return 'shared'
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'shared'
      // fall through
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return 'copied'
    }
  } catch {
    /* swallow */
  }
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

/**
 * Open a hidden iframe with the supplied HTML and trigger the system print
 * dialog after images have loaded. User picks "Save as PDF" from the dialog.
 */
export function printHtmlAsPdf(html: string) {
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

  const win = iframe.contentWindow
  if (!win) return

  const triggerPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      /* ignore */
    }
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
  setTimeout(() => {
    if (!done) {
      done = true
      triggerPrint()
    }
  }, 8000)
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;'
    : c === '<' ? '&lt;'
    : c === '>' ? '&gt;'
    : c === '"' ? '&quot;'
    : '&#39;',
  )
}
