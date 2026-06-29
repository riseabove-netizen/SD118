import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { fetchGuide, saveGuide, uploadDrivePdf } from '@/lib/guides'
import { getCrewName } from '@/lib/auth'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
  FIRE_EQUIPMENT_SEED,
  FIRE_EQUIPMENT_GUIDE_ID,
  type FireEqTable,
} from '@/data/fire-equipment-seed'

// ---------------------------------------------------------------------------
// Data <-> guide markdown helpers (kept in sync with FireEquipment.tsx)
// ---------------------------------------------------------------------------

const DATA_PREFIX = '<!-- FIRE-EQUIPMENT-DATA:'
const DATA_SUFFIX = '-->'

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
  if (!markdown) return JSON.parse(JSON.stringify(FIRE_EQUIPMENT_SEED))
  const start = markdown.indexOf(DATA_PREFIX)
  if (start < 0) return JSON.parse(JSON.stringify(FIRE_EQUIPMENT_SEED))
  const end = markdown.indexOf(DATA_SUFFIX, start + DATA_PREFIX.length)
  if (end < 0) return JSON.parse(JSON.stringify(FIRE_EQUIPMENT_SEED))
  const json = markdown.slice(start + DATA_PREFIX.length, end).trim()
  try {
    const data = JSON.parse(json)
    if (Array.isArray(data) && data.every(t => t && typeof t === 'object' && Array.isArray(t.columns) && Array.isArray(t.rows))) {
      return migrate(data as FireEqTable[])
    }
  } catch {}
  return JSON.parse(JSON.stringify(FIRE_EQUIPMENT_SEED))
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

// Column helpers
function pressureIdx(t: FireEqTable): number {
  return t.columns.findIndex(c => c.toLowerCase() === 'pressure')
}
function checkedByIdx(t: FireEqTable): number {
  return t.columns.findIndex(c => c.toLowerCase().startsWith('last checked'))
}
function expiryIdx(t: FireEqTable): number {
  // First column that looks like an expiry / inspection / service date column.
  const lower = t.columns.map(c => c.toLowerCase())
  // Prefer explicit "expir" first
  const exp = lower.findIndex(c => c.includes('expir'))
  if (exp >= 0) return exp
  // Then HRU expiry was handled by the above; try inspection / service / certificate expiry
  const ins = lower.findIndex(c => c.includes('inspection') || c.includes('service') || c.includes('certificate expiry'))
  return ins
}

function rowLabel(t: FireEqTable, r: FireEqTable['rows'][number]): string {
  // Use the first column as a short label, append second column if present
  const first  = (r.values[0]  || '').toString().trim()
  const second = (r.values[1]  || '').toString().trim()
  if (first && second) return `${first} — ${second}`
  return first || second || '(unnamed item)'
}

const DECK_ORDER: Array<FireEqTable['deck']> = ['lower', 'main', 'upper', 'sun', 'all']
const DECK_LABEL: Record<FireEqTable['deck'], string> = {
  lower: 'Lower deck',
  main:  'Main deck',
  upper: 'Upper deck / Bridge',
  sun:   'Sun deck',
  all:   'Distributed / all decks',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TestRowState {
  tableIdx: number
  rowIdx:   number
  selected: boolean
  pressure: 'green' | 'red' | ''
  expiry:   string   // optional; overwrites main list only if non-empty
}

type CategoryKey = 'lsa' | 'fire'

export function SafetyEquipmentTestPage() {
  const [, setLocation] = useLocation()
  const [loading, setLoading] = useState(true)
  const [tables, setTables] = useState<FireEqTable[]>([])
  const [state, setState] = useState<Record<string, TestRowState>>({})
  const [openCat, setOpenCat] = useState<Record<CategoryKey, boolean>>({ lsa: true, fire: true })
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({})
  const [signer, setSigner] = useState<string>(getCrewName() || '')
  const [signature, setSignature] = useState<string>('')   // typed signature
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneUrl, setDoneUrl] = useState<string | null>(null)

  // ------ load -----------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchGuide(FIRE_EQUIPMENT_GUIDE_ID)
      .then(g => {
        if (cancelled) return
        const ts = decode(g?.Markdown || '')
        setTables(ts)
        // Default all sections collapsed except the first under each category
        const open: Record<string, boolean> = {}
        const seenCat: Record<string, boolean> = {}
        ts.forEach(t => {
          if (!seenCat[t.category]) {
            open[t.id] = true
            seenCat[t.category] = true
          } else {
            open[t.id] = false
          }
        })
        setOpenSection(open)
      })
      .catch(() => {
        const seed = JSON.parse(JSON.stringify(FIRE_EQUIPMENT_SEED))
        setTables(seed)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ------ derived: grouped by category > deck > section -----------------
  type Grouped = Record<CategoryKey, Record<string, FireEqTable[]>>
  const grouped = useMemo<Grouped>(() => {
    const out: Grouped = { lsa: {}, fire: {} }
    tables.forEach(t => {
      const cat = (t.category || 'fire') as CategoryKey
      const deck = t.deck || 'all'
      if (!out[cat][deck]) out[cat][deck] = []
      out[cat][deck].push(t)
    })
    return out
  }, [tables])

  // ------ row state ------------------------------------------------------
  const keyFor = (ti: number, ri: number) => `${ti}:${ri}`
  const rowState = (ti: number, ri: number): TestRowState =>
    state[keyFor(ti, ri)] || { tableIdx: ti, rowIdx: ri, selected: false, pressure: '', expiry: '' }

  const setRow = (ti: number, ri: number, patch: Partial<TestRowState>) => {
    setState(prev => {
      const k = keyFor(ti, ri)
      const cur = prev[k] || { tableIdx: ti, rowIdx: ri, selected: false, pressure: '', expiry: '' }
      return { ...prev, [k]: { ...cur, ...patch } }
    })
  }

  const selectedCount = useMemo(() =>
    Object.values(state).filter(s => s.selected).length, [state])

  // ------ submit ---------------------------------------------------------
  const handleSubmit = async () => {
    setError(null)
    if (selectedCount === 0) {
      setError('Select at least one piece of equipment that was tested.')
      return
    }
    if (!signer.trim()) {
      setError('Enter your name in the signature section.')
      return
    }
    if (!signature.trim()) {
      setError('Type your name as a signature to confirm the test.')
      return
    }

    setSaving(true)
    try {
      const stamp = new Date()
      const isoDay = stamp.toISOString().slice(0, 10) // YYYY-MM-DD

      // 1) Apply updates to the in-memory tables ------------------------
      const next = tables.map(t => ({ ...t, rows: t.rows.map(r => ({ values: r.values.slice() })) }))
      const records: Array<{ table: string; item: string; pressure: string; expiry: string }> = []
      Object.values(state).forEach(s => {
        if (!s.selected) return
        const t = next[s.tableIdx]
        if (!t) return
        const r = t.rows[s.rowIdx]
        if (!r) return
        const pIdx = pressureIdx(t)
        const cIdx = checkedByIdx(t)
        const eIdx = expiryIdx(t)
        if (pIdx >= 0) r.values[pIdx] = s.pressure === 'green' ? '✓ Green' : s.pressure === 'red' ? '✗ Red' : (r.values[pIdx] || '')
        if (cIdx >= 0) r.values[cIdx] = `${signer.trim()} · ${isoDay}`
        if (eIdx >= 0 && s.expiry.trim()) r.values[eIdx] = s.expiry.trim()
        records.push({
          table: t.title,
          item: rowLabel(t, r),
          pressure: s.pressure || '—',
          expiry: s.expiry || '—',
        })
      })

      // 2) Save back to the main equipment guide ------------------------
      await saveGuide({
        id: FIRE_EQUIPMENT_GUIDE_ID,
        title: 'Life Saving Equipment List',
        category: 'Safety',
        markdown: encode(next),
        user: signer.trim(),
        note: `Safety equipment test (${records.length} item${records.length === 1 ? '' : 's'})`,
      })

      // 3) Build PDF ----------------------------------------------------
      const pdfBytes = await buildTestPdf({
        stamp,
        signer: signer.trim(),
        signature: signature.trim(),
        notes: notes.trim(),
        records,
      })
      const pdfB64 = bytesToBase64(pdfBytes)
      const filename = `safety-equipment-test_${isoDay}_${signer.trim().replace(/\s+/g, '-')}.pdf`
      const up = await uploadDrivePdf(pdfB64, filename, 'SafetyEquipmentTest')

      // 4) Archive test record as its own Guide row ---------------------
      const recordId = `SAFETY-TEST-${stamp.getTime()}`
      const md = [
        `# Safety Equipment Test`,
        ``,
        `**Date:** ${stamp.toLocaleString()}  `,
        `**Tested by:** ${signer.trim()}  `,
        `**Items tested:** ${records.length}  `,
        `**PDF:** [Open PDF](${up.viewUrl})`,
        ``,
        `## Items`,
        ``,
        `| Section | Item | Pressure | Expiry |`,
        `| --- | --- | --- | --- |`,
        ...records.map(r => `| ${r.table} | ${r.item} | ${r.pressure} | ${r.expiry} |`),
        ``,
        notes.trim() ? `## Notes\n\n${notes.trim()}\n` : '',
      ].filter(Boolean).join('\n')
      await saveGuide({
        id: recordId,
        title: `Safety Equipment Test — ${isoDay}`,
        category: 'Safety',
        markdown: md,
        user: signer.trim(),
        note: `Tested ${records.length} item${records.length === 1 ? '' : 's'}`,
      })

      setDoneUrl(up.viewUrl)
      setTables(next)
    } catch (e: any) {
      setError(e?.message || 'Failed to submit test')
    } finally {
      setSaving(false)
    }
  }

  // ------ render ---------------------------------------------------------
  if (doneUrl) {
    return (
      <MenuLayout title="Test submitted" showBack backHref="/ism/fire-safety/equipment">
        <div className="space-y-4">
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4">
            <div className="text-green-300 font-semibold">Safety equipment test recorded</div>
            <p className="text-sm text-muted-foreground mt-2">
              The Life Saving Equipment list has been updated. A PDF copy was uploaded to Drive.
            </p>
            <a
              href={doneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium"
            >
              Open PDF
            </a>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setLocation('/ism/fire-safety/equipment')}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary font-medium text-sm"
            >
              Back to equipment list
            </button>
            <button
              onClick={() => { setDoneUrl(null); setState({}); setSignature(''); setNotes('') }}
              className="px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm"
            >
              Run another test
            </button>
          </div>
        </div>
      </MenuLayout>
    )
  }

  return (
    <MenuLayout title="Safety equipment test" showBack backHref="/ism/fire-safety/equipment">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Safety equipment test</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select which items you are testing today. Mark pressure status, optionally update an expiry date, then sign at
            the bottom to record the test and update the main equipment list.
          </p>
        </div>

        {loading && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && (['lsa','fire'] as CategoryKey[]).map(cat => {
          const decks = grouped[cat] || {}
          const deckKeys = DECK_ORDER.filter(d => decks[d] && decks[d].length > 0)
          if (deckKeys.length === 0) return null
          const isOpen = openCat[cat] !== false
          const catLabel = cat === 'lsa' ? 'Life Saving Equipment (LSA)' : 'Fire Equipment'
          const accent = cat === 'lsa' ? 'orange' : 'red'
          return (
            <div key={cat} className={`rounded-xl border border-${accent}-500/30 bg-card overflow-hidden`}>
              <button
                onClick={() => setOpenCat(p => ({ ...p, [cat]: !isOpen }))}
                className={`w-full px-4 py-3 flex items-center justify-between bg-${accent}-500/15 hover:bg-${accent}-500/25 text-left`}
              >
                <div>
                  <div className={`font-semibold text-${accent}-300`}>{catLabel}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {deckKeys.reduce((n, d) => n + decks[d].reduce((m, t) => m + t.rows.length, 0), 0)} items across {deckKeys.length} deck{deckKeys.length === 1 ? '' : 's'}
                  </div>
                </div>
                <Chevron open={isOpen} />
              </button>

              {isOpen && (
                <div className="divide-y divide-border">
                  {deckKeys.map(deck => (
                    <div key={deck} className="px-2 py-2">
                      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {DECK_LABEL[deck]}
                      </div>
                      {decks[deck].map(t => {
                        const ti = tables.indexOf(t)
                        const open = openSection[t.id] !== false
                        const selInSection = t.rows.reduce((n, _r, ri) =>
                          n + (rowState(ti, ri).selected ? 1 : 0), 0)
                        return (
                          <div key={t.id} className="my-1 rounded-lg border border-border bg-background/40 overflow-hidden">
                            <button
                              onClick={() => setOpenSection(p => ({ ...p, [t.id]: !open }))}
                              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-secondary/30"
                            >
                              <div>
                                <div className="text-sm font-medium">{t.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {t.rows.length} item{t.rows.length === 1 ? '' : 's'}
                                  {selInSection > 0 && <span className={`ml-2 text-${accent}-300`}>· {selInSection} selected</span>}
                                </div>
                              </div>
                              <Chevron open={open} />
                            </button>

                            {open && (
                              <div className="px-3 pb-3 pt-1 space-y-2">
                                <SectionBulkControls
                                  onSelectAll={() => t.rows.forEach((_r, ri) => setRow(ti, ri, { selected: true }))}
                                  onClear={() => t.rows.forEach((_r, ri) => setRow(ti, ri, { selected: false, pressure: '', expiry: '' }))}
                                  accent={accent}
                                />
                                {t.rows.map((r, ri) => {
                                  const s = rowState(ti, ri)
                                  const hasExpiryCol = expiryIdx(t) >= 0
                                  return (
                                    <div key={ri} className={`rounded-md border ${s.selected ? `border-${accent}-500/50 bg-${accent}-500/5` : 'border-border bg-background/30'} p-2`}>
                                      <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={s.selected}
                                          onChange={(e) => setRow(ti, ri, { selected: e.target.checked })}
                                          className="mt-1 w-4 h-4 accent-orange-500"
                                        />
                                        <div className="flex-1">
                                          <div className="text-sm font-medium">{rowLabel(t, r)}</div>
                                          {r.values[2] && (
                                            <div className="text-xs text-muted-foreground">
                                              {t.columns[2]}: {r.values[2]}
                                            </div>
                                          )}
                                        </div>
                                      </label>

                                      {s.selected && (
                                        <div className="mt-2 pl-6 space-y-2">
                                          <div>
                                            <div className="text-xs text-muted-foreground mb-1">Pressure</div>
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                onClick={() => setRow(ti, ri, { pressure: 'green' })}
                                                className={`flex-1 px-3 py-1.5 rounded-md border text-xs font-medium ${s.pressure === 'green' ? 'border-green-500 bg-green-500/20 text-green-300' : 'border-border hover:border-green-500/50'}`}
                                              >
                                                ✓ Green (good)
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setRow(ti, ri, { pressure: 'red' })}
                                                className={`flex-1 px-3 py-1.5 rounded-md border text-xs font-medium ${s.pressure === 'red' ? 'border-red-500 bg-red-500/20 text-red-300' : 'border-border hover:border-red-500/50'}`}
                                              >
                                                ✗ Red (needs service)
                                              </button>
                                            </div>
                                          </div>

                                          {hasExpiryCol && (
                                            <div>
                                              <div className="text-xs text-muted-foreground mb-1">
                                                New expiry (optional) — overwrites the main list
                                              </div>
                                              <input
                                                type="text"
                                                value={s.expiry}
                                                onChange={(e) => setRow(ti, ri, { expiry: e.target.value })}
                                                placeholder={r.values[expiryIdx(t)] || 'MM/YY or YYYY-MM-DD'}
                                                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Signature + notes */}
        {!loading && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-base">Signature</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedCount} item{selectedCount === 1 ? '' : 's'} selected. Your name will be recorded against each tested
                item in the &quot;Last Checked By&quot; column.
              </p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tested by</label>
              <input
                type="text"
                value={signer}
                onChange={(e) => setSigner(e.target.value)}
                placeholder="Your name"
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Signature (type your name)</label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Sign here"
                className="w-full bg-background border border-border rounded px-3 py-2 text-base focus:border-orange-500 focus:outline-none italic font-serif"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any defects, follow-ups or comments…"
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && (
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving || selectedCount === 0}
              className="flex-1 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium"
            >
              {saving ? 'Submitting…' : `Submit test (${selectedCount})`}
            </button>
            <button
              onClick={() => setLocation('/ism/fire-safety/equipment')}
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

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

function SectionBulkControls({ onSelectAll, onClear, accent }: { onSelectAll: () => void; onClear: () => void; accent: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <button
        onClick={onSelectAll}
        className={`px-2 py-1 rounded border border-${accent}-500/40 text-${accent}-300 hover:bg-${accent}-500/10`}
      >
        Select all
      </button>
      <button
        onClick={onClear}
        className="px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary"
      >
        Clear
      </button>
    </div>
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  // btoa is fine — only ASCII in binary PDF stream
  // (browser env)
  return btoa(bin)
}

// ---------------------------------------------------------------------------
// PDF builder
// ---------------------------------------------------------------------------

interface PdfArgs {
  stamp: Date
  signer: string
  signature: string
  notes: string
  records: Array<{ table: string; item: string; pressure: string; expiry: string }>
}

async function buildTestPdf(args: PdfArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const helv     = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink     = rgb(0.08, 0.08, 0.10)
  const muted   = rgb(0.42, 0.45, 0.50)
  const accent  = rgb(0.93, 0.40, 0.10)
  const green   = rgb(0.15, 0.55, 0.20)
  const red     = rgb(0.78, 0.18, 0.18)

  const PAGE_W = 595
  const PAGE_H = 842
  const margin = 40
  const lineH = 14

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - margin

  // Header
  page.drawText('Safety Equipment Test', { x: margin, y: y - 14, size: 16, font: helvBold, color: ink })
  const sub = 'M/Y Rise Above'
  page.drawText(sub, { x: PAGE_W - margin - helv.widthOfTextAtSize(sub, 10), y: y - 12, size: 10, font: helv, color: muted })
  y -= 28
  page.drawText(args.stamp.toLocaleString(), { x: margin, y, size: 10, font: helv, color: muted })
  y -= 18

  const drawMeta = (k: string, v: string) => {
    page.drawText(k, { x: margin, y, size: 9, font: helvBold, color: muted })
    page.drawText(v, { x: margin + 80, y, size: 10, font: helv, color: ink })
    y -= lineH
  }
  drawMeta('Tested by', args.signer)
  drawMeta('Signature', args.signature)
  drawMeta('Items', String(args.records.length))
  y -= 6

  // Table header
  const colX = [margin, margin + 200, margin + 380, margin + 460]
  const drawRule = () => {
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: PAGE_W - margin, y: y + 4 }, color: rgb(0.85, 0.85, 0.88), thickness: 0.5 })
  }
  const drawHead = () => {
    page.drawText('Section / Item',       { x: colX[0], y, size: 9, font: helvBold, color: muted })
    page.drawText('Detail',                { x: colX[1], y, size: 9, font: helvBold, color: muted })
    page.drawText('Pressure',              { x: colX[2], y, size: 9, font: helvBold, color: muted })
    page.drawText('New expiry',            { x: colX[3], y, size: 9, font: helvBold, color: muted })
    y -= 4
    drawRule()
    y -= lineH
  }
  drawHead()

  const trim = (s: string, max: number, font = helv, size = 9) => {
    if (font.widthOfTextAtSize(s, size) <= max) return s
    let out = s
    while (out.length > 1 && font.widthOfTextAtSize(out + '…', size) > max) out = out.slice(0, -1)
    return out + '…'
  }

  for (const r of args.records) {
    if (y < margin + 60) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - margin
      drawHead()
    }
    page.drawText(trim(r.table, 195, helvBold), { x: colX[0], y, size: 9, font: helvBold, color: ink })
    page.drawText(trim(r.item,  175),            { x: colX[1], y, size: 9, font: helv, color: ink })
    const pColor = r.pressure.toLowerCase().includes('green') ? green : r.pressure.toLowerCase().includes('red') ? red : ink
    page.drawText(trim(r.pressure || '—', 75), { x: colX[2], y, size: 9, font: helvBold, color: pColor })
    page.drawText(trim(r.expiry   || '—', 100),{ x: colX[3], y, size: 9, font: helv, color: ink })
    y -= lineH
  }

  // Notes
  if (args.notes) {
    if (y < margin + 80) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - margin
    }
    y -= 10
    page.drawText('Notes', { x: margin, y, size: 11, font: helvBold, color: ink })
    y -= 14
    const wrap = wrapText(args.notes, helv, 10, PAGE_W - 2 * margin)
    for (const ln of wrap) {
      if (y < margin + 30) {
        page = pdf.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - margin
      }
      page.drawText(ln, { x: margin, y, size: 10, font: helv, color: ink })
      y -= 13
    }
  }

  // Footer signature
  if (y < margin + 80) {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - margin
  }
  y -= 20
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 240, y }, color: accent, thickness: 0.6 })
  page.drawText(args.signature, { x: margin, y: y + 4, size: 14, font: helvBold, color: accent })
  page.drawText(`Signed by ${args.signer} · ${args.stamp.toLocaleString()}`, { x: margin, y: y - 12, size: 9, font: helv, color: muted })

  const out = await pdf.save()
  return out
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/)
    let line = ''
    for (const w of words) {
      const trial = line ? line + ' ' + w : w
      if (font.widthOfTextAtSize(trial, size) > maxWidth) {
        if (line) lines.push(line)
        line = w
      } else {
        line = trial
      }
    }
    if (line) lines.push(line)
    if (para === '') lines.push('')
  }
  return lines
}
