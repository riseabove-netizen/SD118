import React, { useEffect, useMemo, useState } from 'react'

import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type TzChoice = 'Europe/Rome' | 'America/New_York' | 'browser'
const TZ_LABEL: Record<TzChoice, string> = {
  'Europe/Rome': 'Italy (CET/CEST)',
  'America/New_York': 'New York (EST/EDT)',
  browser: 'Browser local',
}

function detectTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome' } catch { return 'Europe/Rome' }
}
function resolveTz(choice: TzChoice): string {
  if (choice === 'browser') return detectTz()
  return choice
}

// Convert a UTC ISO instant to a datetime-local value string representing
// that instant's wall-clock in the given tz.
function isoToWallClockInTz(iso: string, tz: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const g: Record<string, string> = {}
    for (const p of parts) if (p.type !== 'literal') g[p.type] = p.value
    const hour = g.hour === '24' ? '00' : g.hour
    return `${g.year}-${g.month}-${g.day}T${hour}:${g.minute}`
  } catch { return '' }
}

// Convert a wall-clock datetime-local string in a specific tz to a UTC ISO.
function wallClockInTzToUtc(local: string, tz: string): string | null {
  if (!local) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const utcGuess = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcGuess))
  const g: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') g[p.type] = p.value
  const gHour = g.hour === '24' ? '00' : g.hour
  const asIfUtc = Date.UTC(+g.year, +g.month - 1, +g.day, +gHour, +g.minute, +g.second)
  const offsetMs = asIfUtc - utcGuess
  return new Date(utcGuess - offsetMs).toISOString()
}

function formatInTz(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso))
  } catch { return iso }
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
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'cancel' | 'send' | 'save' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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

  const doPost = async (op: string, id: string, body: any = {}) => {
    const token = getToken()
    const resp = await fetch(`/api/anchor-notify?op=${op}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ id, ...body }),
    })
    const data = await resp.json()
    if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`)
    return data
  }

  const cancel = async (id: string) => {
    if (!confirm('Cancel this scheduled notification?')) return
    setBusyId(id); setBusyAction('cancel'); setError(null)
    try {
      await doPost('cancel-scheduled', id)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Cancel failed')
    } finally {
      setBusyId(null); setBusyAction(null)
    }
  }

  const sendNow = async (id: string) => {
    if (!confirm('Send this notification NOW to all its recipients?')) return
    setBusyId(id); setBusyAction('send'); setError(null)
    try {
      await doPost('send-scheduled-now', id)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Send failed')
    } finally {
      setBusyId(null); setBusyAction(null)
    }
  }

  const saveEdit = async (id: string, patch: any) => {
    setBusyId(id); setBusyAction('save'); setError(null)
    try {
      await doPost('update-scheduled', id, patch)
      setEditingId(null)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setBusyId(null); setBusyAction(null)
    }
  }

  const pending = items.filter(i => i.status === 'scheduled')
  const history = items.filter(i => i.status !== 'scheduled')

  return (
    <MenuLayout title="Scheduled Notifications" showBack backHref="/admin/notify">
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Delivery is checked every ~5 minutes. Edit, send now, or cancel any pending item.
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
                      editing={editingId === item.id}
                      busy={busyId === item.id ? busyAction : null}
                      onEdit={() => setEditingId(item.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={patch => saveEdit(item.id, patch)}
                      onCancel={() => cancel(item.id)}
                      onSendNow={() => sendNow(item.id)}
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

function ScheduledCard({
  item, editing, busy,
  onEdit, onCancelEdit, onSave,
  onCancel, onSendNow,
}: {
  item: ScheduledItem
  editing?: boolean
  busy?: 'cancel' | 'send' | 'save' | null
  onEdit?: () => void
  onCancelEdit?: () => void
  onSave?: (patch: any) => void
  onCancel?: () => void
  onSendNow?: () => void
}) {
  if (editing) {
    return <ScheduledEditor item={item} busy={busy} onCancelEdit={onCancelEdit!} onSave={onSave!} />
  }
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
            <> · {item.recipients.length} recipient{item.recipients.length === 1 ? '' : 's'}</>
          )}
        </div>
        {item.status === 'scheduled' && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              disabled={!!busy}
              className="px-2 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onSendNow}
              disabled={!!busy}
              className="px-2 py-1 rounded-md border border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              {busy === 'send' ? 'Sending…' : 'Send now'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={!!busy}
              className="px-2 py-1 rounded-md border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
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

function ScheduledEditor({
  item, busy, onCancelEdit, onSave,
}: {
  item: ScheduledItem
  busy?: 'cancel' | 'send' | 'save' | null
  onCancelEdit: () => void
  onSave: (patch: any) => void
}) {
  const [tzChoice, setTzChoice] = useState<TzChoice>(() => {
    const tz = detectTz()
    if (tz === 'Europe/Rome') return 'Europe/Rome'
    if (tz === 'America/New_York') return 'America/New_York'
    return 'browser'
  })
  const activeTz = useMemo(() => resolveTz(tzChoice), [tzChoice])
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState(item.body)
  const [url, setUrl] = useState(item.url)
  const [sendAtLocal, setSendAtLocal] = useState<string>(() => isoToWallClockInTz(item.scheduledAtUtc, activeTz))

  // When user changes the tz picker, rewrite the datetime-local input so the
  // wall-clock still points at the same UTC instant. Side effect → useEffect.
  const [lastTz, setLastTz] = useState<string>(activeTz)
  useEffect(() => {
    if (activeTz === lastTz) return
    const utc = wallClockInTzToUtc(sendAtLocal, lastTz)
    if (utc) setSendAtLocal(isoToWallClockInTz(utc, activeTz))
    setLastTz(activeTz)
  }, [activeTz, lastTz, sendAtLocal])

  const scheduledAtUtc = useMemo(() => wallClockInTzToUtc(sendAtLocal, activeTz), [sendAtLocal, activeTz])
  const scheduleLocalPreview = useMemo(() => scheduledAtUtc ? formatInTz(scheduledAtUtc, activeTz) : null, [scheduledAtUtc, activeTz])
  const scheduleOtherTzPreview = useMemo(() => {
    if (!scheduledAtUtc) return null
    const otherTz = activeTz === 'Europe/Rome' ? 'America/New_York' : 'Europe/Rome'
    return { tz: otherTz, label: formatInTz(scheduledAtUtc, otherTz) }
  }, [scheduledAtUtc, activeTz])

  const canSave = useMemo(() => {
    if (!title.trim() || !body.trim() || !scheduledAtUtc) return false
    return new Date(scheduledAtUtc).getTime() > Date.now()
  }, [title, body, scheduledAtUtc])

  const save = () => {
    if (!canSave || !scheduledAtUtc) return
    onSave({
      title: title.trim(),
      body: body.trim(),
      url: url.trim() || '/schedule',
      scheduledAt: scheduledAtUtc,
    })
  }

  return (
    <li className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-200">Editing</div>
        <span className="text-[10px] text-muted-foreground">id: {item.id}</span>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} className="h-10" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Body</Label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">URL</Label>
        <Input value={url} onChange={e => setUrl(e.target.value)} className="h-10" placeholder="/schedule" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Fires at</Label>
        <Input
          type="datetime-local"
          value={sendAtLocal}
          onChange={e => setSendAtLocal(e.target.value)}
          className="h-11"
        />
        <div className="grid grid-cols-3 gap-1.5">
          {(['Europe/Rome', 'America/New_York', 'browser'] as TzChoice[]).map(choice => (
            <button
              key={choice}
              type="button"
              onClick={() => setTzChoice(choice)}
              className={`h-9 rounded-md border text-xs transition-colors ${
                tzChoice === choice
                  ? 'border-red-500/70 bg-red-500/15 text-red-100'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {TZ_LABEL[choice]}
            </button>
          ))}
        </div>
        {scheduleLocalPreview && (
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">
              Will fire at <span className="text-red-300">{scheduleLocalPreview}</span>
            </div>
            {scheduleOtherTzPreview && (
              <div className="text-[11px] text-muted-foreground/70">
                = {scheduleOtherTzPreview.label} in {scheduleOtherTzPreview.tz.split('/')[1].replace('_', ' ')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancelEdit}
          disabled={busy === 'save'}
          className="flex-1 h-10"
        >
          Discard
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={!canSave || busy === 'save'}
          className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white"
        >
          {busy === 'save' ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </li>
  )
}
