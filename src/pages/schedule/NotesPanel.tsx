import { useEffect, useState } from 'react'
import { addNote, deleteNote, formatNoteTime, listNotes, updateNote, type TripNote } from '@/lib/trip-notes'
import { getCrewName, isAdmin } from '@/lib/auth'

/**
 * Notes panel that can render either trip-level notes (dayIso='') or
 * day-level notes (dayIso='YYYY-MM-DD'). Anyone signed in can add.
 *
 * Edit rules:
 *   • Anyone can post a new note (server has no auth gate).
 *   • The author of a note can edit their own (matched by author-name).
 *   • Admins can edit and delete any note (server validates HMAC token).
 *
 * Notes are fetched once at the top level (Trip page) and passed down to
 * each DayCard via the `notes` prop, so we don't hit /api/trips per day.
 */

function NoteRow({
  note,
  currentAuthor,
  isAdminViewer,
  onUpdated,
  onDeleted,
}: {
  note: TripNote
  currentAuthor: string
  isAdminViewer: boolean
  onUpdated: (n: TripNote) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.text)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const noteAuthor = (note.author || '').trim().toLowerCase()
  const me = (currentAuthor || '').trim().toLowerCase()
  const isOwnNote = !!me && me === noteAuthor
  const canEdit = isOwnNote || isAdminViewer
  const canDelete = isAdminViewer

  async function save() {
    const t = draft.trim()
    if (!t) {
      setErr('Note cannot be empty')
      return
    }
    setBusy(true)
    setErr(null)
    const result = await updateNote({
      id: note.id,
      author: currentAuthor || '',
      text: t,
    })
    setBusy(false)
    if (!result.ok || !result.note) {
      setErr(result.detail || 'Could not save')
      return
    }
    onUpdated(result.note)
    setEditing(false)
  }

  async function remove() {
    setBusy(true)
    setErr(null)
    const result = await deleteNote(note.id)
    setBusy(false)
    if (!result.ok) {
      setErr(result.detail || 'Could not delete')
      setConfirmDelete(false)
      return
    }
    onDeleted(note.id)
  }

  return (
    <li className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground">{note.author || 'guest'}</span>
        <span className="text-[10px] text-muted-foreground">{formatNoteTime(note.createdAt)}</span>

        {(canEdit || canDelete) && !editing && (
          <div className="ml-auto flex items-center gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setDraft(note.text)
                  setEditing(true)
                  setErr(null)
                }}
                className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                title="Edit note"
                aria-label="Edit note"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1 rounded hover:bg-background text-muted-foreground hover:text-primary"
                title="Delete note (admin)"
                aria-label="Delete note"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-1 space-y-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={Math.max(2, Math.min(8, draft.split('\n').length + 1))}
            maxLength={4000}
            className="w-full text-sm bg-background border border-border rounded px-2 py-1.5 text-foreground resize-y min-h-[40px]"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !draft.trim() || draft.trim() === note.text}
              className="text-xs font-semibold px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setDraft(note.text)
                setErr(null)
              }}
              disabled={busy}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            {err && <span className="text-xs text-primary">{err}</span>}
          </div>
        </div>
      ) : (
        <>
          <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-snug mt-0.5">{note.text}</div>
          {confirmDelete && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Delete this note?</span>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="font-semibold px-2 py-0.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              {err && <span className="text-primary">{err}</span>}
            </div>
          )}
        </>
      )}
    </li>
  )
}

export function NotesPanel({
  tripId,
  dayIso,
  notes,
  onAdded,
  onUpdated,
  onDeleted,
  compact,
}: {
  tripId: string
  dayIso?: string // '' or undefined = trip-level
  notes: TripNote[] // pre-filtered for this scope
  onAdded: (note: TripNote) => void
  onUpdated: (note: TripNote) => void
  onDeleted: (id: string) => void
  compact?: boolean
}) {
  // Notes are open to everyone — logged-in crew/viewer/admin, AND guests
  // reaching the trip via a shared link. The backend has no auth requirement
  // for add. Edit requires author-match; delete requires admin token.
  const [text, setText] = useState('')
  const [author, setAuthor] = useState<string>(() => getCrewName() || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)
  const isAdminViewer = isAdmin()

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
                <NoteRow
                  key={n.id}
                  note={n}
                  currentAuthor={author}
                  isAdminViewer={isAdminViewer}
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                />
              ))}
            </ul>
          )}

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
            {author && (
              <p className="text-[10px] text-muted-foreground leading-snug">
                Tip: keep this name consistent so you can edit your own notes later.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Hook: load every note for a trip once. Returns the list plus handlers
 * that mutate local state so changes appear instantly.
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
  function update(n: TripNote) {
    setNotes(prev => prev.map(p => (p.id === n.id ? n : p)))
  }
  function remove(id: string) {
    setNotes(prev => prev.filter(p => p.id !== id))
  }

  return { notes, loaded, add, update, remove }
}
