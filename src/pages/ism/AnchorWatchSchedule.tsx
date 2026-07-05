// Admin-editable per-hour watch schedule + notification enrollment.
// Renders under the ActivePanel when an anchor watch is running.

import React, { useEffect, useMemo, useState } from 'react'
import type { AnchorWatchData, AnchorWatchSign } from '@/data/anchor-watch-seed'
import { fetchSchedule, saveSchedule, buildHourSlots, formatHourLocal } from '@/lib/anchor-schedule'
import { getCrewName, isAdmin } from '@/lib/auth'
import {
  isIosSafari, isStandalone, pushSupported,
  subscribeToPush, unsubscribeFromPush, getSubscriptionState,
} from '@/lib/push'

interface Props {
  data: AnchorWatchData
  disabled: boolean
}

export function AnchorWatchSchedule({ data, disabled }: Props) {
  const admin = isAdmin()
  const [schedule, setScheduleState] = useState<Record<string, string>>({})
  const [notified, setNotified] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [hoursToShow, setHoursToShow] = useState(12)

  const [pushState, setPushState] = useState<{ subscribed: boolean; permission: NotificationPermission } | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  // People who have already signed the watch — used to autocomplete the
  // per-hour name field (per the user's design: auto-collect from signatures).
  const suggestedNames = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of (data.signatures || []) as AnchorWatchSign[]) {
      const n = (s.name || '').trim()
      if (!n) continue
      const key = n.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(n)
    }
    const started = (data.startedBy || '').trim()
    if (started && !seen.has(started.toLowerCase())) out.push(started)
    return out
  }, [data.signatures, data.startedBy])

  const slots = useMemo(() => buildHourSlots(data.startedAt, hoursToShow), [data.startedAt, hoursToShow])

  useEffect(() => {
    let cancel = false
    if (!data.startedAt) return
    fetchSchedule(data.startedAt).then(state => {
      if (cancel) return
      setScheduleState(state.schedule)
      setNotified(state.notified)
      setLoading(false)
    }).catch(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [data.startedAt])

  useEffect(() => {
    if (!pushSupported()) { setPushState({ subscribed: false, permission: 'default' }); return }
    getSubscriptionState().then(setPushState).catch(() => setPushState({ subscribed: false, permission: 'default' }))
  }, [])

  const setName = (iso: string, name: string) => {
    setScheduleState(prev => ({ ...prev, [iso]: name }))
  }

  const persist = async () => {
    if (!data.startedAt) return
    setSaving(true); setMsg(null)
    try {
      // Strip empty values before saving so the sheet stays clean.
      const clean: Record<string, string> = {}
      Object.entries(schedule).forEach(([k, v]) => { if (v && v.trim()) clean[k] = v.trim() })
      const state = await saveSchedule(data.startedAt, clean, getCrewName() || 'crew')
      setScheduleState(state.schedule)
      setNotified(state.notified)
      setMsg('Schedule saved')
      setTimeout(() => setMsg(null), 2500)
    } catch (e: any) {
      setMsg(e?.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const enablePush = async () => {
    setPushBusy(true); setPushError(null)
    try {
      const name = getCrewName()
      if (!name) throw new Error('Sign in with your crew name first')
      if (isIosSafari() && !isStandalone()) {
        throw new Error('On iPhone: tap Share → Add to Home Screen, then open Rise Above from the icon and try again.')
      }
      await subscribeToPush(name)
      const s = await getSubscriptionState()
      setPushState(s)
    } catch (e: any) {
      setPushError(e?.message || String(e))
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    setPushBusy(true); setPushError(null)
    try {
      await unsubscribeFromPush()
      const s = await getSubscriptionState()
      setPushState(s)
    } catch (e: any) {
      setPushError(e?.message || String(e))
    } finally {
      setPushBusy(false)
    }
  }

  const nowMs = Date.now()
  const currentSlotIdx = slots.findIndex(iso => {
    const t = Date.parse(iso)
    return nowMs >= t && nowMs - t < 60 * 60 * 1000
  })

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Hourly watch schedule</h3>
        {admin && (
          <button
            onClick={persist}
            disabled={disabled || saving}
            className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {admin
          ? 'Assign a watch keeper for each hour. They\u2019ll get a push notification when it\u2019s their turn to sign the log.'
          : 'The captain assigns the watch schedule. Enable notifications below to be pinged when it\u2019s your turn.'}
      </p>

      {/* Push enrollment card — every crew member sees this */}
      <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
        <div className="text-xs font-semibold">Notifications on this device</div>
        {!pushSupported() ? (
          <div className="text-xs text-muted-foreground">
            This browser doesn\u2019t support push notifications. Use Safari on iOS 16.4+ or Chrome/Edge on desktop.
          </div>
        ) : isIosSafari() && !isStandalone() ? (
          <div className="text-xs text-amber-300">
            On iPhone, notifications only work after adding Rise Above to your Home Screen:
            tap the <span className="font-semibold">Share</span> icon in Safari, then
            <span className="font-semibold"> Add to Home Screen</span>, then open Rise Above from the icon.
          </div>
        ) : pushState?.subscribed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-emerald-300">
              Enrolled as <span className="font-semibold">{getCrewName() || 'crew'}</span>
            </span>
            <button
              onClick={disablePush}
              disabled={pushBusy}
              className="text-xs px-2.5 py-1 rounded border border-border hover:bg-secondary disabled:opacity-50"
            >
              {pushBusy ? '…' : 'Disable'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              You\u2019ll be pinged when it\u2019s your turn.
            </span>
            <button
              onClick={enablePush}
              disabled={pushBusy}
              className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
            >
              {pushBusy ? 'Enabling…' : 'Enable notifications'}
            </button>
          </div>
        )}
        {pushError && <div className="text-xs text-red-400">{pushError}</div>}
      </div>

      {/* Schedule table */}
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading schedule…</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[minmax(120px,auto)_1fr_auto] items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Hour</span>
            <span>Watch keeper</span>
            <span>Status</span>
          </div>
          {slots.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Waiting for the watch to be started.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {slots.map((iso, i) => {
                const val = schedule[iso] || ''
                const notifyAt = notified[iso]
                const slotMs = Date.parse(iso)
                const isNow = i === currentSlotIdx
                const isPast = slotMs < nowMs - 60 * 60 * 1000
                const wasSignedFor = (data.signatures || []).some(s => {
                  const t = Date.parse(s.timestamp)
                  return Math.abs(t - slotMs) < 60 * 60 * 1000 &&
                    (s.name || '').trim().toLowerCase() === val.trim().toLowerCase()
                })
                return (
                  <li key={iso} className={`grid grid-cols-[minmax(120px,auto)_1fr_auto] items-center gap-2 px-3 py-2 text-sm ${isNow ? 'bg-red-500/10' : ''}`}>
                    <span className={`font-medium ${isPast && !wasSignedFor ? 'text-muted-foreground line-through' : ''}`}>
                      {formatHourLocal(iso)}
                    </span>
                    {admin ? (
                      <input
                        list={`crew-names-${i}`}
                        value={val}
                        disabled={disabled}
                        onChange={e => setName(iso, e.target.value)}
                        placeholder="Assign crew…"
                        className="w-full rounded border border-border bg-secondary/40 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      />
                    ) : (
                      <span className={wasSignedFor ? 'line-through text-muted-foreground' : ''}>
                        {val || <span className="text-muted-foreground">—</span>}
                      </span>
                    )}
                    <datalist id={`crew-names-${i}`}>
                      {suggestedNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                    <span className="text-[11px]">
                      {wasSignedFor ? <span className="text-emerald-300 font-semibold">Signed</span>
                        : notifyAt ? <span className="text-amber-300">Notified</span>
                        : isNow ? <span className="text-red-400 font-semibold">Now</span>
                        : isPast ? <span className="text-muted-foreground">Missed</span>
                        : <span className="text-muted-foreground">Upcoming</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {admin && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setHoursToShow(h => h + 12)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            + Show 12 more hours
          </button>
          {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        </div>
      )}
    </div>
  )
}
