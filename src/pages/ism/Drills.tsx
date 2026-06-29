import React, { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { fetchGuide, saveGuide } from '@/lib/guides'
import { getCrewName } from '@/lib/auth'
import { DRILLS_GUIDE_ID, DRILLS_SEED, type DrillsData, type TestRow } from '@/data/drills-seed'
import { slugifyDrill } from '@/data/drills-scripts'

const DATA_PREFIX = '<!-- DRILLS-TESTING-DATA:'
const DATA_SUFFIX = '-->'

function decode(markdown: string): DrillsData {
  if (!markdown) return DRILLS_SEED
  const start = markdown.indexOf(DATA_PREFIX)
  if (start < 0) return DRILLS_SEED
  const end = markdown.indexOf(DATA_SUFFIX, start + DATA_PREFIX.length)
  if (end < 0) return DRILLS_SEED
  const json = markdown.slice(start + DATA_PREFIX.length, end).trim()
  try {
    const data = JSON.parse(json) as Partial<DrillsData>
    if (data && typeof data.intro === 'string' && Array.isArray(data.events) && Array.isArray(data.tests)) {
      // Merge in any new seed events that were added after the user last saved.
      const savedEvents = data.events.filter(e => typeof e === 'string') as string[]
      const lower = new Set(savedEvents.map(e => e.toLowerCase().trim()))
      const mergedEvents = [...savedEvents]
      for (const seedEvent of DRILLS_SEED.events) {
        if (!lower.has(seedEvent.toLowerCase().trim())) mergedEvents.push(seedEvent)
      }
      return {
        intro: data.intro,
        events: mergedEvents,
        tests: (data.tests as TestRow[]).filter(t => t && typeof t.description === 'string'),
        outro: typeof data.outro === 'string' ? data.outro : '',
      }
    }
  } catch {}
  return DRILLS_SEED
}

function encode(data: DrillsData): string {
  const json = JSON.stringify(data)
  const human = [
    '# Drills / Testing Carried Out',
    '',
    data.intro,
    '',
    ...data.events.map(e => `- ${e}`),
    '',
    '| Description | Test Time Scale |',
    '| --- | --- |',
    ...data.tests.map(t => `| ${t.description} | ${t.scale} |`),
    '',
    data.outro,
  ].join('\n')
  return `${DATA_PREFIX}${json}${DATA_SUFFIX}\n\n${human}`
}

export function DrillsPage() {
  const [, setLocation] = useLocation()
  const [data, setData] = useState<DrillsData>(DRILLS_SEED)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchGuide(DRILLS_GUIDE_ID)
      .then(g => {
        if (cancelled) return
        setData(decode(g?.Markdown || ''))
        setSavedAt(g?.['Updated At'] || null)
        setUpdatedBy(g?.['Updated By'] || null)
      })
      .catch(() => { /* no record yet — keep seed */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const markdown = encode(data)
      const user = getCrewName() || 'crew'
      await saveGuide({
        id: DRILLS_GUIDE_ID,
        title: 'Drills / Testing Carried Out',
        category: 'Safety',
        markdown,
        user,
        note: 'Drills/testing edit',
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

  const updateTest = (i: number, key: keyof TestRow, value: string) => {
    setData(d => ({
      ...d,
      tests: d.tests.map((t, idx) => idx === i ? { ...t, [key]: value } : t),
    }))
  }

  const addTest = () => {
    setData(d => ({ ...d, tests: [...d.tests, { description: '', scale: '' }] }))
  }

  const deleteTest = (i: number) => {
    setData(d => ({ ...d, tests: d.tests.filter((_, idx) => idx !== i) }))
  }

  const updateEvent = (i: number, value: string) => {
    setData(d => ({ ...d, events: d.events.map((e, idx) => idx === i ? value : e) }))
  }

  const addEvent = () => {
    setData(d => ({ ...d, events: [...d.events, ''] }))
  }

  const deleteEvent = (i: number) => {
    setData(d => ({ ...d, events: d.events.filter((_, idx) => idx !== i) }))
  }

  return (
    <MenuLayout
      title="Drills / Testing"
      showBack
      backHref="/ism"
      rightAction={editing ? undefined : {
        label: 'Edit',
        ariaLabel: 'Edit drills and testing',
        onClick: () => setEditing(true),
      }}
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold">Drills / Testing Carried Out</h2>
          <p className="text-sm text-muted-foreground mt-1">
            M/Y Rise Above · {editing ? 'Editing' : 'Read-only'}
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

        {/* Intro */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-semibold text-base">Mandatory drills & training</h3>
          </div>
          <div className="p-4">
            {editing ? (
              <textarea
                value={data.intro}
                onChange={(e) => setData(d => ({ ...d, intro: e.target.value }))}
                rows={6}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap">{data.intro}</div>
            )}
          </div>
        </section>

        {/* Perform Drill CTA */}
        {!editing && (
          <button
            onClick={() => setLocation('/ism/drills/perform')}
            className="w-full px-4 py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Perform drill
          </button>
        )}

        {/* Events list */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-semibold text-base">Emergency events to simulate</h3>
          </div>
          <div className="p-4 space-y-2">
            {data.events.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">•</span>
                {editing ? (
                  <>
                    <input
                      type="text"
                      value={e}
                      onChange={(ev) => updateEvent(i, ev.target.value)}
                      className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={() => deleteEvent(i)}
                      aria-label="Delete event"
                      className="w-8 h-8 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm flex-1">{e}</span>
                    <button
                      onClick={() => setLocation(`/ism/drills/perform?drill=${encodeURIComponent(slugifyDrill(e))}`)}
                      className="text-xs text-amber-300 hover:text-amber-200 font-medium px-2 py-1 rounded border border-amber-500/30 hover:border-amber-500/60"
                    >
                      Perform →
                    </button>
                  </>
                )}
              </div>
            ))}
            {editing && (
              <button
                onClick={addEvent}
                className="text-sm text-amber-400 hover:text-amber-300 font-medium pt-1"
              >
                + Add event
              </button>
            )}
          </div>
        </section>

        {/* Tests table */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-semibold text-base">Equipment testing schedule</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/20">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground border-b border-border">Description</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground border-b border-border">Test Time Scale</th>
                  {editing && <th className="w-10 border-b border-border"></th>}
                </tr>
              </thead>
              <tbody>
                {data.tests.map((t, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 align-top">
                      {editing ? (
                        <input
                          type="text"
                          value={t.description}
                          onChange={(e) => updateTest(i, 'description', e.target.value)}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
                        />
                      ) : (
                        <span>{t.description}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {editing ? (
                        <input
                          type="text"
                          value={t.scale}
                          onChange={(e) => updateTest(i, 'scale', e.target.value)}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
                        />
                      ) : (
                        <span>{t.scale}</span>
                      )}
                    </td>
                    {editing && (
                      <td className="px-2 py-2 align-top">
                        <button
                          onClick={() => deleteTest(i)}
                          aria-label="Delete row"
                          className="w-8 h-8 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1.5 14a2 2 0 01-2 2H8.5a2 2 0 01-2-2L5 6"/>
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
                onClick={addTest}
                className="text-sm text-amber-400 hover:text-amber-300 font-medium"
              >
                + Add row
              </button>
            </div>
          )}
        </section>

        {/* Outro */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-semibold text-base">Annual testing</h3>
          </div>
          <div className="p-4">
            {editing ? (
              <textarea
                value={data.outro}
                onChange={(e) => setData(d => ({ ...d, outro: e.target.value }))}
                rows={4}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap">{data.outro}</div>
            )}
          </div>
        </section>

        {editing && (
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null) }}
              className="px-4 py-2.5 rounded-lg border border-border hover:bg-secondary font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </MenuLayout>
  )
}
