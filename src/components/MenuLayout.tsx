import React from 'react'
import { useLocation } from 'wouter'

interface MenuLayoutProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  backHref?: string
  rightAction?: {
    icon?: React.ReactNode
    label?: string
    ariaLabel?: string
    onClick: () => void
  }
}

export function MenuLayout({ children, title, showBack, backHref, rightAction }: MenuLayoutProps) {
  const [, setLocation] = useLocation()

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => setLocation(backHref || '/')}
            className="flex items-center justify-center h-11 w-11 -ml-2 rounded-lg hover:bg-secondary active:bg-secondary/80 transition-colors"
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="flex-1 flex items-center gap-2">
          {/* Logo mark */}
          <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="none" aria-hidden="true">
            <path d="M12 3L20 18H4L12 3Z" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeLinejoin="round"/>
            <path d="M8 14h8" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {title && (
            <h1 className="text-base font-semibold truncate">{title}</h1>
          )}
        </div>
        {rightAction && (
          <button
            onClick={rightAction.onClick}
            aria-label={rightAction.ariaLabel || rightAction.label}
            className="flex items-center justify-center h-11 min-w-[44px] px-3 -mr-2 rounded-lg hover:bg-secondary active:bg-secondary/80 transition-colors text-xl font-semibold"
          >
            {rightAction.icon ?? rightAction.label}
          </button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        {children}
      </main>
    </div>
  )
}