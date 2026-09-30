// Oil sampling results page.
//
// URL: /maintenance/oil-samples/:unitId
// Units: generator-port / -starboard, main-engine-port / -starboard,
//        transmission-port / -starboard (see data/oil-sample-units.ts).
//
// Crew upload the lab's PDF report with the sample date and running
// hours. Reports are listed newest-first (toggle to sort by running
// hours). The most recent sample is flagged "Current"; everything
// older is "Past".

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { getCrewName, isAdmin } from '@/lib/auth'
import { OIL_SAMPLE_UNITS, findOilSampleUnit } from '@/data/oil-sample-units'
import {
  fetchOilSamples,
  uploadOilSample,
  deleteOilSample,
  fetchSystemState,
  readCachedSystemState,
  type OilSample,
} from '@/lib/maintenance-api'

// Vercel caps request bodies at ~4.5 MB; base64 adds ~33%.
const MAX_PDF_BYTES = 3.2 * 1024 * 1024

function parentHref(systemId: string): string {
  if (systemId === 'generator-port') return '/maintenance/generator/port'
  if (systemId === 'generator-starboard') return '/maintenance/generator/starboard'
  return `/maintenance/system/${systemId}`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result || '')
      resolve(s.slice(s.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function compareByDate(a: OilSample, b: OilSample): number {
  const d = (b.SampleDate || '').localeCompare(a.SampleDate || '')
  if (d !== 0) return d
  return (b.RunningHours ?? -1) - (a.RunningHours ?? -1)
}

export function OilSamplesPage() {
  const params = useParams<{ unitId: string }>()
  const [, setLocation] = useLocation()
  const unit = findOilSampleUnit(params.unitId)
  const admin = isAdmin()

  const [samples, setSamples] = useState<OilSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'hours'>('date')

  const [file, setFile] = useState<File | null>(null)
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [lab, setLab] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!unit) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchOilSamples(unit.id)
      .then(s => { if (!cancelled) setSamples(s) })
      .catch(e => { if (!cancelled) setError((e as Error).message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    // Prefill running hours from the engine / generator hour meter.
    const cached = readCachedSystemState(unit.hoursSystemId)
    if (cached?.currentHours != null) setHours(String(cached.currentHours))
    fetchSystemState(unit.hoursSystemId)
      .then(st => { if (!cancelled && st.currentHours != null) setHours(prev => prev === '' || prev === String(cached?.currentHours ?? '') ? String(st.currentHours) : prev) })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit?.id])

  // "Current" = most recent by sample date, regardless of sort order.
  const currentId = useMemo(() => {
    const byDate = [...samples].sort(compareByDate)
    return byDate[0]?.SampleId || null
  }, [samples])

  const sorted = useMemo(() => {
    const list = [...samples]
    if (sortBy === 'hours') {
      list.sort((a, b) => {
        const h = (b.RunningHours ?? -1) - (a.RunningHours ?? -1)
        return h !== 0 ? h : compareByDate(a, b)
      })
    } else {
      list.sort(compareByDate)
    }
    return list
  }, [samples, sortBy])

  // Hours between each sample and the one before it (chronologically).
  const hoursSincePrev = useMemo(() => {
    const chrono = [...samples].sort((a, b) => -compareByDate(a, b))
    const out: Record<string, number | null> = {}
    for (let i = 0; i < chrono.length; i++) {
      const cur = chrono[i].RunningHours
      const prev = i > 0 ? chrono[i - 1].RunningHours : null
      out[chrono[i].SampleId] = cur != null && prev != null ? cur - prev : null
    }
    return out
  }, [samples])

  if (!unit) {
    return (
      <MenuLayout title="Not found" showBack backHref="/maintenance">
        <p className="text-sm text-muted-foreground">Unknown unit: {params.unitId}</p>
      </MenuLayout>
    )
  }

  const siblings = OIL_SAMPLE_UNITS.filter(u => u.parentSystemId === unit.parentSystemId)

  async function submit() {
    if (!unit) return
    setMsg(null)
    if (!file) { setMsg('Choose a PDF report first.'); return }
    if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { setMsg('Only PDF files are supported.'); return }
    if (file.size > MAX_PDF_BYTES) { setMsg('PDF is larger than 3 MB — please compress it and try again.'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sampleDate)) { setMsg('Enter the sample date.'); return }
    const h = hours.trim() === '' ? null : Number(hours)
    if (h != null && (!Number.isFinite(h) || h < 0)) { setMsg('Running hours must be a positive number.'); return }
    setUploading(true)
    try {
      const pdfBase64 = await fileToBase64(file)
      const saved = await uploadOilSample({
        unitId: unit.id,
        unitLabel: unit.label,
        sampleDate,
        runningHours: h,
        lab: lab.trim(),
        notes: notes.trim(),
        fileName: file.name,
        pdfBase64,
        uploadedBy: getCrewName() || '',
      })
      setSamples(prev => [...prev, saved])
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setNotes('')
      setMsg('Uploaded.')
      setTimeout(() => setMsg(null), 3000)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function remove(s: OilSample) {
    if (!confirm(`Delete the ${fmtDate(s.SampleDate)} oil sample report?`)) return
    setDeletingId(s.SampleId)
    try {
      await deleteOilSample(s.SampleId)
      setSamples(prev => prev.filter(x => x.SampleId !== s.SampleId))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <MenuLayout title={`Oil samples · ${unit.label}`} showBack backHref={parentHref(unit.parentSystemId)}>
      <div className="space-y-5">
        {siblings.length > 1 && (
          <div className="flex gap-2">
            {siblings.map(u => (
              <button
                key={u.id}
                onClick={() => setLocation(`/maintenance/oil-samples/${u.id}`)}
                className={`flex-1 text-xs px-3 py-2 rounded-md border font-semibold ${
                  u.id === unit.id
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                {u.id.startsWith('transmission') ? 'Transmission' : 'Engine'}
              </button>
            ))}
          </div>
        )}

        {/* Upload */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Upload lab report</div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">PDF report</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-red-700"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Sample date</span>
              <input
                type="date"
                value={sampleDate}
                onChange={e => setSampleDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Running hours</span>
              <input
                type="number"
                inputMode="decimal"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="e.g. 4250"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Lab (optional)</span>
            <input
              value={lab}
              onChange={e => setLab(e.target.value)}
              placeholder="e.g. Cat S·O·S"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Result summary, lab recommendations…"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={uploading}
              className="text-xs px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload report'}
            </button>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Sampling results</div>
            <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
              {(['date', 'hours'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className={`px-2.5 py-1 font-semibold ${sortBy === k ? 'bg-red-600 text-white' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  {k === 'date' ? 'By date' : 'By hours'}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 text-xs p-2">{error}</div>
          )}
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="text-xs text-muted-foreground">No oil sample reports uploaded yet.</div>
          ) : (
            <ul className="space-y-2">
              {sorted.map(s => {
                const isCurrent = s.SampleId === currentId
                const delta = hoursSincePrev[s.SampleId]
                return (
                  <li
                    key={s.SampleId}
                    className={`rounded-lg border p-3 ${isCurrent ? 'border-red-500/50 bg-red-500/5' : 'border-border/60'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{fmtDate(s.SampleDate)}</span>
                          <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${
                            isCurrent ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-secondary text-muted-foreground border-border'
                          }`}>
                            {isCurrent ? 'Current' : 'Past'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {s.RunningHours != null ? `${s.RunningHours.toLocaleString()} h` : 'hours not recorded'}
                          {delta != null && delta >= 0 && <span> · +{delta.toLocaleString()} h since previous</span>}
                          {s.Lab && <span> · {s.Lab}</span>}
                        </div>
                        {s.Notes && <div className="text-xs text-foreground/80 mt-1 whitespace-pre-wrap">{s.Notes}</div>}
                        {s.UploadedBy && (
                          <div className="text-[10px] text-muted-foreground mt-1">uploaded by {s.UploadedBy}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {s.DriveLink && (
                          <a
                            href={s.DriveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-3 py-1.5 rounded-md border border-red-500/40 text-red-300 hover:bg-red-500/10 font-semibold"
                          >
                            View PDF ↗
                          </a>
                        )}
                        {admin && (
                          <button
                            onClick={() => remove(s)}
                            disabled={deletingId === s.SampleId}
                            className="text-[11px] text-muted-foreground hover:text-red-300 disabled:opacity-50"
                          >
                            {deletingId === s.SampleId ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </MenuLayout>
  )
}
