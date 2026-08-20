import React, { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getToken, isAdmin } from '@/lib/auth'

type Status = 'scheduled' | 'sent' | 'cancelled' | 'failed'

interface ScheduledItem {
  id: string
  createdAt: string
  createdBy: string
  scheduledAtUtc: string
  title: string
  body: string
  url: string
  tag: string
  recipients: string[]
  status: Status
  deliveredAt: string
  deliverySummary: any
}

function statusColor(s: Status): string {
  switch (s) {
    case 'scheduled': return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'
    case 'sent': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
    case 'cancelled': return 'border-border bg-muted/20 text-muted-foreground'
    case 'failed': return 'border-destructive/50 bg-destructive/15 text-destructive'
  }
}

function formatLocal(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}

export function AdminScheduledBroadcastsPage() {
  const [, setLocation] = useLocation()
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = getToken()
      const resp = await fetch('/api/anchor-notify?op=list-scheduled', {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      setItems(data.items || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin()) {
      setLocation('/menu')
      return
    }
    load()
  }, [setLocation])

  const cancel = async (id: string) => {
    if (!confirm('Cancel this scheduled notification?')) return
    setCancellingId(id)
    try {
      const token = getToken()
      const resp = await fetch('/api/anchor-notify?op=cancel-scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ id }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Cancel failed')
    } finally {
      setCancellingId(null)
    }
  }

  const pending = items.filter(i => i.status === 'scheduled')
  const history = items.filter(i => i.status !== 'scheduled')

  return (
    <MenuLayout title="Scheduled Notifications" showBack backHref="/admin/notify">
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Delivery is checked every ~5 minutes. Times shown are in your local timezone.
          </div>
          <button
            type="button"
            onClick={load}
            className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground py-6">Loading…</div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-red-100">Upcoming ({pending.length})</h2>
              {pending.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No scheduled notifications. Draft one from{' '}
                  <button
                    type="button"
                    onClick={() => setLocation('/admin/notify')}
                    className="underline underline-offset-2 hover:text-red-300"
                  >
                    Admin · Notifications
                  </button>.
                </div>
              ) : (
                <ul className="space-y-2">
                  {pending.map(item => (
                    <ScheduledCard
                      key={item.id}
                      item={item}
                      cancelling={cancellingId === item.id}
                      onCancel={() => cancel(item.id)}
                    />
                  ))}
                </ul>
              )}
            </section>

            {history.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">History ({history.length})</h2>
                <ul className="space-y-2">
                  {history.slice(0, 30).map(item => (
                    <ScheduledCard key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            )}

            <div className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLocation('/admin/notify')}
                className="w-full h-11"
              >
                ← Back to Admin · Notifications
              </Button>
            </div>
          </>
        )}
      </div>
    </MenuLayout>
  )
}

function ScheduledCard({ item, cancelling, onCancel }: {
  item: ScheduledItem
  cancelling?: boolean
  onCancel?: () => void
}) {
  return (
    <li className="rounded-lg border border-border bg-card px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{item.title || '(no title)'}</div>
          <div className="text-xs text-muted-foreground">
            {item.status === 'scheduled' ? 'Fires' : item.status === 'sent' ? 'Delivered' : item.status === 'cancelled' ? 'Cancelled' : 'Failed'}{' '}
            <span className="text-foreground">{formatLocal(item.status === 'scheduled' ? item.scheduledAtUtc : (item.deliveredAt || item.scheduledAtUtc))}</span>
          </div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wide ${statusColor(item.status)}`}>
          {item.status}
        </span>
      </div>
      {item.body && (
        <div className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4">
          {item.body}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="truncate">
          → <span className="text-red-300/80">{item.url}</span>
          {item.recipients && item.recipients.length > 0 && (
            <> · {item.recipients.length === 0 ? 'everyone' : `${item.recipients.length} recipient${item.recipients.length === 1 ? '' : 's'}`}</>
          )}
        </div>
        {item.status === 'scheduled' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="shrink-0 px-2 py-1 rounded-md border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
      {item.status === 'sent' && item.deliverySummary && (
        <div className="text-[11px] text-emerald-200/80">
          Matched {item.deliverySummary.matched ?? '?'} · Sent {item.deliverySummary.sent ?? '?'} · Failed {item.deliverySummary.failed ?? '?'}
        </div>
      )}
      {item.status === 'failed' && item.deliverySummary?.error && (
        <div className="text-[11px] text-destructive">Error: {String(item.deliverySummary.error).slice(0, 200)}</div>
      )}
    </li>
  )
}
