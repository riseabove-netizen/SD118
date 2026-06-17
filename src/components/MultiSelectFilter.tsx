import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface MultiSelectFilterProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

/**
 * Dropdown multi-select filter chip.
 *
 * The dropdown panel is rendered through a portal with `position: fixed` so
 * it escapes any `overflow-x-auto` ancestor (the filter chip row scrolls
 * horizontally) and stacks above everything else on the page.
 */
export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Position the panel below the chip whenever it opens or the viewport changes.
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const btn = btnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelWidth = 256 // w-64
      const margin = 8
      let left = r.left
      // Keep panel inside viewport horizontally
      const maxLeft = window.innerWidth - panelWidth - margin
      if (left > maxLeft) left = Math.max(margin, maxLeft)
      if (left < margin) left = margin
      setPos({ top: r.bottom + 4, left, width: panelWidth })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (btnRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter(x => x !== opt))
    else onChange([...selected, opt])
  }

  function clear() {
    onChange([])
  }

  const hasSel = selected.length > 0

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`shrink-0 px-3 h-9 rounded-full text-sm border flex items-center gap-1.5 transition-colors ${
          hasSel
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-secondary text-foreground border-border'
        }`}
      >
        <span>{label}</span>
        {hasSel && (
          <span className="text-xs rounded-full px-1.5 bg-primary-foreground/20">
            {selected.length}
          </span>
        )}
        <svg className="w-3 h-3 opacity-70" viewBox="0 0 12 12" fill="none">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <>
          {/* Light scrim — taps anywhere outside close it on touch devices */}
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            className="fixed z-[1000] rounded-lg border border-border bg-card shadow-2xl overflow-hidden"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
              {hasSel && (
                <button type="button" onClick={clear} className="text-xs text-primary hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto py-1 bg-card">
              {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No options</div>
              )}
              {options.map(opt => {
                const isSel = selected.includes(opt)
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(opt)}
                      className="h-4 w-4 accent-red-600"
                    />
                    <span className="truncate flex-1">{opt || '(blank)'}</span>
                  </label>
                )
              })}
            </div>
            <div className="border-t border-border px-3 py-2 bg-card flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-primary font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
