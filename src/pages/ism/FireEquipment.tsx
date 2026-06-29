import React, { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { fetchGuide, saveGuide } from '@/lib/guides'
import { getCrewName } from '@/lib/auth'
import {
  FIRE_EQUIPMENT_SEED,
  FIRE_EQUIPMENT_GUIDE_ID,
  type FireEqTable,
} from '@/data/fire-equipment-seed'

// We store the structured table state inside the markdown field of a Guide
// row under a stable ID. The markdown looks like:
//
//   <!-- FIRE-EQUIPMENT-DATA:{...json...} -->
//
// followed by an optional rendered representation for human readers. We
// parse/regenerate the JSON on every save.

const DATA_PREFIX = '<!-- FIRE-EQUIPMENT-DATA:'
const DATA_SUFFIX = '-->'

// Migrate any saved table to the new shape: preserve seed's category/deck
// metadata and ensure every table has "Pressure" + "Last Checked By".
function migrate(tables: FireEqTable[]): FireEqTable[] {
  const seedById = new Map(FIRE_EQUIPMENT_SEED.map(t => [t.id, t]))
  return tables.map(t => {
    const seed = seedById.get(t.id)
    const cols = t.columns.slice()
    if (!cols.some(c => c.toLowerCase() === 'pressure')) cols.push('Pressure')
    if (!cols.some(c => c.toLowerCase().startsWith('last checked'))) cols.push('Last Checked By')
    const rows = t.rows.map(r => {
      const v = r.values.slice()
      while (v.length < cols.length) v.push('')
      return { values: v }
    })
    return {
      ...t,
      category: (t as any).category || seed?.category || 'fire',
      deck:     (t as any).deck     || seed?.deck     || 'all',
      columns: cols,
      rows,
    } as FireEqTable
  })
}

function decode(markdown: string): FireEqTable[] {
  if (!markdown) return FIRE_EQUIPMENT_SEED
  const start = markdown.indexOf(DATA_PREFIX)
  if (start < 0) return FIRE_EQUIPMENT_SEED
  const end = markdown.indexOf(DATA_SUFFIX, start + DATA_PREFIX.length)
  if (end < 0) return FIRE_EQUIPMENT_SEED
  const json = markdown.slice(start + DATA_PREFIX.length, end).trim()
  try {
    const data = JSON.parse(json)
    if (Array.isArray(data) && data.every(t => t && typeof t === 'object' && Array.isArray(t.columns) && Array.isArray(t.rows))) {
      return migrate(data as FireEqTable[])
    }
  } catch {}
  return FIRE_EQUIPMENT_SEED
}

function encode(tables: FireEqTable[]): string {
  const json = JSON.stringify(tables)
  const human = tables.map(t => {
    const head = '| ' + t.columns.join(' | ') + ' |'
    const div  = '| ' + t.columns.map(() => '---').join(' | ') + ' |'
    const body = t.rows.map(r => '| ' + r.values.join(' | ') + ' |').join('\n')
    return `## ${t.title}\n\n${head}\n${div}\n${body}\n`
  }).join('\n')
  return `${DATA_PREFIX}${json}${DATA_SUFFIX}\n\n${human}`
}

function newEmptyRow(cols: number): { values: string[] } {
  return { values: new Array(cols).fill('') }
}

export function FireEquipmentPage() {
  const [, setLocation] = useLocation()
  const [tables, setTables] = useState<FireEqTable[]>(FIRE_EQUIPMENT_SEED)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchGuide(FIRE_EQUIPMENT_GUIDE_ID)
      .then(g => {
        if (cancelled) return
        setTables(decode(g?.Markdown || ''))
        setSavedAt(g?.['Updated At'] || null)
        setUpdatedBy(g?.['Updated By'] || null)
      })
      .catch(() => {
        // No existing record yet — keep seed values.
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const updateCell = (ti: number, ri: number, ci: number, value: string) => {
    setTables(prev => prev.map((t, i) => {
      if (i !== ti) return t
      const rows = t.rows.map((r, j) => {
        if (j !== ri) return r
        const values = r.values.slice()
        values[ci] = value
        return { values }
      })
      return { ...t, rows }
    }))
  }

  const addRow = (ti: number) => {
    setTables(prev => prev.map((t, i) => {
      if (i !== ti) return t
      return { ...t, rows: [...t.rows, newEmptyRow(t.columns.length)] }
    }))
  }

  const deleteRow = (ti: number, ri: number) => {
    setTables(prev => prev.map((t, i) => {
      if (i !== ti) return t
      return { ...t, rows: t.rows.filter((_, j) => j !== ri) }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const markdown = encode(tables)
      const user = getCrewName() || 'crew'
      await saveGuide({
        id: FIRE_EQUIPMENT_GUIDE_ID,
        title: 'Life Saving Equipment List',
        category: 'Safety',
        markdown,
        user,
        note: 'Fire equipment list edit',
      })
      setEditing(false)
      setSavedAt(new Date().toISOString())
      setUpdatedBy(user)
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleResetSeed = () => {
    if (confirm('Reset all tables to the original binder values? Your unsaved edits will be lost.')) {
      setTables(JSON.parse(JSON.stringify(FIRE_EQUIPMENT_SEED)))
    }
  }

  return (
    <MenuLayout
      title="Life Saving Equipment"
      showBack
      backHref="/ism/fire-safety"
      rightAction={editing ? undefined : {
        label: 'Edit',
        ariaLabel: 'Edit equipment list',
        onClick: () => setEditing(true),
      }}
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Life Saving Equipment List</h2>
          <p className="text-sm text-muted-foreground mt-1">
            M/Y Rise Above · {editing ? 'Editing — tap any cell to change it' : 'Read-only — tap Edit to make changes'}
          </p>
          {savedAt && !editing && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated {new Date(savedAt).toLocaleString()}{updatedBy ? ` by ${updatedBy}` : ''}
            </p>
          )}
        </div>

        {loading && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!editing && (
          <button
            onClick={() => setLocation('/ism/safety-equipment-test')}
            className="w-full px-4 py-3 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-orange-300 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3 8-8"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            Equipment testing schedule
          </button>
        )}

        {tables.map((t, ti) => (
          <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
              <h3 className="font-semibold text-base">{t.title}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/20">
                  <tr>
                    {t.columns.map((c, ci) => (
                      <th key={ci} className="text-left px-3 py-2 font-medium text-muted-foreground border-b border-border">
                        {c}
                      </th>
                    ))}
                    {editing && <th className="w-10 border-b border-border"></th>}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, ri) => (
                    <tr key={ri} className="border-b border-border last:border-b-0">
                      {r.values.map((v, ci) => (
                        <td key={ci} className="px-3 py-2 align-top">
                          {editing ? (
                            <input
                              type="text"
                              value={v}
                              onChange={(e) => updateCell(ti, ri, ci, e.target.value)}
                              className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                            />
                          ) : (
                            <span className="text-foreground">{v || <span className="text-muted-foreground/50">—</span>}</span>
                          )}
                        </td>
                      ))}
                      {editing && (
                        <td className="px-2 py-2 align-top">
                          <button
                            onClick={() => deleteRow(ti, ri)}
                            aria-label="Delete row"
                            className="w-8 h-8 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center"
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1.5 14a2 2 0 01-2 2H8.5a2 2 0 01-2-2L5 6"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editing && (
              <div className="px-3 py-2 border-t border-border">
                <button
                  onClick={() => addRow(ti)}
                  className="text-sm text-orange-400 hover:text-orange-300 font-medium"
                >
                  + Add row
                </button>
              </div>
            )}
          </div>
        ))}

        {editing && (
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null) }}
              className="px-4 py-2.5 rounded-lg border border-border hover:bg-secondary font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleResetSeed}
              className="px-3 py-2.5 rounded-lg border border-border hover:bg-secondary text-xs text-muted-foreground"
              title="Reset all tables to the original binder values"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </MenuLayout>
  )
}
