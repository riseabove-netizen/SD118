import React from 'react'
import { MenuLayout } from '@/components/MenuLayout'

const MANUAL_URL = '/manual/SD118-Manual-EN.pdf'

export function ManualPage() {
  return (
    <MenuLayout title="Vessel Manual" showBack backHref="/guides">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">SD118 Vessel Manual</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sanlorenzo SD118 · M/Y Rise Above (English)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={MANUAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M10 14L21 3M21 14v7H3V3h7"/>
            </svg>
            Open in new tab
          </a>
          <a
            href={MANUAL_URL}
            download="SD118-Manual-EN.pdf"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary text-sm font-medium"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download to device
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium text-muted-foreground">
            Inline viewer
          </div>
          <div className="aspect-[4/5] sm:aspect-[3/4] bg-secondary/20">
            <object
              data={MANUAL_URL}
              type="application/pdf"
              className="w-full h-full"
            >
              <iframe
                src={MANUAL_URL}
                title="SD118 Vessel Manual"
                className="w-full h-full border-0"
              />
            </object>
          </div>
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            If the PDF doesn't appear above (some mobile browsers can't render PDFs inline),
            tap "Open in new tab" or "Download to device" instead.
          </div>
        </div>
      </div>
    </MenuLayout>
  )
}
