import React, { useEffect, useRef, useState } from 'react'

interface MultiSelectFilterProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

/**
 * Dropdown multi-select filter chip.
 * - Closed: shows label + count of selections (e.g. "System · 2")
 * - Open: shows scrollable checkbox list of options
 * Dark theme, red accents to match app.
 */
export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
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
    <div className="relative" ref={wrapRef}>
      <button
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
          <span className={`text-xs rounded-full px-1.5 ${hasSel ? 'bg-primary-foreground/20' : 'bg-foreground/10'}`}>
            {selected.length}
          </span>
        )}
        <svg className="w-3 h-3 opacity-70" viewBox="0 0 12 12" fill="none">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-64 max-w-[80vw] rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
            {hasSel && (
              <button type="button" onClick={clear} className="text-xs text-primary hover:underline">
                Clear
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No options</div>
            )}
            {options.map(opt => {
              const isSel = selected.includes(opt)
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(opt)}
                    className="h-4 w-4 accent-red-600"
                  />
                  <span className="truncate flex-1">{opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
