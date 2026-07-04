import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useRoute } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { getDeckhandSection, type DeckhandSection } from '@/data/deckhand-duties'
import { getCrewName } from '@/lib/auth'

const TONE_CLASSES: Record<
  DeckhandSection['tone'],
  { border: string; accent: string; check: string; ring: string; done: string }
> = {
  blue: {
    border: 'border-border',
    accent: 'text-blue-400',
    check: 'bg-blue-500 border-blue-500',
    ring: 'focus-visible:ring-blue-500/60',
    done: 'bg-blue-500/5',
  },
  red: {
    border: 'border-destructive/30',
    accent: 'text-destructive',
    check: 'bg-destructive border-destructive',
    ring: 'focus-visible:ring-destructive/60',
    done: 'bg-destructive/5',
  },
  orange: {
    border: 'border-orange-500/30',
    accent: 'text-orange-400',
    check: 'bg-orange-500 border-orange-500',
    ring: 'focus-visible:ring-orange-500/60',
    done: 'bg-orange-500/5',
  },
  amber: {
    border: 'border-amber-500/30',
    accent: 'text-amber-400',
    check: 'bg-amber-500 border-amber-500',
    ring: 'focus-visible:ring-amber-500/60',
    done: 'bg-amber-500/5',
  },
}

interface CheckState {
  checked: boolean
  by?: string
  at?: string // ISO timestamp
}

interface DayChecklist {
  date: string // YYYY-MM-DD
  items: Record<number, CheckState>
}

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function storageKey(sectionId: string): string {
  return `deckhand-duties:${sectionId}`
}

function loadState(sectionId: string): DayChecklist {
  const today = todayKey()
  try {
    const raw = localStorage.getItem(storageKey(sectionId))
    if (raw) {
      const parsed = JSON.parse(raw) as DayChecklist
      if (parsed.date === today) return parsed
    }
  } catch {}
  return { date: today, items: {} }
}

function saveState(sectionId: string, state: DayChecklist): void {
  try {
    localStorage.setItem(storageKey(sectionId), JSON.stringify(state))
  } catch {}
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function DeckhandDutiesSectionPage() {
  const [, params] = useRoute<{ sectionId: string }>('/ism/deckhand-duties/:sectionId')
  const [, setLocation] = useLocation()
  const section = params?.sectionId ? getDeckhandSection(params.sectionId) : undefined

  const [state, setState] = useState<DayChecklist>(() =>
    section ? loadState(section.id) : { date: todayKey(), items: {} }
  )

  // Reload when section changes
  useEffect(() => {
    if (section) setState(loadState(section.id))
  }, [section?.id])

  const toggle = useCallback(
    (idx: number) => {
      if (!section) return
      setState(prev => {
        const current = prev.items[idx]
        const newChecked = !current?.checked
        const next: DayChecklist = {
          date: prev.date,
          items: {
            ...prev.items,
            [idx]: newChecked
              ? { checked: true, by: getCrewName() || 'crew', at: new Date().toISOString() }
              : { checked: false },
          },
        }
        saveState(section.id, next)
        return next
      })
    },
    [section]
  )

  const resetAll = useCallback(() => {
    if (!section) return
    if (!confirm(`Reset all ${section.items.length} duties in "${section.title}"?`)) return
    const next: DayChecklist = { date: todayKey(), items: {} }
    saveState(section.id, next)
    setState(next)
  }, [section])

  const { doneCount, totalCount, allDone } = useMemo(() => {
    if (!section) return { doneCount: 0, totalCount: 0, allDone: false }
    const total = section.items.length
    const done = section.items.reduce(
      (acc, _, idx) => acc + (state.items[idx]?.checked ? 1 : 0),
      0
    )
    return { doneCount: done, totalCount: total, allDone: total > 0 && done === total }
  }, [section, state])

  if (!section) {
    return (
      <MenuLayout title="Section not found" showBack backHref="/ism/deckhand-duties">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            The requested duties section could not be found.
          </p>
          <button
            onClick={() => setLocation('/ism/deckhand-duties')}
            className="text-primary underline"
          >
            Back to Exterior Daily Duties
          </button>
        </div>
      </MenuLayout>
    )
  }

  const tone = TONE_CLASSES[section.tone]
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  return (
    <MenuLayout
      title={section.title}
      showBack
      backHref="/ism/deckhand-duties"
      rightAction={
        doneCount > 0
          ? {
              label: 'Reset',
              ariaLabel: 'Reset all duties',
              onClick: resetAll,
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              ),
            }
          : undefined
      }
    >
      <div className="space-y-5">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wide ${tone.accent}`}>
            Deckhand Duties SOP
          </div>
          <h2 className="text-xl font-bold mt-1">{section.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
        </div>

        {/* Progress bar */}
        <div className={`rounded-xl border ${tone.border} bg-card p-4`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">
              {doneCount} / {totalCount} complete
            </div>
            <div className={`text-sm font-semibold ${tone.accent}`}>{pct}%</div>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full ${tone.check.split(' ')[0]} transition-all duration-300`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {allDone && (
            <div className={`mt-3 text-sm font-medium ${tone.accent} flex items-center gap-2`}>
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              All duties complete for today.
            </div>
          )}
        </div>

        {/* Checklist */}
        <ul className="space-y-2">
          {section.items.map((item, idx) => {
            const st = state.items[idx]
            const checked = !!st?.checked
            return (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className={`w-full flex gap-3 items-start p-4 rounded-xl border ${tone.border} bg-card text-left transition-colors hover:bg-secondary active:bg-secondary/80 focus:outline-none focus-visible:ring-2 ${tone.ring} ${
                    checked ? tone.done : ''
                  }`}
                  aria-pressed={checked}
                >
                  <span
                    className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                      checked ? tone.check : 'border-muted-foreground/40 bg-transparent'
                    }`}
                  >
                    {checked && (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-sm leading-relaxed ${
                        checked ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      <span className="text-muted-foreground font-mono text-xs mr-2">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {item}
                    </span>
                    {checked && st?.by && st?.at && (
                      <span className="block mt-1 text-xs text-muted-foreground">
                        ✓ {st.by} · {fmtTime(st.at)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Resets automatically at midnight · M/Y Rise Above
        </p>
      </div>
    </MenuLayout>
  )
}
