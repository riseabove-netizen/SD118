// Small dismissible toast rendered in fixed position at the top of the
// screen. Never pushes page content down, so it can't cause the jerky
// layout shift the crew saw when data was refreshing.
//
// Variants:
//   info    — muted grey (transient background refresh)
//   warn    — amber (upstream failed, showing cached values)
//   error   — red (hard failure, no data)
//   success — green

import React, { useEffect, useState } from 'react'

export type TransientBannerVariant = 'info' | 'warn' | 'error' | 'success'

interface Props {
  message: string | null
  variant?: TransientBannerVariant
  /** Auto-dismiss after N ms. 0 or undefined = no auto-dismiss. */
  autoDismissMs?: number
  onDismiss?: () => void
}

export function TransientBanner({ message, variant = 'info', autoDismissMs, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissal when the message changes so subsequent errors show.
  useEffect(() => { setDismissed(false) }, [message])

  useEffect(() => {
    if (!message || dismissed || !autoDismissMs) return
    const t = setTimeout(() => {
      setDismissed(true)
      onDismiss?.()
    }, autoDismissMs)
    return () => clearTimeout(t)
  }, [message, dismissed, autoDismissMs, onDismiss])

  if (!message || dismissed) return null

  const cls = variantClasses(variant)

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] w-fit pointer-events-none"
    >
      <div className={`pointer-events-auto flex items-start gap-2 rounded-md border shadow-lg px-3 py-2 text-xs ${cls}`}>
        <span className="leading-snug">{message}</span>
        <button
          type="button"
          onClick={() => { setDismissed(true); onDismiss?.() }}
          aria-label="Dismiss"
          className="-mt-0.5 -mr-1 h-5 w-5 grid place-items-center rounded hover:bg-black/20 text-current/70 hover:text-current"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function variantClasses(v: TransientBannerVariant): string {
  switch (v) {
    case 'warn':
      return 'bg-amber-500/15 border-amber-500/40 text-amber-100 backdrop-blur'
    case 'error':
      return 'bg-red-500/20 border-red-500/50 text-red-100 backdrop-blur'
    case 'success':
      return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100 backdrop-blur'
    case 'info':
    default:
      return 'bg-neutral-900/85 border-border text-foreground/90 backdrop-blur'
  }
}
