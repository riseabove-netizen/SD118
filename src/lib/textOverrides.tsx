/**
 * Admin text-override system.
 *
 * - All static labels/headings in the app are wrapped in <EditableText id="..." defaultText="..." />.
 * - For non-admin users (crew / viewer / guest / unauthenticated) this renders a plain <span>
 *   with either the override text (if one exists) or the default.
 * - For admins it renders a click-to-edit span. Saving persists to the backend guides API
 *   (single guide row, id = TEXT_OVERRIDES_GUIDE_ID, markdown = JSON dict of {id: text}).
 * - Every browser fetches the overrides at app load and uses them. Updates propagate after refresh
 *   (and immediately for the editing admin).
 *
 * We piggy-back on /api/guides instead of adding a new endpoint because we're at the
 * Vercel Hobby function cap (12/12).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchGuide, saveGuide } from './guides'
import { isAdmin, getCrewName } from './auth'

const TEXT_OVERRIDES_GUIDE_ID = 'text-overrides'
const TEXT_OVERRIDES_GUIDE_TITLE = 'App Text Overrides'

type Overrides = Record<string, string>

interface TextOverridesContextValue {
  overrides: Overrides
  ready: boolean
  saving: boolean
  setOverride: (id: string, text: string) => Promise<void>
  clearOverride: (id: string) => Promise<void>
}

const TextOverridesContext = createContext<TextOverridesContextValue>({
  overrides: {},
  ready: false,
  saving: false,
  setOverride: async () => {},
  clearOverride: async () => {},
})

function parseOverrides(markdown: string | undefined | null): Overrides {
  if (!markdown) return {}
  try {
    const o = JSON.parse(markdown)
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      // sanitize: only keep string values
      const out: Overrides = {}
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
  } catch {
    // ignore — return empty
  }
  return {}
}

export function TextOverridesProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>({})
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  // Debounce saves so rapid edits don't hammer the API.
  const saveTimerRef = useRef<number | null>(null)
  const pendingRef = useRef<Overrides | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const guide = await fetchGuide(TEXT_OVERRIDES_GUIDE_ID)
        if (!cancelled && guide) {
          setOverrides(parseOverrides(guide.Markdown))
        }
      } catch {
        // first run — guide doesn't exist yet, that's fine
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const flush = useCallback(async () => {
    const next = pendingRef.current
    if (!next) return
    pendingRef.current = null
    setSaving(true)
    try {
      await saveGuide({
        id: TEXT_OVERRIDES_GUIDE_ID,
        title: TEXT_OVERRIDES_GUIDE_TITLE,
        category: 'System',
        markdown: JSON.stringify(next),
        user: getCrewName() || 'admin',
      })
    } catch (err) {
      console.error('Failed to save text overrides', err)
    } finally {
      setSaving(false)
    }
  }, [])

  const queueSave = useCallback(
    (next: Overrides) => {
      pendingRef.current = next
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        void flush()
      }, 600)
    },
    [flush],
  )

  const setOverride = useCallback(
    async (id: string, text: string) => {
      setOverrides(prev => {
        const next = { ...prev, [id]: text }
        queueSave(next)
        return next
      })
    },
    [queueSave],
  )

  const clearOverride = useCallback(
    async (id: string) => {
      setOverrides(prev => {
        const next = { ...prev }
        delete next[id]
        queueSave(next)
        return next
      })
    },
    [queueSave],
  )

  const value = useMemo(
    () => ({ overrides, ready, saving, setOverride, clearOverride }),
    [overrides, ready, saving, setOverride, clearOverride],
  )

  return <TextOverridesContext.Provider value={value}>{children}</TextOverridesContext.Provider>
}

export function useTextOverrides() {
  return useContext(TextOverridesContext)
}

/**
 * Render a piece of static text. Admins can click to edit; everyone else sees the current value.
 *
 *   <EditableText id="menu.title" defaultText="Rise Above" />
 *   <EditableText id="ism.index.heading" defaultText="ISM" as="h1" />
 */
export function EditableText({
  id,
  defaultText,
  as: Tag = 'span',
  className,
  multiline = false,
}: {
  id: string
  defaultText: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  multiline?: boolean
}) {
  const { overrides, setOverride, clearOverride } = useTextOverrides()
  const admin = isAdmin()
  const current = overrides[id] ?? defaultText
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(current)

  // Keep the local draft in sync if the override changes externally.
  useEffect(() => {
    if (!editing) setDraft(current)
  }, [current, editing])

  if (!admin) {
    return <Tag className={className}>{current}</Tag>
  }

  function startEdit(e: React.MouseEvent) {
    // Only respond to clicks that hold the Alt key — otherwise normal taps
    // on buttons/headings still work. Admin uses Alt+Click to enter edit mode.
    if (!e.altKey) return
    e.preventDefault()
    e.stopPropagation()
    setEditing(true)
  }

  async function commit() {
    const next = draft.trim()
    setEditing(false)
    if (next === defaultText) {
      // Reset to default — clear the override entirely.
      if (overrides[id] !== undefined) await clearOverride(id)
    } else if (next !== current) {
      await setOverride(id, next)
    }
  }

  function cancel() {
    setDraft(current)
    setEditing(false)
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Escape') cancel()
          }}
          className={`bg-yellow-500/10 border border-yellow-500/60 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-yellow-500/40 ${className ?? ''}`}
          rows={3}
        />
      )
    }
    return (
      <input
        value={draft}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          } else if (e.key === 'Escape') {
            cancel()
          }
        }}
        className={`bg-yellow-500/10 border border-yellow-500/60 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-yellow-500/40 ${className ?? ''}`}
      />
    )
  }

  return (
    <Tag
      className={`${className ?? ''} cursor-text hover:outline hover:outline-1 hover:outline-yellow-500/40 hover:outline-offset-2 rounded`}
      onClick={startEdit}
      title="Alt+Click to edit"
      data-editable-id={id}
    >
      {current}
    </Tag>
  )
}

/** Returns the override value if any (or default), useful when you need the raw string. */
export function useTextOverride(id: string, defaultText: string): string {
  const { overrides } = useTextOverrides()
  return overrides[id] ?? defaultText
}
