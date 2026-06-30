import React, { useState } from 'react'
import type { GuestEntry } from '@/data/trips'

type Props = {
  value: GuestEntry[]
  onChange: (next: GuestEntry[]) => void
  /** When true, the editor renders without a heading and on a transparent bg (for inline use inside title cards). */
  compact?: boolean
}

/**
 * Inline editor for a structured guest list.
 *
 * Features:
 *  - Add a guest (name required) with optional note and tentative flag
 *  - Edit name / note / tentative on any existing guest
 *  - Remove a guest
 *  - Move up / down to re-order
 *
 * The component is fully controlled: it never writes to the network itself.
 * The parent decides when to persist (e.g. on Save in the trip-edit flow,
 * or auto-save after each change inside the consolidated chapter card).
 */
export function GuestListEditor({ value, onChange, compact }: Props) {
  const [newName, setNewName] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newTentative, setNewTentative] = useState(false)

  function updateAt(i: number, patch: Partial<GuestEntry>) {
    onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g)))
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function moveUp(i: number) {
    if (i <= 0) return
    const next = value.slice()
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    onChange(next)
  }

  function moveDown(i: number) {
    if (i >= value.length - 1) return
    const next = value.slice()
    ;[next[i + 1], next[i]] = [next[i], next[i + 1]]
    onChange(next)
  }

  function addNew() {
    const name = newName.trim()
    if (!name) return
    const note = newNote.trim()
    const entry: GuestEntry = { name }
    if (note) entry.note = note
    if (newTentative) entry.tentative = true
    onChange([...value, entry])
    setNewName('')
    setNewNote('')
    setNewTentative(false)
  }

  const wrapperClass = compact
    ? 'mt-2 rounded-lg border border-white/25 bg-black/30 p-2 space-y-2'
    : 'mt-2 rounded-lg border border-white/25 bg-black/30 p-3 space-y-2'

  return (
    <div className={wrapperClass}>
      {!compact && (
        <div className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">
          Guest list
        </div>
      )}

      {/* Existing rows */}
      {value.length === 0 ? (
        <div className="text-[11px] text-white/60 italic">No guests yet — add one below.</div>
      ) : (
        <div className="space-y-1.5">
          {value.map((g, i) => (
            <div
              key={i}
              className={`flex flex-wrap items-center gap-1.5 rounded px-1.5 py-1 ${g.tentative ? 'border border-dashed border-white/40' : 'bg-white/5'}`}
            >
              <input
                value={g.name}
                onChange={e => updateAt(i, { name: e.target.value })}
                placeholder="Name"
                className="flex-1 min-w-[6rem] bg-black/30 border border-white/25 rounded px-1.5 py-0.5 text-xs text-white"
              />
              <input
                value={g.note || ''}
                onChange={e => updateAt(i, { note: e.target.value || undefined })}
                placeholder="Note (optional)"
                className="flex-1 min-w-[6rem] bg-black/30 border border-white/25 rounded px-1.5 py-0.5 text-[11px] text-white/85 placeholder:text-white/40"
              />
              <label className="flex items-center gap-1 text-[10px] text-white/80 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!g.tentative}
                  onChange={e => updateAt(i, { tentative: e.target.checked || undefined })}
                  className="w-3 h-3 accent-red-500"
                />
                maybe
              </label>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  title="Move up"
                  className="p-0.5 rounded text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move guest up"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === value.length - 1}
                  title="Move down"
                  className="p-0.5 rounded text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move guest down"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <button
                  onClick={() => removeAt(i)}
                  title="Remove guest"
                  className="p-0.5 rounded text-red-300 hover:text-red-200"
                  aria-label="Remove guest"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-new row */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/15">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addNew()
            }
          }}
          placeholder="Add guest name"
          className="flex-1 min-w-[6rem] bg-black/30 border border-white/30 rounded px-1.5 py-0.5 text-xs text-white placeholder:text-white/50"
        />
        <input
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addNew()
            }
          }}
          placeholder="Note (optional)"
          className="flex-1 min-w-[6rem] bg-black/30 border border-white/30 rounded px-1.5 py-0.5 text-[11px] text-white/85 placeholder:text-white/40"
        />
        <label className="flex items-center gap-1 text-[10px] text-white/80 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={newTentative}
            onChange={e => setNewTentative(e.target.checked)}
            className="w-3 h-3 accent-red-500"
          />
          maybe
        </label>
        <button
          onClick={addNew}
          disabled={!newName.trim()}
          className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}
