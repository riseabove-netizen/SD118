// Perform Air Handler service — one zone at a time (guest or crew).
//
// The user ticks the AHUs they're servicing (grouped by area), works
// through the shared checklist, adds notes, and submits. One log row is
// written per unit selected so the status page can query "last service
// per unit" without any post-processing.

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getCrewName } from '@/lib/auth'
import {
  AIR_HANDLERS,
  AIR_HANDLER_CHECKLIST,
  unitsByZone,
  type AirHandlerUnit,
} from '@/data/air-handlers'
import {
  fetchAirHandlerEvents,
  lastServiceByUnit,
  daysSince,
  logAirHandlerService,
  type AirHandlerEvent,
} from '@/lib/air-handlers-api'

type Zone = 'guest' | 'crew'

function groupBy(units: AirHandlerUnit[]): { group: string; units: AirHandlerUnit[] }[] {
  const map = new Map<string, AirHandlerUnit[]>()
  for (const u of units) {
    const g = u.group || 'Other'
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(u)
  }
  return [...map.entries()].map(([group, units]) => ({ group, units }))
}

export function PerformAirHandlersPage() {
  const params = useParams<{ zone: string }>()
  const zone = (params.zone === 'crew' ? 'crew' : 'guest') as Zone
  const [, setLocation] = useLocation()

  const [events, setEvents] = useState<AirHandlerEvent[]>([])
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState<Set<string>>(new Set(AIR_HANDLER_CHECKLIST.map(c => c.id)))
  const [technician, setTechnician] = useState('')
  const [notes, setNotes] = useState('')
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setTechnician(getCrewName() || '')
    fetchAirHandlerEvents().then(setEvents).catch(() => {})
  }, [])

  const units = useMemo(() => unitsByZone(zone), [zone])
  const groups = useMemo(() => groupBy(units), [units])
  const lastByUnit = useMemo(() => lastServiceByUnit(events), [events])

  function toggleUnit(id: string) {
    setSelectedUnits(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll(unitIds: string[]) {
    setSelectedUnits(prev => {
      const allSelected = unitIds.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) unitIds.forEach(id => next.delete(id))
      else unitIds.forEach(id => next.add(id))
      return next
    })
  }
  function selectDueOnly() {
    const due = new Set<string>()
    for (const u of units) {
      const ev = lastByUnit[u.id]
      const d = ev ? daysSince(ev.ServiceDate || ev.Timestamp) : Infinity
      if (d >= 30) due.add(u.id)
    }
    setSelectedUnits(due)
  }
  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function submit() {
    setErr(null); setMsg(null)
    if (selectedUnits.size === 0) { setErr('Pick at least one AHU'); return }
    if (checked.size === 0) { setErr('Tick at least one checklist item'); return }
    setSubmitting(true)
    try {
      const resp = await logAirHandlerService({
        unitIds: [...selectedUnits],
        zone,
        technician,
        notes,
        checklistIds: [...checked],
        serviceDate,
      })
      setMsg(`Logged ${resp.count} unit(s). Event ${resp.eventId}.`)
      setSelectedUnits(new Set())
      // Refresh event list so status table updates on nav back
      fetchAirHandlerEvents().then(setEvents).catch(() => {})
      setTimeout(() => setLocation('/maintenance/air-handlers'), 900)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MenuLayout
      title={`AHU · ${zone === 'guest' ? 'Guest areas' : 'Crew areas'}`}
      showBack
      backHref="/maintenance/air-handlers"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            className="px-2.5 py-1 rounded border border-border hover:bg-secondary"
            onClick={() => setSelectedUnits(new Set(units.map(u => u.id)))}
          >
            Select all
          </button>
          <button
            className="px-2.5 py-1 rounded border border-border hover:bg-secondary"
            onClick={selectDueOnly}
          >
            Select due only
          </button>
          <button
            className="px-2.5 py-1 rounded border border-border hover:bg-secondary"
            onClick={() => setSelectedUnits(new Set())}
          >
            Clear
          </button>
          <div className="ml-auto text-muted-foreground">
            {selectedUnits.size} of {units.length} selected
          </div>
        </div>

        {/* Unit picker grouped by area */}
        <div className="space-y-3">
          {groups.map(g => {
            const groupIds = g.units.map(u => u.id)
            const allInGroup = groupIds.every(id => selectedUnits.has(id))
            return (
              <div key={g.group} className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/40 border-b border-border">
                  <div className="text-xs font-semibold">{g.group}</div>
                  <button
                    className="text-[11px] underline text-muted-foreground hover:text-foreground"
                    onClick={() => toggleAll(groupIds)}
                  >
                    {allInGroup ? 'Deselect group' : 'Select group'}
                  </button>
                </div>
                <ul className="divide-y divide-border/60">
                  {g.units.map(u => {
                    const ev = lastByUnit[u.id]
                    const d = ev ? daysSince(ev.ServiceDate || ev.Timestamp) : Infinity
                    const overdue = d >= 30
                    return (
                      <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selectedUnits.has(u.id)}
                          onChange={() => toggleUnit(u.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{u.label}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {ev ? (
                              <>Last: {ev.ServiceDate || ev.Timestamp.slice(0, 10)} ({d}d ago)</>
                            ) : (
                              <>Never serviced</>
                            )}
                          </div>
                        </div>
                        {overdue && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/15 text-red-300">
                            due
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Checklist */}
        <div className="rounded-lg border border-border">
          <div className="px-3 py-2 border-b border-border bg-secondary/40 text-xs font-semibold">
            Service checklist (applied to each selected AHU)
          </div>
          <ul className="divide-y divide-border/60">
            {AIR_HANDLER_CHECKLIST.map(c => (
              <li key={c.id} className="flex items-start gap-3 px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 accent-primary"
                  checked={checked.has(c.id)}
                  onChange={() => toggleCheck(c.id)}
                />
                <div className="flex-1">
                  <div>{c.label}</div>
                  {c.detail && <div className="text-[11px] text-muted-foreground mt-0.5">{c.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Meta + notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs">
            <div className="text-muted-foreground mb-1">Technician</div>
            <input
              type="text"
              value={technician}
              onChange={e => setTechnician(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              placeholder="Crew name"
            />
          </label>
          <label className="text-xs">
            <div className="text-muted-foreground mb-1">Service date</div>
            <input
              type="date"
              value={serviceDate}
              onChange={e => setServiceDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
        </div>

        <label className="block text-xs">
          <div className="text-muted-foreground mb-1">Notes (optional)</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            placeholder="Filter condition, drain flow, temp differential, anything odd…"
          />
        </label>

        {msg && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs p-2">
            {msg}
          </div>
        )}
        {err && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 text-xs p-2">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation('/maintenance/air-handlers')}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting || selectedUnits.size === 0}>
            {submitting ? 'Logging…' : `Log ${selectedUnits.size || ''} service${selectedUnits.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </MenuLayout>
  )
}
