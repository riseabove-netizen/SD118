import { useEffect, useState } from 'react'
import { addNote, formatNoteTime, listNotes, type TripNote } from '@/lib/trip-notes'
import { getCrewName } from '@/lib/auth'

/**
 * Notes panel that can render either trip-level notes (dayIso='') or
 * day-level notes (dayIso='YYYY-MM-DD'). Anyone signed in can add.
 *
 * Notes are fetched once at the top level (Trip page) and passed down to
 * each DayCard via the `notes` prop, so we don't hit /api/trips per day.
 * The "add" form lives inside this component and posts to the backend.
 */

export function NotesPanel({
  tripId,
  dayIso,
  notes,
  onAdded,
  compact,
}: {
  tripId: string
  dayIso?: string // '' or undefined = trip-level
  notes: TripNote[] // pre-filtered for this scope
  onAdded: (note: TripNote) => void
  compact?: boolean
}) {
  // Notes are open to everyone — logged-in crew/viewer/admin, AND guests
  // reaching the trip via a shared link. The backend has no auth requirement.
  const [text, setText] = useState('')
  const [author, setAuthor] = useState<string>(() => getCrewName() || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)

  const scopeKey = dayIso || ''
  const scoped = notes.filter(n => (n.dayIso || '') === scopeKey)

  async function submit() {
    const t = text.trim()
    if (!t) return
    setBusy(true)
    setErr(null)
    const result = await addNote({
      tripId,
      dayIso: scopeKey,
      author: (author || 'guest').trim().slice(0, 80) || 'guest',
      text: t,
    })
    setBusy(false)
    if (!result.ok || !result.note) {
      setErr(result.detail || 'Could not save note')
      return
    }
    onAdded(result.note)
    setText('')
  }

  const headerLabel = scopeKey ? 'Day notes' : 'Trip notes'
  const placeholder = scopeKey
    ? 'Add a note for this day — anyone can post'
    : 'Add a note for the whole trip — anyone can post'

  return (
    <div className={compact ? 'px-4 py-3 border-t border-border bg-secondary/20' : 'rounded-2xl border border-border bg-card overflow-hidden'}>
      {!compact && (
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-secondary to-card flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span className="text-sm font-bold text-foreground">{headerLabel}</span>
          <span className="text-xs text-muted-foreground">· anyone can add</span>
          {scoped.length > 0 && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              {scoped.length}
            </span>
          )}
        </div>
      )}

      {compact && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center gap-2 text-left"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Notes</span>
          {scoped.length > 0 ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {scoped.length}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Add a note</span>
          )}
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 ml-auto text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {expanded && (
        <div className={compact ? 'mt-2 space-y-2' : 'p-4 space-y-3'}>
          {scoped.length > 0 && (
            <ul className="space-y-2">
              {scoped.map(n => (
                <li key={n.id} className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{n.author || 'guest'}</span>
                    <span className="text-[10px] text-muted-foreground">{formatNoteTime(n.createdAt)}</span>
                  </div>
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-snug mt-0.5">{n.text}</div>
                </li>
              ))}
            </ul>
          )}

          {(
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                  className="w-32 text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground"
                />
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={placeholder}
                  rows={compact ? 2 : 2}
                  maxLength={4000}
                  className="flex-1 text-sm bg-background border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground resize-y min-h-[34px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !text.trim()}
                  className="text-xs font-semibold px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Add note'}
                </button>
                {text && (
                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                {err && <span className="text-xs text-primary">{err}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Hook: load every note for a trip once. Returns the list plus an `add`
 * handler that mutates local state so newly-posted notes appear instantly.
 */
export function useTripNotes(tripId: string) {
  const [notes, setNotes] = useState<TripNote[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    listNotes(tripId).then(list => {
      if (cancelled) return
      setNotes(list)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [tripId])

  function add(n: TripNote) {
    setNotes(prev => [n, ...prev.filter(p => p.id !== n.id)])
  }

  return { notes, loaded, add }
}
