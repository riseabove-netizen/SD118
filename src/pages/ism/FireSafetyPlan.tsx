import React, { useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'

const PAGES = [
  { src: '/manual/fls-page-111.jpg', label: 'B-77 · Safety Equipment — Main Deck / Lower Deck' },
  { src: '/manual/fls-page-112.jpg', label: 'B-79 · Safety Equipment — Legend' },
  { src: '/manual/fls-page-113.jpg', label: 'B-81 · Safety Equipment — Flying Bridge / Upper Deck' },
  { src: '/manual/fls-page-114.jpg', label: 'B-83 · Safety Equipment — Main Deck / Lower Deck (detailed)' },
  { src: '/manual/fls-page-115.jpg', label: 'B-85 · Safety Equipment — Legend (detailed)' },
  { src: '/manual/fls-page-116.jpg', label: 'B-87 · Escape Routes — Flying Bridge / Upper Deck' },
  { src: '/manual/fls-page-117.jpg', label: 'B-89 · Escape Routes — Main Deck / Lower Deck' },
  { src: '/manual/fls-page-118.jpg', label: 'B-91 · Portable Extinguishers — Notes' },
]

export function FireSafetyPlanPage() {
  const [zoomed, setZoomed] = useState<string | null>(null)

  return (
    <MenuLayout title="Fire & LSA Plan" showBack backHref="/ism/fire-safety">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Fire and Life Saving Appliances Plan</h2>
          <p className="text-sm text-muted-foreground mt-1">
            M/Y Rise Above · Tap any page to enlarge
          </p>
        </div>

        <div className="space-y-3">
          {PAGES.map((p) => (
            <div key={p.src} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-sm font-medium text-muted-foreground">
                {p.label}
              </div>
              <button
                onClick={() => setZoomed(p.src)}
                className="block w-full bg-white"
                aria-label={`Enlarge ${p.label}`}
              >
                <img
                  src={p.src}
                  alt={p.label}
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-2 pb-6 text-center">
          <a
            href="/manual/SD118-Manual-EN.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Open full vessel manual
          </a>
        </div>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomed(null)}
        >
          <button
            onClick={() => setZoomed(null)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <img
            src={zoomed}
            alt="Plan page"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </MenuLayout>
  )
}
