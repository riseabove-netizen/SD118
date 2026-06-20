import React from 'react'
import { useLocation, useRoute } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { GuideMarkdown } from '@/components/GuideMarkdown'
import { fetchGuide } from '@/lib/guides'

export function GuideViewPage() {
  const [, params] = useRoute('/guides/:id')
  const [, setLocation] = useLocation()
  const id = params?.id || ''

  const { data: guide, isLoading, error } = useQuery({
    queryKey: ['guide', id],
    queryFn: () => fetchGuide(id),
    enabled: !!id,
  })

  return (
    <MenuLayout
      title={guide?.Title || 'Guide'}
      showBack
      backHref="/guides"
      rightAction={{
        label: 'Edit',
        ariaLabel: 'Edit guide',
        onClick: () => setLocation(`/guides/${id}/edit`),
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

            <div className="pt-4 border-t border-border">
              <button
                onClick={() => setLocation(`/guides/${id}/edit`)}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                Edit this guide
              </button>
            </div>
          </>
        )}
      </div>
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
