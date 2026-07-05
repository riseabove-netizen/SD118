// Admin-editable per-hour watch schedule + notification enrollment.
// Renders under the ActivePanel when an anchor watch is running.

import React, { useEffect, useMemo, useState } from 'react'
import type { AnchorWatchData, AnchorWatchSign } from '@/data/anchor-watch-seed'
import { fetchSchedule, saveSchedule, buildHourSlots, formatHourLocal, SIGN_MATCH_WINDOW_MS, fetchSubscribedUsers } from '@/lib/anchor-schedule'
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
  // Default view: show only the next upcoming hour. Admin can grow by 3 slots
  // at a time via the button below.
  const [hoursToShow, setHoursToShow] = useState(1)

  const [pushState, setPushState] = useState<{ subscribed: boolean; permission: NotificationPermission } | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  // Crew names enrolled for push — fetched from the server so the admin
  // dropdown lists everyone who can actually receive a notification.
  const [enrolledUsers, setEnrolledUsers] = useState<string[]>([])

  // Per-slot “write in a new name” state. When a slot flips into custom mode
  // the <select> is replaced with a free-text input.
  const [customSlots, setCustomSlots] = useState<Record<string, boolean>>({})

  // Names offered in the admin dropdown — merge push-enrolled users,
  // people who have already signed the watch, and the watch starter.
  const suggestedNames = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    const push = (raw: string) => {
      const n = (raw || '').trim()
      if (!n) return
      const key = n.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      out.push(n)
    }
    for (const u of enrolledUsers) push(u)
    for (const s of (data.signatures || []) as AnchorWatchSign[]) push(s.name || '')
    push(data.startedBy || '')
    out.sort((a, b) => a.localeCompare(b))
    return out
  }, [enrolledUsers, data.signatures, data.startedBy])

  // Build the visible slot list:
  //   • Always include every hour the admin has already assigned or notified.
  //     These stay visible to every crew member (not just admins), so they can
  //     see who is on which watch even hours ahead.
  //   • Admins additionally see `hoursToShow` blank upcoming rows they can fill
  //     (the “+ Add 3 more hours” button grows this).
  //   • Non-admin viewers get at least the next 1 upcoming hour visible even
  //     when nothing is assigned yet, so the card is never empty.
  const slots = useMemo(() => {
    if (!data.startedAt) return []
    const set = new Set<string>()
    // 1) All hours that carry an assignment or a notified flag — for everyone.
    Object.keys(schedule).forEach(k => { if (k) set.add(k) })
    Object.keys(notified).forEach(k => { if (k) set.add(k) })
    // 2) Upcoming lookahead. Take the next N sequential hours starting from
    //    the next top-of-hour after startedAt and add them to the set. This
    //    ensures the admin’s “+ Add 3 more hours” button surfaces blank rows
    //    beyond what’s already filled.
    const nowMs = Date.now()
    const lookaheadCount = admin ? hoursToShow : 1
    const sequential = buildHourSlots(data.startedAt, 48) // upper bound; filter below
    let added = 0
    for (const iso of sequential) {
      if (added >= lookaheadCount) break
      // Skip past hours for the lookahead — only surface upcoming empty rows.
      if (Date.parse(iso) < nowMs - 60 * 60 * 1000) continue
      if (set.has(iso)) continue
      set.add(iso)
      added++
    }
    return Array.from(set).sort()
  }, [data.startedAt, schedule, notified, hoursToShow, admin])

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

  // Pull the list of push-enrolled crew so the admin dropdown shows them.
  // Refetch after the schedule loads (so newly-added subscribers show up when
  // the panel is re-opened) and after a successful save.
  useEffect(() => {
    fetchSubscribedUsers().then(setEnrolledUsers).catch(() => setEnrolledUsers([]))
  }, [data.startedAt])

  const setName = (iso: string, name: string) => {
    setScheduleState(prev => ({ ...prev, [iso]: name }))
  }

  // Sentinel value used inside the <select> to switch to free-text mode.
  const CUSTOM_OPT = '__custom__'

  const handleSelectChange = (iso: string, value: string) => {
    if (value === CUSTOM_OPT) {
      setCustomSlots(prev => ({ ...prev, [iso]: true }))
      setName(iso, '')
      return
    }
    setCustomSlots(prev => ({ ...prev, [iso]: false }))
    setName(iso, value)
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
          ? 'Assign a keeper for the next hour. Add more hours 3 at a time as you plan ahead. They\u2019ll get a push notification when it\u2019s their turn.'
          : 'The captain assigns the watch schedule. Enable notifications below to be pinged when it\u2019s your turn \u2014 all assigned hours are shown so you can see who\u2019s on next.'}
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
                // A sign-off counts against a slot only if it's within the
                // configured window of the scheduled hour (default: 20 min).
                const wasSignedFor = !!val && (data.signatures || []).some(s => {
                  const t = Date.parse(s.timestamp)
                  return Math.abs(t - slotMs) < SIGN_MATCH_WINDOW_MS &&
                    (s.name || '').trim().toLowerCase() === val.trim().toLowerCase()
                })
                return (
                  <li key={iso} className={`grid grid-cols-[minmax(120px,auto)_1fr_auto] items-center gap-2 px-3 py-2 text-sm ${isNow ? 'bg-red-500/10' : ''}`}>
                    <span className={`font-medium ${isPast && !wasSignedFor ? 'text-muted-foreground line-through' : ''}`}>
                      {formatHourLocal(iso)}
                    </span>
                    {admin ? (() => {
                      // Custom (write-in) mode: either the admin explicitly chose
                      // “Type a new name…”, or the current value is not one of
                      // the enrolled/known names.
                      const isCustom =
                        customSlots[iso] ||
                        (!!val && !suggestedNames.some(n => n.toLowerCase() === val.toLowerCase()))
                      if (isCustom) {
                        return (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={val}
                              disabled={disabled}
                              onChange={e => setName(iso, e.target.value)}
                              placeholder="Type a new name…"
                              className="w-full rounded border border-border bg-secondary/40 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                            />
                            <button
                              type="button"
                              onClick={() => { setCustomSlots(prev => ({ ...prev, [iso]: false })); setName(iso, '') }}
                              disabled={disabled}
                              className="text-[11px] text-muted-foreground hover:text-foreground underline"
                              title="Back to dropdown"
                            >
                              list
                            </button>
                          </div>
                        )
                      }
                      return (
                        <select
                          value={val || ''}
                          disabled={disabled}
                          onChange={e => handleSelectChange(iso, e.target.value)}
                          className="w-full rounded border border-border bg-secondary/40 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        >
                          <option value="">— Unassigned —</option>
                          {suggestedNames.map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                          <option value={CUSTOM_OPT}>+ Type a new name…</option>
                        </select>
                      )
                    })() : (
                      <span className={wasSignedFor ? 'line-through text-muted-foreground' : ''}>
                        {val || <span className="text-muted-foreground">—</span>}
                      </span>
                    )}
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
            onClick={() => setHoursToShow(h => h + 3)}
            className="text-xs px-2.5 py-1 rounded border border-border hover:bg-secondary"
          >
            + Add 3 more hours
          </button>
          {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        </div>
      )}
    </div>
  )
}
