import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { getCrewName } from '@/lib/auth'
import { saveGuide, uploadDrivePdf } from '@/lib/guides'
import { DRILL_SCRIPTS, slugifyDrill, findDrillScript, type DrillScript } from '@/data/drills-scripts'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Build a Perform Drill workflow with four sections:
//   1. Select drill + personnel involved
//   2. Pre-briefing
//   3. Drill operation
//   4. Debriefing
// Each emergency event has its own script (see drills-scripts.ts).

type Step = 'select' | 'pre' | 'op' | 'debrief' | 'done'

interface PersonnelEntry {
  name: string
  role: string
}

interface CheckRow {
  id: string
  done: boolean
  comment: string
}

function makeChecks(items: string[]): CheckRow[] {
  return items.map((label, i) => ({ id: `${i}-${label.slice(0, 16)}`, done: false, comment: '' }))
}

function findDrillFromUrl(): DrillScript | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return findDrillScript(params.get('drill'))
}

export function PerformDrillPage() {
  const [, setLocation] = useLocation()
  const [step, setStep] = useState<Step>('select')
  const [script, setScript] = useState<DrillScript | null>(findDrillFromUrl())
  const [personnel, setPersonnel] = useState<PersonnelEntry[]>([{ name: getCrewName() || '', role: 'Captain / Drill leader' }])
  const [scenarioNotes, setScenarioNotes] = useState<string>('')
  const [startedAt] = useState<string>(new Date().toISOString())

  const [preChecks, setPreChecks] = useState<CheckRow[]>([])
  const [opChecks, setOpChecks] = useState<CheckRow[]>([])
  const [debriefChecks, setDebriefChecks] = useState<CheckRow[]>([])

  const [opStartedAt, setOpStartedAt] = useState<string | null>(null)
  const [opEndedAt, setOpEndedAt] = useState<string | null>(null)
  const [opOverallNotes, setOpOverallNotes] = useState<string>('')
  const [debriefSummary, setDebriefSummary] = useState<string>('')
  const [improvements, setImprovements] = useState<string>('')

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // When the drill is selected (from URL or click), prime the check lists.
  useEffect(() => {
    if (script) {
      setPreChecks(makeChecks(script.preBriefing))
      setOpChecks(makeChecks(script.operation))
      setDebriefChecks(makeChecks(script.debriefing))
      if (step === 'select') setStep('pre')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script])

  const goto = (next: Step) => {
    setStep(next)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePickDrill = (s: DrillScript) => {
    setScript(s)
    // useEffect above will set step → 'pre'
  }

  const handleStartOperation = () => {
    setOpStartedAt(new Date().toISOString())
    goto('op')
  }

  const handleFinishOperation = () => {
    setOpEndedAt(new Date().toISOString())
    goto('debrief')
  }

  const handleSave = async () => {
    if (!script) return
    setBusy('Generating PDF…')
    setError(null)
    try {
      const data = {
        slug: script.slug,
        title: script.title,
        startedAt,
        opStartedAt,
        opEndedAt,
        endedAt: new Date().toISOString(),
        personnel: personnel.filter(p => p.name.trim() !== ''),
        scenarioNotes,
        preChecks,
        opChecks,
        debriefChecks,
        opOverallNotes,
        debriefSummary,
        improvements,
        leader: getCrewName() || personnel[0]?.name || 'crew',
      }
      const pdfBytes = await buildDrillPdf(script, data)
      const filename = `Drill-${script.slug}-${data.endedAt.slice(0, 10)}.pdf`
      const b64 = uint8ToBase64(pdfBytes)
      const up = await uploadDrivePdf(b64, filename, 'DrillReport')
      // archive a Guide record
      await saveGuide({
        title: `Drill — ${script.title} — ${data.endedAt.slice(0, 10)}`,
        category: 'Drill Report',
        markdown: buildArchiveMarkdown(script, data, up.viewUrl),
        user: data.leader,
        note: 'Drill performed',
      })
      setPdfUrl(up.viewUrl)
      goto('done')
    } catch (e: any) {
      setError(e?.message || 'Failed to save report')
    } finally {
      setBusy(null)
    }
  }

  const StepNav = (
    <ol className="flex items-center gap-2 text-xs">
      {(['Select', 'Pre-brief', 'Operation', 'Debrief'] as const).map((label, i) => {
        const stepKey = (['select', 'pre', 'op', 'debrief'] as Step[])[i]
        const stepOrder: Step[] = ['select', 'pre', 'op', 'debrief', 'done']
        const currentIdx = stepOrder.indexOf(step)
        const myIdx = stepOrder.indexOf(stepKey)
        const state = myIdx < currentIdx ? 'done' : myIdx === currentIdx ? 'current' : 'todo'
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ' +
                (state === 'current'
                  ? 'bg-amber-500 text-black'
                  : state === 'done'
                  ? 'bg-amber-500/30 text-amber-300'
                  : 'bg-secondary text-muted-foreground')
              }
            >
              {i + 1}
            </span>
            <span className={state === 'current' ? 'text-foreground font-medium' : 'text-muted-foreground'}>{label}</span>
            {i < 3 && <span className="text-border">›</span>}
          </li>
        )
      })}
    </ol>
  )

  return (
    <MenuLayout title="Perform Drill" showBack backHref="/ism/drills">
      <div className="space-y-5 pb-32">
        <div>
          <h2 className="text-xl font-bold">Perform Drill</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {script ? script.title : 'Select a drill to begin'}
          </p>
        </div>

        <div className="overflow-x-auto -mx-4 px-4">{StepNav}</div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        {busy && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">{busy}</div>
        )}

        {step === 'select' && (
          <SelectStep onPick={handlePickDrill} />
        )}

        {step === 'pre' && script && (
          <PreStep
            script={script}
            personnel={personnel}
            setPersonnel={setPersonnel}
            scenarioNotes={scenarioNotes}
            setScenarioNotes={setScenarioNotes}
            checks={preChecks}
            setChecks={setPreChecks}
            onBack={() => setStep('select')}
            onNext={handleStartOperation}
          />
        )}

        {step === 'op' && script && (
          <OpStep
            script={script}
            checks={opChecks}
            setChecks={setOpChecks}
            overallNotes={opOverallNotes}
            setOverallNotes={setOpOverallNotes}
            startedAt={opStartedAt}
            onBack={() => setStep('pre')}
            onNext={handleFinishOperation}
          />
        )}

        {step === 'debrief' && script && (
          <DebriefStep
            script={script}
            checks={debriefChecks}
            setChecks={setDebriefChecks}
            summary={debriefSummary}
            setSummary={setDebriefSummary}
            improvements={improvements}
            setImprovements={setImprovements}
            onBack={() => setStep('op')}
            onSubmit={handleSave}
            disabled={!!busy}
          />
        )}

        {step === 'done' && script && (
          <DoneStep
            script={script}
            pdfUrl={pdfUrl}
            onAnother={() => setLocation('/ism/drills')}
          />
        )}
      </div>
    </MenuLayout>
  )
}

// ─── Step components ──────────────────────────────────────────────────────

function SelectStep({ onPick }: { onPick: (s: DrillScript) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Pick the drill you want to perform. Each one has a tailored briefing / operation / debrief checklist.</p>
      {DRILL_SCRIPTS.map(s => (
        <button
          key={s.slug}
          onClick={() => onPick(s)}
          className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-secondary/40 transition-colors"
        >
          <div className="font-semibold">{s.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{s.scenario}</div>
          {s.duration && <div className="text-xs text-amber-300 mt-1">≈ {s.duration}</div>}
        </button>
      ))}
    </div>
  )
}

function PreStep(props: {
  script: DrillScript
  personnel: PersonnelEntry[]
  setPersonnel: React.Dispatch<React.SetStateAction<PersonnelEntry[]>>
  scenarioNotes: string
  setScenarioNotes: (v: string) => void
  checks: CheckRow[]
  setChecks: React.Dispatch<React.SetStateAction<CheckRow[]>>
  onBack: () => void
  onNext: () => void
}) {
  const { script, personnel, setPersonnel, scenarioNotes, setScenarioNotes, checks, setChecks, onBack, onNext } = props
  return (
    <div className="space-y-4">
      <ScenarioCard script={script} />

      <Card title="Personnel involved">
        {personnel.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr,1fr,auto] gap-2 mb-2">
            <input
              type="text"
              value={p.name}
              onChange={e => setPersonnel(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
              placeholder="Name"
              className="bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
            />
            <input
              type="text"
              value={p.role}
              onChange={e => setPersonnel(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
              placeholder="Role (BA #1, helmsman, etc.)"
              className="bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={() => setPersonnel(prev => prev.filter((_, j) => j !== i))}
              className="w-8 h-8 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center"
              aria-label="Remove"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={() => setPersonnel(prev => [...prev, { name: '', role: '' }])}
          className="text-sm text-amber-400 hover:text-amber-300 font-medium"
        >
          + Add person
        </button>
      </Card>

      <Card title="Scenario notes (optional)">
        <textarea
          value={scenarioNotes}
          onChange={e => setScenarioNotes(e.target.value)}
          rows={3}
          placeholder="Specific location, simulated casualty, weather conditions…"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </Card>

      <Card title="Pre-briefing checklist" subtitle={`${checks.filter(c => c.done).length}/${checks.length} confirmed`}>
        <ChecklistEditor checks={checks} setChecks={setChecks} script={script.preBriefing} />
      </Card>

      <NavButtons onBack={onBack} onNext={onNext} nextLabel="Start drill →" />
    </div>
  )
}

function OpStep(props: {
  script: DrillScript
  checks: CheckRow[]
  setChecks: React.Dispatch<React.SetStateAction<CheckRow[]>>
  overallNotes: string
  setOverallNotes: (v: string) => void
  startedAt: string | null
  onBack: () => void
  onNext: () => void
}) {
  const { script, checks, setChecks, overallNotes, setOverallNotes, startedAt, onBack, onNext } = props

  // Live timer
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const elapsed = useMemo(() => {
    if (!startedAt) return '00:00'
    const s = Math.floor((now - new Date(startedAt).getTime()) / 1000)
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }, [now, startedAt])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-amber-200/80">Drill in progress</div>
          <div className="text-lg font-bold text-amber-300">{script.title}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-amber-200/80">Elapsed</div>
          <div className="text-3xl font-mono font-bold text-amber-300 tabular-nums">{elapsed}</div>
        </div>
      </div>

      <Card title="Drill operation" subtitle={`${checks.filter(c => c.done).length}/${checks.length} completed`}>
        <ChecklistEditor checks={checks} setChecks={setChecks} script={script.operation} numbered />
      </Card>

      <Card title="Overall observations">
        <textarea
          value={overallNotes}
          onChange={e => setOverallNotes(e.target.value)}
          rows={3}
          placeholder="What happened during the drill?"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </Card>

      <NavButtons onBack={onBack} onNext={onNext} nextLabel="End drill — debrief →" />
    </div>
  )
}

function DebriefStep(props: {
  script: DrillScript
  checks: CheckRow[]
  setChecks: React.Dispatch<React.SetStateAction<CheckRow[]>>
  summary: string
  setSummary: (v: string) => void
  improvements: string
  setImprovements: (v: string) => void
  onBack: () => void
  onSubmit: () => void
  disabled: boolean
}) {
  const { script, checks, setChecks, summary, setSummary, improvements, setImprovements, onBack, onSubmit, disabled } = props
  return (
    <div className="space-y-4">
      <Card title="Debriefing prompts" subtitle={`${checks.filter(c => c.done).length}/${checks.length} discussed`}>
        <ChecklistEditor checks={checks} setChecks={setChecks} script={script.debriefing} />
      </Card>

      <Card title="Debrief summary">
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          rows={4}
          placeholder="Overall outcome, performance, issues encountered…"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </Card>

      <Card title="Improvements & follow-up actions">
        <textarea
          value={improvements}
          onChange={e => setImprovements(e.target.value)}
          rows={3}
          placeholder="Actions to take before next drill, equipment to repair, training to schedule…"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </Card>

      <div className="flex items-center gap-2 sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border z-10">
        <button onClick={onBack} disabled={disabled} className="px-4 py-2.5 rounded-lg border border-border hover:bg-secondary font-medium disabled:opacity-50">← Back</button>
        <button
          onClick={onSubmit}
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold"
        >
          Submit & generate PDF
        </button>
      </div>
    </div>
  )
}

function DoneStep({ script, pdfUrl, onAnother }: { script: DrillScript; pdfUrl: string | null; onAnother: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="font-semibold text-emerald-300">Drill complete</div>
        <div className="text-sm text-muted-foreground mt-1">
          {script.title} — report saved to Google Drive and archived.
        </div>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold"
          >
            Open PDF in Drive
          </a>
        )}
      </div>
      <button
        onClick={onAnother}
        className="w-full px-4 py-3 rounded-lg border border-border hover:bg-secondary font-medium"
      >
        Back to Drills
      </button>
    </div>
  )
}

// ─── Re-usable bits ──────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
        <h3 className="font-semibold text-base">{title}</h3>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function ChecklistEditor(props: {
  checks: CheckRow[]
  setChecks: React.Dispatch<React.SetStateAction<CheckRow[]>>
  script: string[]
  numbered?: boolean
}) {
  const { checks, setChecks, script, numbered } = props
  return (
    <ul className="space-y-2">
      {checks.map((c, i) => (
        <li key={c.id} className="rounded-lg border border-border bg-background/40 p-2.5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={c.done}
              onChange={() => setChecks(prev => prev.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
              className="w-5 h-5 accent-amber-500 mt-0.5 flex-shrink-0"
            />
            <span className={'text-sm flex-1 ' + (c.done ? 'line-through text-muted-foreground' : '')}>
              {numbered && <span className="text-amber-300 font-bold mr-2">{i + 1}.</span>}
              {script[i]}
            </span>
          </label>
          <input
            type="text"
            value={c.comment}
            onChange={e => setChecks(prev => prev.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))}
            placeholder="Comment (optional)"
            className="w-full mt-2 bg-background border border-border rounded px-2 py-1 text-xs focus:border-amber-500 focus:outline-none"
          />
        </li>
      ))}
    </ul>
  )
}

function ScenarioCard({ script }: { script: DrillScript }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-amber-300 text-lg">{script.title}</h3>
        {script.duration && <span className="text-xs text-amber-300/80">≈ {script.duration}</span>}
      </div>
      <p className="text-sm">{script.scenario}</p>
      {script.equipment && script.equipment.length > 0 && (
        <div className="pt-2 border-t border-amber-500/20">
          <div className="text-xs font-medium text-amber-200/80 mb-1">Suggested equipment</div>
          <ul className="text-xs text-foreground/80 list-disc list-inside space-y-0.5">
            {script.equipment.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function NavButtons({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex items-center gap-2 sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border z-10">
      <button onClick={onBack} className="px-4 py-2.5 rounded-lg border border-border hover:bg-secondary font-medium">← Back</button>
      <button onClick={onNext} className="flex-1 px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold">{nextLabel}</button>
    </div>
  )
}

// ─── PDF + archive ──────────────────────────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any)
  }
  return btoa(binary)
}

interface DrillResultData {
  slug: string
  title: string
  startedAt: string
  opStartedAt: string | null
  opEndedAt: string | null
  endedAt: string
  personnel: PersonnelEntry[]
  scenarioNotes: string
  preChecks: CheckRow[]
  opChecks: CheckRow[]
  debriefChecks: CheckRow[]
  opOverallNotes: string
  debriefSummary: string
  improvements: string
  leader: string
}

async function buildDrillPdf(script: DrillScript, data: DrillResultData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([595.28, 841.89])
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.06, 0.07, 0.09)
  const muted = rgb(0.45, 0.47, 0.5)
  const accent = rgb(0.78, 0.18, 0.18)
  const line = rgb(0.85, 0.85, 0.85)
  const margin = 36
  const width = page.getWidth() - margin * 2
  let y = page.getHeight() - margin

  const ensureSpace = (lines: number) => {
    if (y < margin + lines * 12 + 20) {
      page = pdf.addPage([595.28, 841.89])
      y = page.getHeight() - margin
    }
  }

  // Title
  page.drawText('Drill Report', { x: margin, y: y - 14, size: 16, font: helvBold, color: ink })
  page.drawText('M/Y Rise Above', { x: page.getWidth() - margin - helv.widthOfTextAtSize('M/Y Rise Above', 10), y: y - 12, size: 10, font: helv, color: muted })
  y -= 22
  page.drawText(script.title, { x: margin, y: y - 12, size: 13, font: helvBold, color: accent })
  y -= 22
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
  y -= 8

  // Header rows
  const rows: [string, string][] = [
    ['Date', new Date(data.endedAt).toLocaleString()],
    ['Drill leader', data.leader],
    ['Operation start', data.opStartedAt ? new Date(data.opStartedAt).toLocaleString() : '—'],
    ['Operation end', data.opEndedAt ? new Date(data.opEndedAt).toLocaleString() : '—'],
    ['Duration', formatDuration(data.opStartedAt, data.opEndedAt)],
  ]
  for (const [k, v] of rows) {
    page.drawText(k, { x: margin, y: y - 11, size: 9, font: helvBold, color: muted })
    drawWrapped(page, v, margin + 110, y - 11, width - 110, helv, 10, ink)
    y -= 14
  }

  // Scenario
  y -= 4
  page.drawText('Scenario', { x: margin, y: y - 11, size: 11, font: helvBold, color: ink })
  y -= 14
  const sLines = drawWrapped(page, script.scenario, margin, y - 10, width, helv, 9, ink)
  y -= sLines.linesDrawn * 11 + 4
  if (data.scenarioNotes) {
    page.drawText('Scenario notes', { x: margin, y: y - 11, size: 9, font: helvBold, color: muted })
    y -= 12
    const nLines = drawWrapped(page, data.scenarioNotes, margin, y - 10, width, helv, 9, ink)
    y -= nLines.linesDrawn * 11 + 4
  }

  // Personnel
  ensureSpace(6 + data.personnel.length)
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
  y -= 10
  page.drawText('Personnel involved', { x: margin, y: y - 11, size: 11, font: helvBold, color: ink })
  y -= 14
  for (const p of data.personnel) {
    ensureSpace(2)
    page.drawText(p.role || '—', { x: margin, y: y - 10, size: 9, font: helvBold, color: muted })
    page.drawText(p.name || '—', { x: margin + 180, y: y - 10, size: 10, font: helv, color: ink })
    y -= 13
  }

  // Sections
  drawSection('Pre-briefing', script.preBriefing, data.preChecks)
  drawSection('Drill operation', script.operation, data.opChecks, true)
  if (data.opOverallNotes) {
    ensureSpace(4)
    page.drawText('Operation notes', { x: margin, y: y - 11, size: 9, font: helvBold, color: muted })
    y -= 12
    const u = drawWrapped(page, data.opOverallNotes, margin, y - 10, width, helv, 9, ink)
    y -= u.linesDrawn * 11 + 4
  }
  drawSection('Debriefing', script.debriefing, data.debriefChecks)

  if (data.debriefSummary) {
    ensureSpace(6)
    page.drawText('Debrief summary', { x: margin, y: y - 11, size: 11, font: helvBold, color: ink })
    y -= 14
    const u = drawWrapped(page, data.debriefSummary, margin, y - 10, width, helv, 10, ink)
    y -= u.linesDrawn * 11 + 4
  }
  if (data.improvements) {
    ensureSpace(6)
    page.drawText('Improvements / follow-up', { x: margin, y: y - 11, size: 11, font: helvBold, color: ink })
    y -= 14
    const u = drawWrapped(page, data.improvements, margin, y - 10, width, helv, 10, ink)
    y -= u.linesDrawn * 11 + 4
  }

  // Captain signature footer
  ensureSpace(4)
  y -= 6
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
  y -= 16
  page.drawText('Drill leader', { x: margin, y, size: 9, font: helvBold, color: muted })
  page.drawText(data.leader, { x: margin + 80, y, size: 11, font: helvBold, color: accent })
  page.drawText(new Date(data.endedAt).toLocaleString(), { x: margin + 280, y, size: 9, font: helv, color: muted })

  function drawSection(label: string, items: string[], checks: CheckRow[], numbered = false) {
    ensureSpace(4 + items.length * 2)
    y -= 6
    page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
    y -= 10
    page.drawText(label, { x: margin, y: y - 11, size: 11, font: helvBold, color: ink })
    y -= 14
    for (let i = 0; i < items.length; i++) {
      ensureSpace(2)
      const c = checks[i]
      const box = c?.done ? '[X]' : '[ ]'
      const prefix = numbered ? `${i + 1}.` : '•'
      const itemText = `${box}  ${prefix} ${items[i]}`
      const u = drawWrapped(page, itemText, margin, y - 10, width, helv, 9, ink)
      y -= u.linesDrawn * 11
      if (c?.comment) {
        ensureSpace(1)
        const u2 = drawWrapped(page, `↳ ${c.comment}`, margin + 18, y - 9, width - 18, helv, 8, muted)
        y -= u2.linesDrawn * 10
      }
      y -= 2
    }
  }

  return await pdf.save()
}

function drawWrapped(page: any, text: string, x: number, y: number, maxW: number, font: any, size: number, color: any): { linesDrawn: number } {
  if (!text) { page.drawText('—', { x, y, size, font, color }); return { linesDrawn: 1 } }
  const words = String(text).split(/\s+/)
  let line = ''
  let drawn = 0
  let curY = y
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i]
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      page.drawText(line, { x, y: curY, size, font, color })
      drawn++; curY -= size + 2; line = words[i]
    } else { line = test }
  }
  if (line) { page.drawText(line, { x, y: curY, size, font, color }); drawn++ }
  return { linesDrawn: drawn }
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (s < 0) return '—'
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m} min ${ss.toString().padStart(2, '0')} s`
}

function buildArchiveMarkdown(script: DrillScript, data: DrillResultData, pdfUrl: string): string {
  const lines: string[] = []
  lines.push(`# Drill — ${script.title}`)
  lines.push('')
  lines.push(`- Date: ${new Date(data.endedAt).toLocaleString()}`)
  lines.push(`- Leader: ${data.leader}`)
  lines.push(`- Duration: ${formatDuration(data.opStartedAt, data.opEndedAt)}`)
  if (pdfUrl) lines.push(`- PDF: ${pdfUrl}`)
  lines.push('')
  lines.push(`## Personnel`)
  for (const p of data.personnel) lines.push(`- ${p.role || '—'}: ${p.name || '—'}`)
  lines.push('')
  lines.push(`## Summary`)
  lines.push(data.debriefSummary || '—')
  if (data.improvements) {
    lines.push('')
    lines.push(`## Improvements`)
    lines.push(data.improvements)
  }
  return lines.join('\n')
}

// Silence unused vars in lint when slugifyDrill is dragged in for re-export.
void slugifyDrill
