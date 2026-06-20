import React, { useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { GuideMarkdown } from '@/components/GuideMarkdown'
import { fetchGuide } from '@/lib/guides'
import { shareGuideLink, printGuideAsPdf } from '@/lib/guide-share'

export function GuideViewPage() {
  const [, params] = useRoute('/guides/:id')
  const [, setLocation] = useLocation()
  const id = params?.id || ''
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  const { data: guide, isLoading, error } = useQuery({
    queryKey: ['guide', id],
    queryFn: () => fetchGuide(id),
    enabled: !!id,
  })

  async function handleShareLink() {
    if (!guide) return
    setShareOpen(false)
    const url = `${window.location.origin}/guides/${id}`
    const title = guide.Title || 'Operational Guide'
    const result = await shareGuideLink({ title, url })
    if (result === 'copied') setShareMsg('Link copied to clipboard')
    else if (result === 'failed') setShareMsg('Could not share — link is in the address bar')
    if (result === 'copied' || result === 'failed') {
      setTimeout(() => setShareMsg(null), 2500)
    }
  }

  function handlePdf() {
    if (!guide) return
    setShareOpen(false)
    printGuideAsPdf({
      title: guide.Title || 'Operational Guide',
      category: guide.Category || '',
      version: guide['Current Version'] || '',
      updatedAt: guide['Updated At'] || '',
      updatedBy: guide['Updated By'] || '',
      markdown: guide.Markdown || '',
    })
  }

  return (
    <MenuLayout
      title={guide?.Title || 'Guide'}
      showBack
      backHref="/guides"
      rightAction={{
        icon: <ShareIcon />,
        ariaLabel: 'Share guide',
        onClick: () => setShareOpen(true),
      }}
    >
      <div className="space-y-3">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">
            {(error as Error).message}
          </div>
        )}

        {guide && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-b border-border pb-3">
              {guide.Category && (
                <span className="px-2 py-1 rounded bg-card border border-border">{guide.Category}</span>
              )}
              <span>v{guide['Current Version']}</span>
              <span>·</span>
              <span>updated {formatDate(guide['Updated At'])}</span>
              {guide['Updated By'] && <span>by {guide['Updated By']}</span>}
              {guide.versions && guide.versions.length > 1 && (
                <button
                  onClick={() => setLocation(`/guides/${id}/history`)}
                  className="ml-auto text-primary underline text-xs"
                >
                  history ({guide.versions.length})
                </button>
              )}
            </div>

            <GuideMarkdown>{guide.Markdown || '_Empty guide._'}</GuideMarkdown>

            <div className="pt-4 border-t border-border space-y-2">
              <button
                onClick={() => setLocation(`/guides/${id}/edit`)}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                Edit this guide
              </button>
              <button
                onClick={() => setShareOpen(true)}
                className="w-full h-11 rounded-lg border border-border bg-card text-foreground font-medium flex items-center justify-center gap-2"
              >
                <ShareIcon />
                Share guide
              </button>
            </div>
          </>
        )}
      </div>

      {shareMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-card border border-border text-sm shadow-lg z-50">
          {shareMsg}
        </div>
      )}

      {shareOpen && guide && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-border p-4 space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-base font-semibold pb-2 border-b border-border">Share guide</div>
            <button
              onClick={handleShareLink}
              className="w-full h-12 rounded-lg bg-secondary text-foreground font-medium flex items-center gap-3 px-4 text-left"
            >
              <LinkIcon />
              <div className="flex-1">
                <div>Share link</div>
                <div className="text-xs text-muted-foreground">Send via Messages, Mail, WhatsApp…</div>
              </div>
            </button>
            <button
              onClick={handlePdf}
              className="w-full h-12 rounded-lg bg-secondary text-foreground font-medium flex items-center gap-3 px-4 text-left"
            >
              <PdfIcon />
              <div className="flex-1">
                <div>Save as PDF</div>
                <div className="text-xs text-muted-foreground">Opens print dialog → Save as PDF</div>
              </div>
            </button>
            <button
              onClick={() => setShareOpen(false)}
              className="w-full h-10 rounded-lg text-muted-foreground text-sm mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </MenuLayout>
  )
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}
