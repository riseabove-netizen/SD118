import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { fetchGuide, saveGuide, uploadGuidePhoto, uploadDrivePdf } from '@/lib/guides'
import { getCrewName, isAdmin } from '@/lib/auth'
import { AnchorWatchSchedule } from './AnchorWatchSchedule'
import { useGeolocation, formatCoords } from '@/lib/useGeolocation'
import {
  ANCHOR_CHECKLIST,
  ANCHOR_WATCH_ACTIVE_ID,
  emptyAnchorWatch,
  type AnchorWatchData,
  type AnchorWatchSign,
} from '@/data/anchor-watch-seed'
import {
  fetchWindForecast,
  buildWindSvg,
  esriSatelliteUrl,
  svgToPngBytes,
  fetchImageBytes,
  compass,
  type WindForecast,
} from '@/lib/anchor-watch-utils'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { applyBranding, PDF_BRANDING_TOP_MARGIN } from '@/lib/pdfBranding'
import { MapPicker, googleMapsUrl } from '@/components/MapPicker'

// JSON-in-markdown storage (same pattern as Fire Equipment).
const DATA_PREFIX = '<!-- ANCHOR-WATCH-DATA:'
const DATA_SUFFIX = '-->'

function decode(markdown: string): AnchorWatchData | null {
  if (!markdown) return null
  const start = markdown.indexOf(DATA_PREFIX)
  if (start < 0) return null
  const end = markdown.indexOf(DATA_SUFFIX, start + DATA_PREFIX.length)
  if (end < 0) return null
  try {
    const data = JSON.parse(markdown.slice(start + DATA_PREFIX.length, end).trim())
    return { ...emptyAnchorWatch(), ...data }
  } catch { return null }
}

function encode(data: AnchorWatchData): string {
  const json = JSON.stringify(data)
  const lines: string[] = []
  lines.push(`# Anchor Watch — ${data.locationName || '(no name)'}`)
  lines.push('')
  lines.push(`- Started: ${data.startedAt || '—'} by ${data.startedBy || '—'}`)
  if (data.closed) lines.push(`- Closed: ${data.closedAt || '—'} by ${data.closedBy || '—'}`)
  lines.push(`- Position: ${data.coordsFormatted || '—'}`)
  lines.push(`- Depth: ${data.depth || '—'} m · Chain: ${data.chainLength || '—'} · Safety ring: ${data.safetyRing || '—'} m`)
  lines.push(`- Contact Captain if wind > ${data.windAlarmKt || '16'} kt`)
  lines.push('')
  lines.push(`## Signatures (${data.signatures.length})`)
  for (const s of data.signatures) {
    lines.push(`- ${new Date(s.timestamp).toLocaleString()} — **${s.name}** — wind ${s.wind || '—'}${s.notes ? ` — ${s.notes}` : ''}`)
  }
  return `${DATA_PREFIX}${json}${DATA_SUFFIX}\n\n${lines.join('\n')}`
}

// ─────────────────────────────────────────────────────────────────────────

function Field(props: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{props.label}</span>
      {props.children}
      {props.hint && <span className="block text-xs text-muted-foreground/70 mt-1">{props.hint}</span>}
    </label>
  )
}

function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <input
      type={props.type || 'text'}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      disabled={props.disabled}
      className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:border-destructive focus:outline-none disabled:opacity-60"
    />
  )
}

function TextArea(props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      rows={props.rows || 3}
      disabled={props.disabled}
      className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:border-destructive focus:outline-none disabled:opacity-60"
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────

export function AnchorWatchPage() {
  const [, setLocation] = useLocation()
  const [data, setData] = useState<AnchorWatchData>(emptyAnchorWatch())
  const [phase, setPhase] = useState<'loading' | 'setup' | 'active' | 'closed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [wind, setWind] = useState<WindForecast | null>(null)
  const [satelliteUrl, setSatelliteUrl] = useState<string>('')
  const [chartTrackPreview, setChartTrackPreview] = useState<string | null>(null)

  const geo = useGeolocation()

  // Sign-watch sub-form
  const [signName, setSignName] = useState<string>('')
  const [signWind, setSignWind] = useState<string>('')
  const [signNotes, setSignNotes] = useState<string>('')

  // Captain close-out sub-form
  const [captainName, setCaptainName] = useState<string>('')

  // Setup-phase: user must confirm coords are correct before Start enables.
  const [coordsConfirmed, setCoordsConfirmed] = useState<boolean>(false)

  // Active-phase: edit-position modal toggle + draft values
  const [editingPos, setEditingPos] = useState<boolean>(false)
  const [draftLat, setDraftLat] = useState<number | null>(null)
  const [draftLon, setDraftLon] = useState<number | null>(null)

  // Initial load: try to fetch the active watch from the Guide store.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const g = await fetchGuide(ANCHOR_WATCH_ACTIVE_ID).catch(() => null as any)
        if (cancelled) return
        const decoded = g ? decode(g?.Markdown || '') : null
        if (decoded && !decoded.closed) {
          setData(decoded)
          setPhase('active')
          if (decoded.lat != null && decoded.lon != null) {
            setSatelliteUrl(decoded.satelliteUrl || esriSatelliteUrl(decoded.lat, decoded.lon))
            try {
              const fc = await fetchWindForecast(decoded.lat, decoded.lon)
              if (!cancelled) setWind(fc)
            } catch {}
          }
        } else {
          setPhase('setup')
        }
      } catch {
        setPhase('setup')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Default the signer name to the logged-in crew member.
  useEffect(() => {
    const n = getCrewName()
    if (n) {
      setSignName(prev => prev || n)
      setCaptainName(prev => prev || n)
    }
  }, [])

  // Pre-fill coords from device on the setup screen.
  useEffect(() => {
    if (phase !== 'setup') return
    if (geo.position && data.lat == null) {
      setData(d => ({
        ...d,
        lat: geo.position!.lat,
        lon: geo.position!.lon,
        coordsFormatted: geo.formatted,
      }))
    }
  }, [phase, geo.position, geo.formatted, data.lat])

  const checklistDone = useMemo(() => {
    let total = 0, done = 0
    for (const it of ANCHOR_CHECKLIST) {
      if (it.isGroup) continue
      total++
      if (data.checklist[it.id]) done++
    }
    return { total, done }
  }, [data.checklist])

  // ── Setup: start the watch ─────────────────────────────────────────
  const handleStart = async () => {
    setError(null)
    if (!data.locationName.trim()) { setError('Location name is required'); return }
    if (data.lat == null || data.lon == null) {
      setError(geo.error || 'Waiting for GPS — please allow location access.')
      return
    }
    if (!coordsConfirmed) {
      setError('Please confirm the coordinates on the map are correct.')
      return
    }
    setBusy('Starting watch…')
    try {
      const lat = data.lat, lon = data.lon
      // Fetch wind + satellite snapshot, then save the active record.
      let fc: WindForecast | null = null
      try { fc = await fetchWindForecast(lat, lon) } catch (e) { console.warn('wind forecast failed', e) }
      const sat = esriSatelliteUrl(lat, lon)
      const now = new Date().toISOString()
      const user = getCrewName() || 'crew'
      const next: AnchorWatchData = {
        ...data,
        startedAt: now,
        startedBy: user,
        satelliteUrl: sat,
        windForecastJson: fc ? JSON.stringify(fc) : undefined,
      }
      await saveGuide({
        id: ANCHOR_WATCH_ACTIVE_ID,
        title: `Anchor Watch — ${next.locationName}`,
        category: 'Anchor Watch',
        markdown: encode(next),
        user,
        note: 'Watch started',
      })
      setData(next)
      setWind(fc)
      setSatelliteUrl(sat)
      setPhase('active')
    } catch (e: any) {
      setError(e?.message || 'Failed to start watch')
    } finally {
      setBusy(null)
    }
  }

  const persist = async (next: AnchorWatchData, note: string) => {
    const user = getCrewName() || 'crew'
    await saveGuide({
      id: ANCHOR_WATCH_ACTIVE_ID,
      title: `Anchor Watch — ${next.locationName}`,
      category: 'Anchor Watch',
      markdown: encode(next),
      user,
      note,
    })
  }

  const toggleChecklist = async (id: string) => {
    const next = { ...data, checklist: { ...data.checklist, [id]: !data.checklist[id] } }
    setData(next)
    try { await persist(next, 'Checklist update') } catch (e: any) { setError(e?.message || 'Save failed') }
  }

  const handleSign = async () => {
    setError(null)
    if (!signName.trim()) { setError('Watch keeper name is required'); return }
    const entry: AnchorWatchSign = {
      name: signName.trim(),
      timestamp: new Date().toISOString(),
      wind: signWind.trim() || undefined,
      notes: signNotes.trim() || undefined,
    }
    const next = { ...data, signatures: [...data.signatures, entry] }
    setData(next)
    setSignWind('')
    setSignNotes('')
    setBusy('Saving signature…')
    try { await persist(next, 'Watch sign') }
    catch (e: any) { setError(e?.message || 'Save failed') }
    finally { setBusy(null) }
  }

  // Captain close-out: chart photo upload, build PDF, upload to Drive, archive,
  // then clear the active record. Two inputs so the user can choose between
  // taking a fresh photo (camera) and uploading an existing one (gallery /
  // desktop screenshot).
  const chartCameraInputRef = useRef<HTMLInputElement | null>(null)
  const chartUploadInputRef = useRef<HTMLInputElement | null>(null)

  const handleChartFile = async (file: File) => {
    setError(null)
    setBusy('Uploading chart photo…')
    try {
      const base64 = await fileToBase64(file)
      const url = await uploadGuidePhoto(base64, `anchor-watch-chart`)
      setChartTrackPreview(url)
      const next = { ...data, chartTrackPhotoUrl: url }
      setData(next)
      await persist(next, 'Chart track photo')
    } catch (e: any) {
      setError(e?.message || 'Chart upload failed')
    } finally { setBusy(null) }
  }

  const handleCloseAndSign = async () => {
    setError(null)
    if (!isAdmin()) { setError('Only admins can close the watch and generate the PDF.'); return }
    if (!captainName.trim()) { setError('Captain name is required to close the watch'); return }
    setBusy('Building report…')
    try {
      const closedData: AnchorWatchData = {
        ...data,
        closed: true,
        closedAt: new Date().toISOString(),
        closedBy: captainName.trim(),
      }
      // 1) Build PDF
      const pdfBytes = await buildPdf(closedData, wind, satelliteUrl)
      // 2) Upload PDF to Drive — filename format: YYYY_MM_DD-<Anchorage>.pdf
      const datePart = closedData.closedAt!.slice(0, 10).replace(/-/g, '_')
      const anchorPart = (closedData.locationName || 'untitled').trim().replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'untitled'
      const filename = `${datePart}-${anchorPart}.pdf`
      const pdfB64 = uint8ToBase64(pdfBytes)
      const up = await uploadDrivePdf(pdfB64, filename, 'AnchorWatch')
      closedData.pdfUrl = up.viewUrl
      // 3) Archive: write a new permanent guide record (G- ID auto-assigned) with the closed data.
      const user = closedData.closedBy!
      await saveGuide({
        title: `Anchor Watch — ${closedData.locationName} — ${closedData.closedAt!.slice(0, 10)}`,
        category: 'Anchor Watch',
        markdown: encode(closedData),
        user,
        note: 'Archived closed watch',
      })
      // 4) Clear the active slot by re-writing it as closed (so a new watch can start).
      await saveGuide({
        id: ANCHOR_WATCH_ACTIVE_ID,
        title: 'Anchor Watch — (cleared)',
        category: 'Anchor Watch',
        markdown: encode({ ...emptyAnchorWatch(), closed: true }),
        user,
        note: 'Active slot cleared',
      })
      setData(closedData)
      setPhase('closed')
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to close watch')
    } finally { setBusy(null) }
  }

  const handleStartNew = () => {
    setData(emptyAnchorWatch())
    setWind(null)
    setSatelliteUrl('')
    setChartTrackPreview(null)
    setCoordsConfirmed(false)
    setPhase('setup')
  }

  // Active-phase: open / save position edit
  const openEditPosition = () => {
    setDraftLat(data.lat ?? null)
    setDraftLon(data.lon ?? null)
    setEditingPos(true)
  }
  const saveEditedPosition = async () => {
    if (draftLat == null || draftLon == null) { setEditingPos(false); return }
    setBusy('Updating position…')
    try {
      const sat = esriSatelliteUrl(draftLat, draftLon)
      const next: AnchorWatchData = {
        ...data,
        lat: draftLat,
        lon: draftLon,
        coordsFormatted: formatCoords(draftLat, draftLon),
        satelliteUrl: sat,
      }
      setData(next)
      setSatelliteUrl(sat)
      await persist(next, 'Position updated')
      try {
        const fc = await fetchWindForecast(draftLat, draftLon)
        setWind(fc)
        const withWind = { ...next, windForecastJson: JSON.stringify(fc) }
        setData(withWind)
        await persist(withWind, 'Wind forecast refreshed')
      } catch (e) { console.warn('wind refresh failed', e) }
      setEditingPos(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to update position')
    } finally { setBusy(null) }
  }

  // ── Render ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <MenuLayout title="Anchor Watch" showBack backHref="/ism">
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Loading…</div>
      </MenuLayout>
    )
  }

  return (
    <MenuLayout
      title="Anchor Watch"
      showBack
      backHref="/ism"
    >
      <div className="space-y-4 pb-32">
        <div>
          <h2 className="text-xl font-bold">Anchor Watchkeeper Log</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {phase === 'setup'   && 'Set the anchorage details, then start the watch.'}
            {phase === 'active'  && `${data.locationName} · in progress — open until the captain closes it.`}
            {phase === 'closed'  && 'Watch closed and signed. PDF saved to Google Drive.'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        {busy && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">{busy}</div>
        )}

        {phase === 'setup' && (
          <SetupPanel
            data={data}
            setData={setData}
            geo={geo}
            onStart={handleStart}
            disabled={!!busy}
            coordsConfirmed={coordsConfirmed}
            setCoordsConfirmed={setCoordsConfirmed}
          />
        )}

        {phase === 'active' && (
          <ActivePanel
            data={data}
            wind={wind}
            satelliteUrl={satelliteUrl}
            checklistDone={checklistDone}
            onToggle={toggleChecklist}
            signName={signName} setSignName={setSignName}
            signWind={signWind} setSignWind={setSignWind}
            signNotes={signNotes} setSignNotes={setSignNotes}
            onSign={handleSign}
            chartCameraInputRef={chartCameraInputRef}
            chartUploadInputRef={chartUploadInputRef}
            chartTrackPreview={chartTrackPreview || data.chartTrackPhotoUrl || null}
            onPickChart={(f) => handleChartFile(f)}
            captainName={captainName} setCaptainName={setCaptainName}
            onClose={handleCloseAndSign}
            disabled={!!busy}
            onEditPosition={openEditPosition}
          />
        )}

        {phase === 'active' && editingPos && draftLat != null && draftLon != null && (
          <EditPositionModal
            lat={draftLat}
            lon={draftLon}
            gpsLat={geo.position?.lat ?? null}
            gpsLon={geo.position?.lon ?? null}
            onChange={(la, lo) => { setDraftLat(la); setDraftLon(lo) }}
            onCancel={() => setEditingPos(false)}
            onSave={saveEditedPosition}
            busy={!!busy}
            onUseGps={() => {
              if (geo.position) {
                setDraftLat(geo.position.lat)
                setDraftLon(geo.position.lon)
              }
            }}
            hasGps={!!geo.position}
          />
        )}

        {phase === 'closed' && (
          <ClosedPanel data={data} onStartNew={handleStartNew} />
        )}
      </div>
    </MenuLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Setup panel

function SetupPanel(props: {
  data: AnchorWatchData
  setData: React.Dispatch<React.SetStateAction<AnchorWatchData>>
  geo: ReturnType<typeof useGeolocation>
  onStart: () => void
  disabled: boolean
  coordsConfirmed: boolean
  setCoordsConfirmed: (v: boolean) => void
}) {
  const { data, setData, geo, onStart, disabled, coordsConfirmed, setCoordsConfirmed } = props

  const hasCoords = data.lat != null && data.lon != null
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold">General Information</h3>
        <Field label="Location name (used as title)">
          <TextInput value={data.locationName} onChange={(v) => setData(d => ({ ...d, locationName: v }))} placeholder="e.g. Cala Llamp" />
        </Field>
        <Field label="Location notes">
          <TextArea value={data.locationNotes} onChange={(v) => setData(d => ({ ...d, locationNotes: v }))} placeholder="Anchorage notes, approach, neighbours, holding ground…" />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="block text-xs font-medium text-muted-foreground">Coordinates (drag map to adjust)</span>
            {geo.position && hasCoords && (data.lat !== geo.position.lat || data.lon !== geo.position.lon) && (
              <button
                type="button"
                onClick={() => setData(d => ({
                  ...d,
                  lat: geo.position!.lat,
                  lon: geo.position!.lon,
                  coordsFormatted: geo.formatted,
                }))}
                className="text-[11px] text-orange-300 hover:text-orange-200 underline"
              >
                Reset to GPS
              </button>
            )}
          </div>
          {hasCoords ? (
            <MapPicker
              lat={data.lat!}
              lon={data.lon!}
              onChange={(la, lo) => setData(d => ({
                ...d,
                lat: la,
                lon: lo,
                coordsFormatted: formatCoords(la, lo),
              }))}
              gpsLat={geo.position?.lat ?? null}
              gpsLon={geo.position?.lon ?? null}
              height={300}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
              {geo.loading ? 'Waiting for GPS…' : (geo.error || 'GPS unavailable. Enable location to continue.')}
            </div>
          )}
          {hasCoords && (
            <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
              <CoordsLink lat={data.lat!} lon={data.lon!} text={data.coordsFormatted} />
              {geo.position && (
                <span className="text-[11px] text-muted-foreground">
                  GPS: {formatCoords(geo.position.lat, geo.position.lon)}
                </span>
              )}
            </div>
          )}
        </div>
        <label className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer ${coordsConfirmed ? 'border-green-500/50 bg-green-500/10' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <input
            type="checkbox"
            checked={coordsConfirmed}
            onChange={(e) => setCoordsConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-green-500"
          />
          <span className="text-xs">
            <span className="font-semibold">I confirm the coordinates on the map are correct</span>
            <span className="block text-muted-foreground mt-0.5">Drag the map until the pin sits over the actual anchor position before checking this box.</span>
          </span>
        </label>
        <Field label="Physical danger">
          <TextInput value={data.physicalDanger} onChange={(v) => setData(d => ({ ...d, physicalDanger: v }))} placeholder="Rocks, shallows, traffic…" />
        </Field>
        <Field label="Neighbouring vessel / presence">
          <TextInput value={data.presenceOfCouple} onChange={(v) => setData(d => ({ ...d, presenceOfCouple: v }))} placeholder="Closest vessel, distance, name" />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-3 gap-3">
        <Field label="Depth (m)">
          <TextInput value={data.depth} onChange={(v) => setData(d => ({ ...d, depth: v }))} placeholder="m" />
        </Field>
        <Field label="Chain length">
          <TextInput value={data.chainLength} onChange={(v) => setData(d => ({ ...d, chainLength: v }))} placeholder="shackles / m" />
        </Field>
        <Field label="Safety ring (m)">
          <TextInput value={data.safetyRing} onChange={(v) => setData(d => ({ ...d, safetyRing: v }))} placeholder="m" />
        </Field>
        <Field label="Contact Captain if wind > (kt)">
          <TextInput value={data.windAlarmKt} onChange={(v) => setData(d => ({ ...d, windAlarmKt: v }))} placeholder="16" />
        </Field>
      </div>

      <button
        onClick={onStart}
        disabled={disabled || !hasCoords || !coordsConfirmed || !data.locationName.trim()}
        className="w-full px-4 py-3 rounded-lg bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
      >
        {!coordsConfirmed && hasCoords ? 'Confirm coordinates to start' : 'Start anchor watch'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Active panel

function ActivePanel(props: {
  data: AnchorWatchData
  wind: WindForecast | null
  satelliteUrl: string
  checklistDone: { total: number; done: number }
  onToggle: (id: string) => void
  signName: string; setSignName: (v: string) => void
  signWind: string; setSignWind: (v: string) => void
  signNotes: string; setSignNotes: (v: string) => void
  onSign: () => void
  chartCameraInputRef: React.MutableRefObject<HTMLInputElement | null>
  chartUploadInputRef: React.MutableRefObject<HTMLInputElement | null>
  chartTrackPreview: string | null
  onPickChart: (f: File) => void
  captainName: string; setCaptainName: (v: string) => void
  onClose: () => void
  disabled: boolean
  onEditPosition: () => void
}) {
  const { data, wind, satelliteUrl, checklistDone, onToggle, signName, setSignName, signWind, setSignWind, signNotes, setSignNotes, onSign, chartCameraInputRef, chartUploadInputRef, chartTrackPreview, onPickChart, captainName, setCaptainName, onClose, disabled, onEditPosition } = props
  const windSvg = useMemo(() => (wind ? buildWindSvg(wind) : null), [wind])
  const alarmKt = parseFloat(data.windAlarmKt || '16')

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-destructive/30 bg-card p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Anchorage</div>
            <div className="text-lg font-bold">{data.locationName || '—'}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {data.lat != null && data.lon != null
                ? <CoordsLink lat={data.lat} lon={data.lon} text={data.coordsFormatted} />
                : (data.coordsFormatted || '—')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Started</div>
            <div className="text-sm">{data.startedAt ? new Date(data.startedAt).toLocaleString() : '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">by {data.startedBy || '—'}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t border-border">
          <Stat label="Depth" value={`${data.depth || '—'} m`} />
          <Stat label="Chain" value={data.chainLength || '—'} />
          <Stat label="Safety ring" value={`${data.safetyRing || '—'} m`} />
        </div>
        {data.locationNotes && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">Notes</div>
            <div className="text-sm whitespace-pre-wrap">{data.locationNotes}</div>
          </div>
        )}
      </div>

      {/* Visuals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {satelliteUrl && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 text-xs font-medium border-b border-border flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Satellite —{' '}
                {data.lat != null && data.lon != null
                  ? <CoordsLink lat={data.lat} lon={data.lon} text={data.coordsFormatted} />
                  : data.coordsFormatted}
              </span>
              <button
                onClick={onEditPosition}
                disabled={disabled}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-orange-300 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/>
                </svg>
                Edit position
              </button>
            </div>
            <div className="relative">
              <img src={satelliteUrl} alt="Satellite view" className="w-full h-56 object-cover" />
              {/* Anchor marker dead-center over the satellite image. */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600/90 border-2 border-white shadow-lg">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="5" r="2"/>
                    <path d="M12 7v14"/>
                    <path d="M5 18a7 7 0 0 0 14 0"/>
                    <path d="M8 11h8"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
        {windSvg && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
              Wind forecast — next 24 h
            </div>
            <div className="bg-[#0b1220]" dangerouslySetInnerHTML={{ __html: windSvg }} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <span className="font-semibold text-amber-300">CONTACT THE CAPTAIN</span>
        <span className="text-amber-200/90"> if the wind exceeds <span className="font-bold">{alarmKt} kt</span> or if the safety-ring alarm sounds.</span>
      </div>

      {/* Checklist */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Anchoring checklist</h3>
          <span className="text-xs text-muted-foreground">{checklistDone.done}/{checklistDone.total}</span>
        </div>
        <ul className="divide-y divide-border">
          {ANCHOR_CHECKLIST.map(item => (
            <li key={item.id} className={`px-4 py-2 ${item.indent === 1 ? 'pl-10' : ''}`}>
              {item.isGroup ? (
                <div className="text-sm font-semibold text-foreground">{item.label}</div>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={!!data.checklist[item.id]}
                    onChange={() => onToggle(item.id)}
                    className="w-5 h-5 accent-red-500"
                  />
                  <span className={data.checklist[item.id] ? 'line-through text-muted-foreground' : ''}>{item.label}</span>
                </label>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Watch schedule + notifications */}
      <AnchorWatchSchedule data={data} disabled={disabled} />

      {/* Sign-watch form — kept above the Watch Logged history so the
          current keeper reaches it first when scrolling. */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Sign hourly watch</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Watch keeper">
            <TextInput value={signName} onChange={setSignName} placeholder="Your name" />
          </Field>
          <Field label="Wind reading">
            <TextInput value={signWind} onChange={setSignWind} placeholder="e.g. 12 kt NW" />
          </Field>
        </div>
        <Field label="Observations / notes">
          <TextArea value={signNotes} onChange={setSignNotes} placeholder="Anything you saw — vessel movement, weather change, alarm…" rows={2} />
        </Field>
        <button
          onClick={onSign}
          disabled={disabled}
          className="w-full px-4 py-2.5 rounded-lg bg-destructive hover:bg-destructive/90 disabled:opacity-50 text-white font-semibold"
        >
          Sign — {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      {/* Log history — signature history */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold">Log history ({data.signatures.length})</h3>
        </div>
        {data.signatures.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">No signatures yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {data.signatures.map((s, i) => (
              <li key={i} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(s.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Wind: {s.wind || '—'}{s.notes ? ` · ${s.notes}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Captain close-out — admins only */}
      {!isAdmin() ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">Close watch — captain only</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Closing the anchor watch and generating the PDF requires an admin login. Ask the captain to sign in as admin to finish the watch.
          </p>
        </div>
      ) : (
      <div className="rounded-xl border border-amber-500/30 bg-card p-4 space-y-3">
        <h3 className="font-semibold">Close watch — captain only</h3>
        <p className="text-xs text-muted-foreground">Add a photo or screenshot of the chart tracks, then sign as captain. A PDF will be created and uploaded to Google Drive.</p>

        <div>
          {/* Hidden inputs: one opens the camera (mobile), one opens the file picker (gallery / desktop screenshots). */}
          <input
            ref={chartCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickChart(f); e.currentTarget.value = '' }}
          />
          <input
            ref={chartUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickChart(f); e.currentTarget.value = '' }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => chartUploadInputRef.current?.click()}
              disabled={disabled}
              className="px-3 py-2.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {chartTrackPreview ? 'Replace — Upload' : 'Upload photo'}
            </button>
            <button
              onClick={() => chartCameraInputRef.current?.click()}
              disabled={disabled}
              className="px-3 py-2.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {chartTrackPreview ? 'Replace — Camera' : 'Take photo'}
            </button>
          </div>
          {chartTrackPreview && (
            <img src={chartTrackPreview} alt="Chart tracks" className="mt-3 w-full rounded-lg border border-border" />
          )}
        </div>

        <Field label="Captain name">
          <TextInput value={captainName} onChange={setCaptainName} placeholder="Captain signature" />
        </Field>

        <button
          onClick={onClose}
          disabled={disabled}
          className="w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold"
        >
          Close & sign — generate PDF
        </button>
      </div>
      )}
    </div>
  )
}

function Stat(props: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="text-sm font-medium">{props.value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Closed panel

function ClosedPanel(props: { data: AnchorWatchData; onStartNew: () => void }) {
  const { data, onStartNew } = props
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="font-semibold text-emerald-300">Anchor watch closed</div>
        <div className="text-sm text-muted-foreground mt-1">
          {data.locationName} — signed by {data.closedBy} on {data.closedAt ? new Date(data.closedAt).toLocaleString() : '—'}.
        </div>
        {data.pdfUrl && (
          <a
            href={data.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold"
          >
            Open PDF in Drive
          </a>
        )}
      </div>
      <button
        onClick={onStartNew}
        className="w-full px-4 py-3 rounded-lg border border-border hover:bg-secondary font-medium"
      >
        Start a new anchor watch
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Coords link

function CoordsLink(props: { lat: number; lon: number; text?: string }) {
  const { lat, lon, text } = props
  const label = text || formatCoords(lat, lon)
  return (
    <a
      href={googleMapsUrl(lat, lon)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-orange-300 hover:text-orange-200 underline decoration-dotted underline-offset-2"
      title="Open in Google Maps"
    >
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <span>{label}</span>
    </a>
  )
}

// Edit-position modal (active watch)

function EditPositionModal(props: {
  lat: number
  lon: number
  gpsLat: number | null
  gpsLon: number | null
  onChange: (lat: number, lon: number) => void
  onCancel: () => void
  onSave: () => void
  onUseGps: () => void
  hasGps: boolean
  busy: boolean
}) {
  const { lat, lon, gpsLat, gpsLon, onChange, onCancel, onSave, onUseGps, hasGps, busy } = props
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Edit anchor position</h3>
          <button onClick={onCancel} disabled={busy} className="text-muted-foreground hover:text-foreground disabled:opacity-50">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Drag the map until the crosshair sits over the actual anchor position. The satellite
            snapshot, position field and wind forecast will all be refreshed when you save.
          </p>
          <MapPicker
            lat={lat}
            lon={lon}
            onChange={onChange}
            gpsLat={gpsLat}
            gpsLon={gpsLon}
            height={320}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CoordsLink lat={lat} lon={lon} />
            {hasGps && (
              <button
                type="button"
                onClick={onUseGps}
                className="text-[11px] text-orange-300 hover:text-orange-200 underline"
              >
                Use current GPS
              </button>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-background/50">
          <button
            onClick={onSave}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-lg bg-destructive hover:bg-destructive/90 disabled:opacity-50 text-white font-semibold text-sm"
          >
            {busy ? 'Saving…' : 'Save position'}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// File / base64 helpers

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      const base64 = url.split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error || new Error('Read failed'))
    reader.readAsDataURL(file)
  })
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any)
  }
  return btoa(binary)
}

// ─────────────────────────────────────────────────────────────────────────
// PDF builder

async function buildPdf(data: AnchorWatchData, wind: WindForecast | null, satelliteUrl: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([595.28, 841.89]) // A4 portrait, points
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.06, 0.07, 0.09)
  const muted = rgb(0.45, 0.47, 0.5)
  const accent = rgb(0.78, 0.18, 0.18)
  const line = rgb(0.85, 0.85, 0.85)

  const margin = 36
  const width = page.getWidth() - margin * 2
  // Reserve room at top for branded header (logo + vessel name) and bottom for footer.
  let y = page.getHeight() - PDF_BRANDING_TOP_MARGIN

  // Title (vessel label + logo come from the branding overlay)
  page.drawText('Anchor Watchkeeper Log', { x: margin, y: y - 14, size: 16, font: helvBold, color: ink })
  y -= 22
  page.drawText(data.locationName || '(unnamed anchorage)', { x: margin, y: y - 12, size: 13, font: helvBold, color: accent })
  y -= 22
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
  y -= 8

  // General info table
  const rows: [string, string][] = [
    ['Position', data.coordsFormatted || '—'],
    ['Started', `${data.startedAt ? new Date(data.startedAt).toLocaleString() : '—'} · by ${data.startedBy || '—'}`],
    ['Closed', data.closed ? `${new Date(data.closedAt || '').toLocaleString()} · by ${data.closedBy || '—'}` : 'open'],
    ['Depth / Chain / Ring', `${data.depth || '—'} m  ·  ${data.chainLength || '—'}  ·  ${data.safetyRing || '—'} m`],
    ['Physical danger', data.physicalDanger || '—'],
    ['Neighbouring vessel', data.presenceOfCouple || '—'],
    ['Alarm threshold', `Contact captain if wind > ${data.windAlarmKt || '16'} kt`],
  ]
  for (const [k, v] of rows) {
    page.drawText(k, { x: margin, y: y - 11, size: 9, font: helvBold, color: muted })
    drawWrapped(page, v, margin + 130, y - 11, width - 130, helv, 10, ink)
    y -= 16
  }
  if (data.locationNotes) {
    y -= 4
    page.drawText('Notes', { x: margin, y: y - 11, size: 9, font: helvBold, color: muted })
    const used = drawWrapped(page, data.locationNotes, margin + 130, y - 11, width - 130, helv, 10, ink)
    y -= 11 + used.linesDrawn * 12
  }
  y -= 6
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
  y -= 8

  // Images: satellite + wind chart, side by side
  const imgW = (width - 8) / 2
  const imgH = 150
  try {
    if (satelliteUrl) {
      const { bytes, mime } = await fetchImageBytes(satelliteUrl)
      const img = mime.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
      const satX = margin
      const satY = y - imgH
      page.drawImage(img, { x: satX, y: satY, width: imgW, height: imgH })
      page.drawText('Satellite view', { x: satX + 4, y: y - 10, size: 8, font: helvBold, color: rgb(1, 1, 1) })

      // Anchor marker centered over the satellite image (matches on-screen overlay).
      try {
        const markerSize = 32 // pt — diameter of red disk
        const anchorSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="30" fill="#dc2626" stroke="#ffffff" stroke-width="4"/>
  <g transform="translate(24,24)" fill="none" stroke="#ffffff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="24" cy="10" r="4"/>
    <line x1="24" y1="14" x2="24" y2="42"/>
    <path d="M10 36a14 14 0 0 0 28 0"/>
    <line x1="16" y1="22" x2="32" y2="22"/>
  </g>
</svg>`
        const markerPng = await svgToPngBytes(anchorSvg, 2)
        const markerImg = await pdf.embedPng(markerPng)
        const cx = satX + imgW / 2 - markerSize / 2
        const cy = satY + imgH / 2 - markerSize / 2
        page.drawImage(markerImg, { x: cx, y: cy, width: markerSize, height: markerSize })
      } catch (e) { console.warn('Anchor marker embed failed', e) }
    }
  } catch (e) { console.warn('Satellite embed failed', e) }
  try {
    if (wind) {
      const svg = buildWindSvg(wind, { width: 720, height: 220, bg: '#ffffff' })
      // Replace dark colors with print-friendly: render on white background
      const printSvg = svg
        .replace('#0b1220', '#ffffff')
        .replace(/#94a3b8/g, '#475569')
        .replace(/#fef2f2/g, '#0f172a')
      const pngBytes = await svgToPngBytes(printSvg, 2)
      const img = await pdf.embedPng(pngBytes)
      page.drawImage(img, { x: margin + imgW + 8, y: y - imgH, width: imgW, height: imgH })
    }
  } catch (e) { console.warn('Wind chart embed failed', e) }
  y -= imgH + 14

  // Checklist summary
  page.drawText('Anchoring checklist', { x: margin, y: y - 11, size: 11, font: helvBold, color: ink })
  y -= 16
  for (const item of ANCHOR_CHECKLIST) {
    if (item.isGroup) {
      page.drawText(item.label, { x: margin, y: y - 10, size: 9, font: helvBold, color: muted })
      y -= 12
      continue
    }
    const checked = !!data.checklist[item.id]
    const box = checked ? '[X]' : '[ ]'
    page.drawText(`${box}  ${item.label}`, { x: margin + (item.indent === 1 ? 18 : 6), y: y - 10, size: 9, font: helv, color: ink })
    y -= 12
    if (y < margin + 240) break
  }
  y -= 6
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
  y -= 8

  // Signatures table header
  page.drawText('Log history', { x: margin, y: y - 11, size: 11, font: helvBold, color: ink })
  y -= 16
  page.drawText('Time', { x: margin, y: y - 10, size: 9, font: helvBold, color: muted })
  page.drawText('Name', { x: margin + 110, y: y - 10, size: 9, font: helvBold, color: muted })
  page.drawText('Wind', { x: margin + 240, y: y - 10, size: 9, font: helvBold, color: muted })
  page.drawText('Notes', { x: margin + 320, y: y - 10, size: 9, font: helvBold, color: muted })
  y -= 14

  for (const s of data.signatures) {
    if (y < margin + 80) {
      const np = pdf.addPage([595.28, 841.89])
      np.drawText('Anchor Watchkeeper Log — continued', { x: margin, y: np.getHeight() - margin, size: 11, font: helvBold, color: ink })
      y = np.getHeight() - margin - 20
      page = np
    }
    page.drawText(new Date(s.timestamp).toLocaleString(), { x: margin, y: y - 10, size: 8, font: helv, color: ink })
    page.drawText(s.name, { x: margin + 110, y: y - 10, size: 8, font: helvBold, color: ink })
    page.drawText(s.wind || '—', { x: margin + 240, y: y - 10, size: 8, font: helv, color: ink })
    const notes = s.notes || ''
    drawWrapped(page, notes, margin + 320, y - 10, width - 320, helv, 8, ink)
    y -= 14
  }

  // Captain signature footer
  y -= 8
  page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
  y -= 14
  page.drawText('Captain', { x: margin, y, size: 9, font: helvBold, color: muted })
  page.drawText(data.closedBy || '—', { x: margin + 60, y, size: 11, font: helvBold, color: accent })
  if (data.closedAt) {
    page.drawText(new Date(data.closedAt).toLocaleString(), { x: margin + 260, y, size: 9, font: helv, color: muted })
  }

  // Chart track photo on its own page
  if (data.chartTrackPhotoUrl) {
    try {
      const { bytes, mime } = await fetchImageBytes(data.chartTrackPhotoUrl)
      const img = mime.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
      const cp = pdf.addPage([595.28, 841.89])
      cp.drawText('Chart tracks at close', { x: margin, y: cp.getHeight() - margin, size: 13, font: helvBold, color: ink })
      const maxW = cp.getWidth() - margin * 2
      const maxH = cp.getHeight() - margin * 2 - 30
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      cp.drawImage(img, {
        x: margin + (maxW - img.width * ratio) / 2,
        y: margin,
        width: img.width * ratio,
        height: img.height * ratio,
      })
    } catch (e) { console.warn('Chart embed failed', e) }
  }

  // Apply Rise Above branding (logo header, boat footer, page numbers).
  await applyBranding(pdf)
  return await pdf.save()
}

function drawWrapped(page: any, text: string, x: number, y: number, maxW: number, font: any, size: number, color: any): { linesDrawn: number } {
  if (!text) {
    page.drawText('—', { x, y, size, font, color })
    return { linesDrawn: 1 }
  }
  const words = text.split(/\s+/)
  let line = ''
  let drawn = 0
  let curY = y
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i]
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      page.drawText(line, { x, y: curY, size, font, color })
      drawn++
      curY -= size + 2
      line = words[i]
    } else {
      line = test
    }
  }
  if (line) {
    page.drawText(line, { x, y: curY, size, font, color })
    drawn++
  }
  return { linesDrawn: drawn }
}
