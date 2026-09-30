// Calendar-interval / as-needed items that belong to an hour-based
// system page (e.g. watermaker pre-filter swaps on Watermaker — Top).
// Logs go to the calendar-service sheet under the original calendar
// system id + unit, so existing history is preserved.

import React, { useEffect, useState } from 'react'
import { getCrewName, canWrite } from '@/lib/auth'
import { mergedCalendarUnitsFor, intervalLabel } from '@/data/calendar-systems'
import {
  fetchCalendarServiceEvents,
  logCalendarService,
  buildStatusMap,
  type CalendarServiceEvent,
} from '@/lib/calendar-service-api'

export function MergedCalendarItemsCard({ maintenanceSystemId }: { maintenanceSystemId: string }) {
  const merged = mergedCalendarUnitsFor(maintenanceSystemId)
  const [eventsBySystem, setEventsBySystem] = useState<Record<string, CalendarServiceEvent[]>>({})
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function reload() {
    const out: Record<string, CalendarServiceEvent[]> = {}
    await Promise.all(merged.map(async m => {
      try { out[m.system.id] = await fetchCalendarServiceEvents(m.system.id) } catch { out[m.system.id] = [] }
    }))
    setEventsBySystem(out)
  }

  useEffect(() => { if (merged.length) reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [maintenanceSystemId])

  if (merged.length === 0) return null

  async function save(systemId: string, unitId: string, itemId: string) {
    setSaving(true); setMsg(null)
    try {
      await logCalendarService({
        systemId,
        unitIds: [unitId],
        itemIds: [itemId],
        technician: getCrewName() || 'crew',
        notes: notes.trim(),
        serviceDate,
      })
      setOpenKey(null); setNotes('')
      setMsg('Logged.')
      setTimeout(() => setMsg(null), 3000)
      await reload()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">As-needed service</div>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
      {merged.map(({ system, unitId }) => {
        const status = buildStatusMap(system, eventsBySystem[system.id] || [])
        return system.items.map(it => {
          const key = `${system.id}|${unitId}|${it.id}`
          const st = status[`${unitId}|${it.id}`]
          const last = st?.lastDate
          return (
            <div key={key} className="space-y-2 border-b border-border/40 last:border-b-0 pb-3 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-red-400">
                    {it.label} <span className="text-muted-foreground font-normal">· {intervalLabel(it.interval)}</span>
                  </div>
                  {it.detail && <div className="text-[11px] text-muted-foreground mt-0.5">{it.detail}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {last ? `Last done ${new Date(last + (last.length === 10 ? 'T12:00:00' : '')).toLocaleDateString()} (${st.daysAgo} d ago)` : 'Not logged yet'}
                  </div>
                </div>
                {canWrite() && (
                  <button
                    onClick={() => setOpenKey(openKey === key ? null : key)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-red-500/40 text-red-300 hover:bg-red-500/10 font-semibold"
                  >
                    {openKey === key ? 'Cancel' : 'Log'}
                  </button>
                )}
              </div>
              {openKey === key && (
                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={e => setServiceDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  />
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => save(system.id, unitId, it.id)}
                    disabled={saving}
                    className="text-xs px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )
        })
      })}
    </div>
  )
}
