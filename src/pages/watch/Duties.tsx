import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'
import { getCrewName } from '@/lib/auth'
import {
  WATCH_DUTY_SECTIONS,
  WATCH_DUTIES_REMINDERS,
  emptyState,
  localDateKey,
  type WatchDutySection,
  type WatchDutyState,
} from '@/data/watch-duties'
import { finalizeWatchDay, loadWatchDay, saveWatchDay } from '@/lib/watch-api'

function nowTimeHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function sectionProgress(section: WatchDutySection, state: WatchDutyState) {
  const total = section.items.length
  const done = section.items.filter(i => !!state.checks[i.id]).length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export function WatchDutiesPage() {
  const crewName = getCrewName() || ''
  const [today, setToday] = useState(() => localDateKey())
  const [state, setState] = useState<WatchDutyState>(() => emptyState(today, crewName))
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeMsg, setFinalizeMsg] = useState<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // ---- midnight rollover: re-check the local date every minute ----
  useEffect(() => {
    const id = setInterval(() => {
      const cur = localDateKey()
      if (cur !== today) {
        setToday(cur)
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [today])

  // ---- initial load whenever the date changes ----
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadWatchDay(today)
      .then(s => {
        if (cancelled) return
        if (s) {
          setState(s)
        } else {
          setState(emptyState(today, crewName))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  // ---- debounced auto-save on any change (after initial load) ----
  const dirtyRef = useRef(false)
  const saveTimer = useRef<number | null>(null)

  const scheduleSave = useCallback(() => {
    if (loading) return
    dirtyRef.current = true
    setSaveStatus('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      const snapshot = stateRef.current
      const result = await saveWatchDay(snapshot, crewName)
      if (result.ok) {
        dirtyRef.current = false
        setSaveStatus('saved')
        window.setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 1500)
      } else {
        setSaveStatus('error')
      }
    }, 800) as unknown as number
  }, [loading, crewName])

  function patch<K extends keyof WatchDutyState>(key: K, value: WatchDutyState[K]) {
    setState(prev => ({ ...prev, [key]: value }))
    scheduleSave()
  }

  function toggleItem(id: string) {
    setState(prev => ({ ...prev, checks: { ...prev.checks, [id]: !prev.checks[id] } }))
    scheduleSave()
  }

  function patchSectionComment(sectionId: string, value: string) {
    setState(prev => ({ ...prev, sectionComments: { ...prev.sectionComments, [sectionId]: value } }))
    scheduleSave()
  }

  function setSignoff(sectionId: string, patch: Partial<{ name: string; time: string }>) {
    setState(prev => {
      const existing = prev.signoffs[sectionId] || { name: '', time: '' }
      return {
        ...prev,
        signoffs: {
          ...prev.signoffs,
          [sectionId]: { ...existing, ...patch },
        },
      }
    })
    scheduleSave()
  }

  function setSignature(kind: 'handoverSignature' | 'receiptSignature', patch: Partial<{ name: string; time: string }>) {
    setState(prev => ({
      ...prev,
      [kind]: { ...prev[kind], ...patch },
    }))
    scheduleSave()
  }

  function signNowFor(sectionId: string) {
    setSignoff(sectionId, { name: crewName || stateRef.current.crewOnDuty || 'Crew', time: nowTimeHHMM() })
  }

  async function handleFinalize() {
    setFinalizing(true)
    setFinalizeMsg(null)
    // flush any pending save first
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await saveWatchDay(stateRef.current, crewName)
    const result = await finalizeWatchDay(stateRef.current, crewName)
    setFinalizing(false)
    if (result.ok) {
      setFinalizeMsg('Saved to Google Drive')
      if (result.pdfLink) {
        setState(prev => ({ ...prev, pdfLink: result.pdfLink, finalizedAt: new Date().toISOString() }))
      }
    } else {
      setFinalizeMsg(`Export failed: ${result.detail || 'unknown error'}`)
    }
    window.setTimeout(() => setFinalizeMsg(null), 4500)
  }

  const totals = useMemo(() => {
    const total = WATCH_DUTY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0)
    const done = WATCH_DUTY_SECTIONS.reduce(
      (acc, s) => acc + s.items.filter(i => !!state.checks[i.id]).length,
      0,
    )
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [state.checks])

  return (
    <MenuLayout title="Watch Duties" showBack backHref="/watch">
      <div className="space-y-4">
        {/* Hero card */}
        <div className="rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-red-900 via-red-800 to-amber-700 relative">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">M/Y Rise Above</div>
                <div className="text-xl font-bold text-white">Watch Duties</div>
              </div>
              <div className="text-xs text-white/85 font-medium">{formatDisplayDate(today)}</div>
            </div>
            <div className="text-[11px] text-white/85">07:45 – 08:00 for 24 hours · Resets at midnight</div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <input
                value={state.crewOnDuty}
                onChange={e => patch('crewOnDuty', e.target.value)}
                placeholder="Crew member on duty"
                className="bg-black/40 border border-white/30 rounded px-2 py-1.5 text-sm text-white placeholder:text-white/50"
              />
              <input
                value={state.handoverTo}
                onChange={e => patch('handoverTo', e.target.value)}
                placeholder="Watch handover to"
                className="bg-black/40 border border-white/30 rounded px-2 py-1.5 text-sm text-white placeholder:text-white/50"
              />
            </div>
            <div className="pt-1.5">
              <div className="flex items-center justify-between text-[11px] text-white/85 mb-1">
                <span>
                  Progress · {totals.done}/{totals.total}
                </span>
                <span>{totals.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${totals.pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save indicator */}
        <div className="text-[11px] text-muted-foreground -mt-2 flex items-center gap-2">
          {loading && <span>Loading today's checklist…</span>}
          {!loading && saveStatus === 'saving' && <span>Saving…</span>}
          {!loading && saveStatus === 'saved' && <span className="text-emerald-500">Saved</span>}
          {!loading && saveStatus === 'error' && <span className="text-destructive">Save failed — retrying on next change</span>}
          {!loading && state.finalizedAt && (
            <span className="text-primary">· Finalized {new Date(state.finalizedAt).toLocaleString()}</span>
          )}
        </div>

        {/* Sections */}
        {WATCH_DUTY_SECTIONS.map(section => {
          const prog = sectionProgress(section, state)
          const allDone = prog.done === prog.total && prog.total > 0
          return (
            <div
              key={section.id}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <div className="px-4 py-3 bg-gradient-to-r from-secondary to-card border-b border-border">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">
                    {section.time}
                  </span>
                  {section.subtime && (
                    <span className="text-xs font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">
                      {section.subtime}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {prog.done}/{prog.total}
                  </span>
                </div>
                {section.title && (
                  <div className="mt-1.5 text-sm font-semibold text-foreground">{section.title}</div>
                )}
              </div>

              <ul className="divide-y divide-border">
                {section.items.map(item => {
                  const checked = !!state.checks[item.id]
                  return (
                    <li key={item.id} className="px-4 py-2.5">
                      <label className="flex gap-3 items-start cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item.id)}
                          className="mt-1 w-5 h-5 accent-primary cursor-pointer flex-shrink-0"
                        />
                        <span
                          className={`text-sm leading-snug ${checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        >
                          {item.label}
                          {item.note && (
                            <span className="block text-xs text-muted-foreground mt-0.5">{item.note}</span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>

              {/* Per-section comments */}
              <div className="px-4 py-3 border-t border-border bg-secondary/20">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Comments
                </label>
                <textarea
                  value={state.sectionComments[section.id] || ''}
                  onChange={e => patchSectionComment(section.id, e.target.value)}
                  rows={2}
                  placeholder="Notes, issues, anything to flag…"
                  className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Signoff strip */}
              {section.signoff && (
                <div className="px-4 py-3 border-t border-border bg-card">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                      {section.signoffRange || section.time}
                    </span>
                    <span className="text-xs text-muted-foreground">Duties completed · Crew signature</span>
                    {allDone && (
                      <span className="ml-auto text-[10px] text-emerald-500 font-semibold uppercase tracking-wide">
                        All checked
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <input
                      value={state.signoffs[section.id]?.name || ''}
                      onChange={e => setSignoff(section.id, { name: e.target.value })}
                      placeholder="Signed by"
                      className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-sm"
                    />
                    <input
                      value={state.signoffs[section.id]?.time || ''}
                      onChange={e => setSignoff(section.id, { time: e.target.value })}
                      placeholder="HH:MM"
                      className="w-20 bg-secondary/40 border border-border rounded px-2 py-1.5 text-sm font-mono text-center"
                    />
                    <button
                      type="button"
                      onClick={() => signNowFor(section.id)}
                      className="text-[10px] uppercase tracking-wide text-primary px-2 py-1.5 rounded border border-primary/40"
                    >
                      Sign now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* General comments + safety reminders */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            General comments / handover notes
          </label>
          <textarea
            value={state.generalComments}
            onChange={e => patch('generalComments', e.target.value)}
            rows={4}
            placeholder="Anything the next watch needs to know…"
            className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-primary font-semibold">
            Standing orders
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {WATCH_DUTIES_REMINDERS.map((r, i) => (
              <li key={i} className="leading-relaxed">
                · {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Handover + Receipt signatures */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            End-of-watch signatures
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold">Handover signature</div>
              <input
                value={state.handoverSignature.name}
                onChange={e => setSignature('handoverSignature', { name: e.target.value })}
                placeholder="Name"
                className="w-full bg-secondary/40 border border-border rounded px-2 py-1.5 text-sm"
              />
              <input
                value={state.handoverSignature.time}
                onChange={e => setSignature('handoverSignature', { time: e.target.value })}
                placeholder="Date / time"
                className="w-full bg-secondary/40 border border-border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold">Receipt signature</div>
              <input
                value={state.receiptSignature.name}
                onChange={e => setSignature('receiptSignature', { name: e.target.value })}
                placeholder="Name"
                className="w-full bg-secondary/40 border border-border rounded px-2 py-1.5 text-sm"
              />
              <input
                value={state.receiptSignature.time}
                onChange={e => setSignature('receiptSignature', { time: e.target.value })}
                placeholder="Date / time"
                className="w-full bg-secondary/40 border border-border rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Finalize */}
        <div className="pt-1 space-y-2">
          <button
            onClick={handleFinalize}
            disabled={finalizing || loading}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {finalizing ? (
              <>Generating PDF…</>
            ) : state.pdfLink ? (
              <>Re-export PDF to Google Drive</>
            ) : (
              <>Finalize day · Export PDF to Drive</>
            )}
          </button>
          {state.pdfLink && (
            <a
              href={state.pdfLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center h-10 rounded-lg border border-border bg-card text-primary text-sm flex items-center justify-center gap-2"
            >
              Open PDF in Google Drive →
            </a>
          )}
          {finalizeMsg && (
            <div className="text-xs text-center text-muted-foreground">{finalizeMsg}</div>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 pb-1">
          M/Y Rise Above · Watch Duties · Auto-resets at local midnight
        </div>
      </div>
    </MenuLayout>
  )
}
