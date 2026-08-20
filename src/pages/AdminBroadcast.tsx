import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getToken, getCrewName, isAdmin } from '@/lib/auth'

interface BroadcastResult {
  ok: boolean
  matched: number
  sent: number
  failed: number
  perName?: Record<string, { sent: number; failed: number }>
  note?: string
  error?: string
}

const URL_PRESETS: { label: string; value: string }[] = [
  { label: 'Schedule', value: '/schedule' },
  { label: "Enrico's Summer", value: '/schedule/enricos-summer-2026' },
  { label: 'Sardinia → Ponza', value: '/schedule/sardinia-2026' },
  { label: 'Naples · Family', value: '/schedule/naples-family-2026' },
  { label: 'Menu', value: '/menu' },
  { label: 'Watch', value: '/watch' },
]

type SendMode = 'now' | 'schedule'

// Return a datetime-local string for "tomorrow 07:00" in the user's local time.
function tomorrow0700Local(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(7, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convert a datetime-local input value (local time, no offset) to ISO UTC.
function localToIsoUtc(local: string): string | null {
  if (!local) return null
  const t = new Date(local)
  if (Number.isNaN(t.getTime())) return null
  return t.toISOString()
}

// Best-effort IANA tz detection (browsers all support this since ~2020).
function detectTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome' } catch { return 'Europe/Rome' }
}

export function AdminBroadcastPage() {
  const [, setLocation] = useLocation()
  const [users, setUsers] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('Schedule update — M/Y Rise Above')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/schedule')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<BroadcastResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Schedule mode
  const [mode, setMode] = useState<SendMode>('now')
  const [sendAtLocal, setSendAtLocal] = useState<string>(tomorrow0700Local())
  const [scheduleResult, setScheduleResult] = useState<{ id: string; scheduledAtUtc: string } | null>(null)

  // AI prefill
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Prefill-tomorrow
  const [prefillBusy, setPrefillBusy] = useState(false)
  const [prefillMeta, setPrefillMeta] = useState<{ isoDate: string; dayContext: string; tripId?: string } | null>(null)

  useEffect(() => {
    if (!isAdmin()) {
      setLocation('/menu')
      return
    }
    fetch('/api/anchor-notify?op=users')
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        const list: string[] = Array.isArray(data.users) ? data.users : []
        setUsers(list.slice().sort((a, b) => a.localeCompare(b)))
        // Default to everyone selected — matches "notify at 7am" morning use case
        setSelected(new Set(list))
      })
      .catch(e => setError(e?.message || 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [setLocation])

  const allSelected = users.length > 0 && selected.size === users.length
  const someSelected = selected.size > 0 && !allSelected

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(users))
  const selectNone = () => setSelected(new Set())

  const canSend = useMemo(() => {
    return !sending && title.trim().length > 0 && body.trim().length > 0 && selected.size > 0
  }, [sending, title, body, selected])

  const scheduleValidUtc = useMemo(() => {
    if (mode !== 'schedule') return null
    return localToIsoUtc(sendAtLocal)
  }, [mode, sendAtLocal])

  const canSubmit = mode === 'now'
    ? canSend
    : (canSend && !!scheduleValidUtc && new Date(scheduleValidUtc as string).getTime() > Date.now())

  const handlePrefillTomorrow = async () => {
    setPrefillBusy(true)
    setError(null)
    try {
      const token = getToken()
      const resp = await fetch(`/api/anchor-notify?op=prefill-tomorrow&tz=${encodeURIComponent(detectTz())}`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      setTitle(String(data.title || '').slice(0, 120))
      setBody(String(data.body || '').slice(0, 500))
      setUrl(String(data.url || '/schedule'))
      setPrefillMeta({ isoDate: data.isoDate, dayContext: data.dayContext || '', tripId: data.tripId })
      // Switch to schedule mode with default 7am local for tomorrow
      setMode('schedule')
      setSendAtLocal(tomorrow0700Local())
    } catch (e: any) {
      setError(e?.message || 'Prefill failed')
    } finally {
      setPrefillBusy(false)
    }
  }

  const handleAiPrefill = async () => {
    if (!aiPrompt.trim()) return
    setAiBusy(true)
    setAiError(null)
    try {
      const token = getToken()
      const resp = await fetch('/api/anchor-notify?op=ai-prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          dayIso: prefillMeta?.isoDate,
          tripId: prefillMeta?.tripId,
          dayContext: prefillMeta?.dayContext,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      if (data.title) setTitle(String(data.title).slice(0, 120))
      if (data.body) setBody(String(data.body).slice(0, 500))
      if (data.url) setUrl(String(data.url))
    } catch (e: any) {
      setAiError(e?.message || 'AI prefill failed')
    } finally {
      setAiBusy(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSending(true)
    setResult(null)
    setScheduleResult(null)
    setError(null)
    try {
      const token = getToken()
      const payload = {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || '/schedule',
        tag: `admin-broadcast-${Date.now()}`,
        recipients: Array.from(selected),
        from: getCrewName() || 'admin',
      }

      if (mode === 'now') {
        const resp = await fetch('/api/anchor-notify?op=broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
          body: JSON.stringify(payload),
        })
        const data = (await resp.json()) as BroadcastResult
        if (!resp.ok) {
          setError(data.error || `HTTP ${resp.status}`)
        } else {
          setResult(data)
          if (data.sent > 0) setBody('')
        }
      } else {
        // schedule
        const resp = await fetch('/api/anchor-notify?op=schedule-broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
          body: JSON.stringify({ ...payload, scheduledAt: scheduleValidUtc }),
        })
        const data = await resp.json()
        if (!resp.ok || !data.ok) {
          setError(data.error || `HTTP ${resp.status}`)
        } else {
          setScheduleResult({ id: data.id, scheduledAtUtc: data.scheduledAtUtc })
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const scheduleLocalPreview = useMemo(() => {
    if (!scheduleValidUtc) return null
    try {
      return new Date(scheduleValidUtc).toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    } catch { return scheduleValidUtc }
  }, [scheduleValidUtc])

  return (
    <MenuLayout title="Admin · Notifications" showBack backHref="/menu">
      <div className="space-y-6 pb-8">
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          <span className="font-semibold">Admin only.</span> Send a push now or schedule it for later. Recipients must have enabled notifications on this device.
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePrefillTomorrow}
            disabled={prefillBusy}
            className="h-10"
          >
            {prefillBusy ? 'Loading tomorrow…' : '📅 Prefill tomorrow\u2019s schedule'}
          </Button>
          <button
            type="button"
            onClick={() => setLocation('/admin/scheduled')}
            className="h-10 px-3 rounded-md border border-border text-sm hover:bg-muted/40"
          >
            View scheduled →
          </button>
        </div>

        {/* AI prefill */}
        <section className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-3 space-y-2">
          <Label className="text-sm text-red-100">✨ AI prefill</Label>
          <div className="text-xs text-muted-foreground">
            Describe what you want; AI will draft title, body and URL. Uses tomorrow\u2019s schedule as context if loaded above.
          </div>
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="e.g. Draft a 7am notification reminding crew that today we anchor at Positano and lunch is 13:00 with the Rossi family."
            className="w-full min-h-[70px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAiPrefill}
              disabled={aiBusy || !aiPrompt.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {aiBusy ? 'Drafting…' : 'Draft with AI'}
            </Button>
            {aiError && <div className="text-xs text-destructive">{aiError}</div>}
          </div>
        </section>

        {/* Recipients */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Recipients</Label>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-red-400 hover:text-red-300 underline underline-offset-2"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-4">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No users have enabled notifications yet. Ask them to open the app and turn on push notifications from Settings or the Anchor Watch page.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {users.map(name => {
                const on = selected.has(name)
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggle(name)}
                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                      on
                        ? 'border-red-500/70 bg-red-500/15 text-red-100'
                        : 'border-border bg-card hover:bg-muted/40 text-foreground'
                    }`}
                    aria-pressed={on}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-block w-4 h-4 rounded border ${
                          on ? 'bg-red-500 border-red-500' : 'border-border'
                        } flex items-center justify-center`}
                        aria-hidden="true"
                      >
                        {on && (
                          <svg viewBox="0 0 20 20" className="w-3 h-3 text-white" fill="currentColor">
                            <path d="M7.5 13.5l-3-3 1.4-1.4 1.6 1.6 4.6-4.6L13.5 7.5 7.5 13.5z" />
                          </svg>
                        )}
                      </span>
                      {name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {someSelected && (
            <div className="text-xs text-muted-foreground">{selected.size} of {users.length} selected</div>
          )}
          {allSelected && (
            <div className="text-xs text-muted-foreground">All {users.length} users selected</div>
          )}
        </section>

        {/* Message */}
        <section className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="notif-title" className="text-sm">Title</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notif-body" className="text-sm">Message</Label>
            <textarea
              id="notif-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={500}
              placeholder="Aug 19 update: depart Ponza 04:30, dock Molo Luise ~10:30. Daniel &amp; Marco board on arrival; Nonna 12:00."
              className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
            <div className="text-xs text-muted-foreground text-right">{body.length}/500</div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-url" className="text-sm">Open when tapped</Label>
            <Input
              id="notif-url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="/schedule"
              className="h-11"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {URL_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setUrl(p.value)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    url === p.value
                      ? 'border-red-500/70 bg-red-500/15 text-red-100'
                      : 'border-border text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Send mode */}
        <section className="space-y-3">
          <Label className="text-sm">When to send</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('now')}
              className={`flex-1 h-11 rounded-md border text-sm transition-colors ${
                mode === 'now'
                  ? 'border-red-500/70 bg-red-500/15 text-red-100'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              Send now
            </button>
            <button
              type="button"
              onClick={() => setMode('schedule')}
              className={`flex-1 h-11 rounded-md border text-sm transition-colors ${
                mode === 'schedule'
                  ? 'border-red-500/70 bg-red-500/15 text-red-100'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              Schedule
            </button>
          </div>
          {mode === 'schedule' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSendAtLocal(tomorrow0700Local())}
                  className="px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted/40"
                >
                  Tomorrow 07:00
                </button>
              </div>
              <Input
                type="datetime-local"
                value={sendAtLocal}
                onChange={e => setSendAtLocal(e.target.value)}
                className="h-11"
              />
              {scheduleLocalPreview && (
                <div className="text-xs text-muted-foreground">
                  Will fire at <span className="text-red-300">{scheduleLocalPreview}</span> (your local time).
                </div>
              )}
            </div>
          )}
        </section>

        {/* Send */}
        <div className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
          >
            {sending
              ? mode === 'now' ? 'Sending…' : 'Scheduling…'
              : selected.size === 0 ? 'Select at least one recipient'
              : mode === 'now'
                ? `Send now to ${selected.size} ${selected.size === 1 ? 'user' : 'users'}`
                : `Schedule for ${selected.size} ${selected.size === 1 ? 'user' : 'users'}`}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100 space-y-1">
            <div className="font-semibold">
              {result.sent > 0 ? '✓ Sent' : 'No push delivered'} — matched {result.matched}, sent {result.sent}, failed {result.failed}
            </div>
            {result.note && <div className="text-xs text-emerald-200/80">{result.note}</div>}
            {result.perName && Object.keys(result.perName).length > 0 && (
              <ul className="text-xs text-emerald-200/80 mt-1 space-y-0.5">
                {Object.entries(result.perName).map(([name, s]) => (
                  <li key={name}>
                    {name}: {s.sent} sent{s.failed ? `, ${s.failed} failed` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {scheduleResult && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100 space-y-1">
            <div className="font-semibold">✓ Scheduled</div>
            <div className="text-xs text-emerald-200/80">
              Will send around {scheduleLocalPreview}. Check <button
                type="button"
                onClick={() => setLocation('/admin/scheduled')}
                className="underline underline-offset-2 hover:text-white"
              >Scheduled Notifications</button> to cancel or review.
            </div>
          </div>
        )}
      </div>
    </MenuLayout>
  )
}
