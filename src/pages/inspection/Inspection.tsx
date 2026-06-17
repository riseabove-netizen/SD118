import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getCrewName } from '@/lib/auth'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import { useGeolocation, formatCoords } from '@/lib/useGeolocation'

// Returns YYYY-MM-DDTHH:mm in local time, suitable for <input type="datetime-local">
function nowLocalIsoMinute(): string {
  const d = new Date()
  const tzOffset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

type Check = { label: string; ok: boolean | null }
type Photo = { label: string; required: boolean; base64: string | null; previewUrl: string | null }

type SectionDraft = {
  title: string
  checks: Check[]
  photos: Photo[]
  comments: string
}

function makeSections(): SectionDraft[] {
  return [
    {
      title: 'Section 1 — Main Control Room',
      checks: [
        { label: 'Control room dry and not too hot', ok: null },
        { label: 'Control panel shows voltage around 400V', ok: null },
        { label: 'No fluids in the bilge', ok: null },
      ],
      photos: [],
      comments: '',
    },
    {
      title: 'Section 2 — Engine Room',
      checks: [
        { label: 'Port engine — no leaks', ok: null },
        { label: 'Starboard engine — no leaks', ok: null },
        { label: 'Generator — no alarms', ok: null },
        { label: 'No leaks on fuel & water manifolds', ok: null },
        { label: 'Center bilge — no increase in fluid level', ok: null },
        { label: 'No leaks in the shafts', ok: null },
        { label: 'No critical vibration in the shafts', ok: null },
      ],
      photos: [
        { label: 'Port engine shaft bilge', required: true, base64: null, previewUrl: null },
        { label: 'Starboard engine shaft bilge', required: true, base64: null, previewUrl: null },
        { label: 'Center bilge', required: true, base64: null, previewUrl: null },
        { label: 'Rudder room', required: true, base64: null, previewUrl: null },
      ],
      comments: '',
    },
    {
      title: 'Section 3 — Port Side Control Room & Rudder Room',
      checks: [
        { label: 'Control room — no fluids in the bilge', ok: null },
        { label: 'No leaks in the hydraulics', ok: null },
        { label: 'No visible leaks in rudder room', ok: null },
      ],
      photos: [
        { label: 'Rudder room', required: true, base64: null, previewUrl: null },
      ],
      comments: '',
    },
  ]
}

export function InspectionPage() {
  const [, setLocation] = useLocation()
  const [sections, setSections] = useState<SectionDraft[]>(makeSections())
  const [generator, setGenerator] = useState<{ running: string; portHours: string; stbdHours: string }>({
    running: '',
    portHours: '',
    stbdHours: '',
  })
  const [dateTime, setDateTime] = useState<string>(nowLocalIsoMinute())
  const [coords, setCoords] = useState<{ lat: string; lon: string; formatted: string }>({
    lat: '',
    lon: '',
    formatted: '',
  })
  const geo = useGeolocation()

  // Auto-fill coordinates from device once GPS resolves (only if user hasn't typed anything)
  useEffect(() => {
    if (geo.position && !coords.lat && !coords.lon) {
      setCoords({
        lat: geo.position.lat.toFixed(6),
        lon: geo.position.lon.toFixed(6),
        formatted: geo.formatted,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position, geo.formatted])

  function refreshCoords() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({
          lat: pos.coords.latitude.toFixed(6),
          lon: pos.coords.longitude.toFixed(6),
          formatted: formatCoords(pos.coords.latitude, pos.coords.longitude),
        })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    )
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ link?: string; id: string } | null>(null)

  function updateCheck(si: number, ci: number, ok: boolean) {
    setSections(prev => prev.map((s, i) =>
      i !== si ? s : { ...s, checks: s.checks.map((c, j) => j === ci ? { ...c, ok } : c) }
    ))
  }

  function updateComments(si: number, comments: string) {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, comments } : s))
  }

  async function handlePhoto(si: number, pi: number, file: File | null) {
    if (!file) return
    try {
      const b64 = await compressImageToJpegBase64(file, { maxDim: 1600, quality: 0.78 })
      const previewUrl = `data:image/jpeg;base64,${b64}`
      setSections(prev => prev.map((s, i) =>
        i !== si ? s : { ...s, photos: s.photos.map((p, j) => j === pi ? { ...p, base64: b64, previewUrl } : p) }
      ))
    } catch (e: any) {
      setError(e?.message || 'Could not load photo')
    }
  }

  function clearPhoto(si: number, pi: number) {
    setSections(prev => prev.map((s, i) =>
      i !== si ? s : { ...s, photos: s.photos.map((p, j) => j === pi ? { ...p, base64: null, previewUrl: null } : p) }
    ))
  }

  function validate(): string | null {
    for (const s of sections) {
      for (const c of s.checks) {
        if (c.ok === null) return `${s.title}: every check must be marked OK or Issue.`
      }
      for (const p of s.photos) {
        if (p.required && !p.base64) return `${s.title}: photo "${p.label}" is required.`
      }
    }
    return null
  }

  async function submit() {
    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      // Build ISO timestamp from the (possibly user-edited) date/time field
      const ts = dateTime ? new Date(dateTime).toISOString() : new Date().toISOString()
      const payload = {
        user: getCrewName() || 'crew',
        timestamp: ts,
        coordinates: {
          lat: coords.lat,
          lon: coords.lon,
          formatted: coords.formatted,
        },
        generator,
        sections: sections.map(s => ({
          title: s.title,
          checks: s.checks.map(c => ({ label: c.label, ok: c.ok === true })),
          photos: s.photos
            .filter(p => p.base64)
            .map(p => ({ label: p.label, base64: p.base64 as string })),
          comments: s.comments,
        })),
      }

      const res = await fetch('/api/inspection-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch {}
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || res.statusText)
      }
      setSuccess({ id: data.inspectionId, link: data.pdfLink })
    } catch (e: any) {
      setError(e?.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <MenuLayout title="Inspection Saved" showBack backHref="/menu">
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/30">
            <div className="text-emerald-400 font-medium mb-1">Inspection submitted</div>
            <div className="text-sm text-muted-foreground">ID: <span className="font-mono">{success.id}</span></div>
          </div>
          {success.link && (
            <a
              href={success.link}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center h-11 leading-[44px] rounded-lg bg-primary text-primary-foreground font-medium"
            >
              View PDF in Google Drive
            </a>
          )}
          <Button variant="secondary" onClick={() => setLocation('/menu')} className="w-full">
            Back to menu
          </Button>
          <Button
            onClick={() => {
              setSuccess(null)
              setSections(makeSections())
              setGenerator({ running: '', portHours: '', stbdHours: '' })
              setDateTime(nowLocalIsoMinute())
              setCoords({ lat: '', lon: '', formatted: '' })
              refreshCoords()
            }}
            className="w-full"
          >
            New Inspection
          </Button>
        </div>
      </MenuLayout>
    )
  }

  return (
    <MenuLayout title="Engine Room Inspection" showBack backHref="/menu">
      <div className="space-y-5">
        {/* Date / Time / Coordinates */}
        <div className="p-3 rounded-xl border border-border bg-card space-y-3">
          <div className="font-medium">Inspection date & location</div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Date & time</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={e => setDateTime(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-muted-foreground">Coordinates</label>
              <button
                type="button"
                onClick={refreshCoords}
                className="text-xs text-primary underline"
              >
                {geo.loading ? 'Locating…' : 'Use device GPS'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={coords.lat}
                onChange={e => setCoords(c => ({ ...c, lat: e.target.value, formatted: '' }))}
                placeholder="Latitude (e.g. 39.5634)"
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
              />
              <input
                type="text"
                inputMode="decimal"
                value={coords.lon}
                onChange={e => setCoords(c => ({ ...c, lon: e.target.value, formatted: '' }))}
                placeholder="Longitude (e.g. 2.6502)"
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
              />
            </div>
            {coords.formatted && (
              <div className="text-xs text-muted-foreground mt-1 font-mono">{coords.formatted}</div>
            )}
            {geo.error && !coords.lat && (
              <div className="text-xs text-amber-400 mt-1">GPS unavailable: {geo.error}. Enter coordinates manually if needed.</div>
            )}
          </div>
        </div>

        {/* Generator block */}
        <div className="p-3 rounded-xl border border-border bg-card space-y-3">
          <div className="font-medium">Generator status</div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Which generator is running?</label>
            <select
              value={generator.running}
              onChange={e => setGenerator(g => ({ ...g, running: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
            >
              <option value="">—</option>
              <option value="Port">Port</option>
              <option value="Starboard">Starboard</option>
              <option value="Both">Both</option>
              <option value="None">None</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Port gen hours</label>
              <input
                type="number"
                inputMode="decimal"
                value={generator.portHours}
                onChange={e => setGenerator(g => ({ ...g, portHours: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">STBD gen hours</label>
              <input
                type="number"
                inputMode="decimal"
                value={generator.stbdHours}
                onChange={e => setGenerator(g => ({ ...g, stbdHours: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg bg-secondary border border-border"
              />
            </div>
          </div>
        </div>

        {sections.map((s, si) => (
          <div key={si} className="p-3 rounded-xl border border-border bg-card space-y-4">
            <div className="font-semibold text-primary">{s.title}</div>

            {/* Checks */}
            <div className="space-y-2">
              {s.checks.map((c, ci) => (
                <div key={ci} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-secondary/40">
                  <div className="text-sm flex-1">{c.label}</div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => updateCheck(si, ci, true)}
                      className={`px-3 h-9 rounded-md text-sm font-medium border ${c.ok === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-card text-muted-foreground border-border'}`}
                    >OK</button>
                    <button
                      onClick={() => updateCheck(si, ci, false)}
                      className={`px-3 h-9 rounded-md text-sm font-medium border ${c.ok === false ? 'bg-red-600 text-white border-red-600' : 'bg-card text-muted-foreground border-border'}`}
                    >Issue</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Photos */}
            {s.photos.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Required photos</div>
                {s.photos.map((p, pi) => (
                  <PhotoSlot
                    key={pi}
                    photo={p}
                    onPick={file => handlePhoto(si, pi, file)}
                    onClear={() => clearPhoto(si, pi)}
                  />
                ))}
              </div>
            )}

            {/* Comments */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Comments</label>
              <textarea
                value={s.comments}
                onChange={e => updateComments(si, e.target.value)}
                rows={2}
                placeholder="Any notes about this section…"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border"
              />
            </div>
          </div>
        ))}

        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30 whitespace-pre-wrap">
            {error}
          </div>
        )}

        <Button onClick={submit} disabled={submitting} className="w-full h-12 text-base">
          {submitting ? 'Submitting…' : 'Submit Inspection'}
        </Button>
      </div>
    </MenuLayout>
  )
}

function PhotoSlot({ photo, onPick, onClear }: { photo: Photo; onPick: (f: File | null) => void; onClear: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libRef = useRef<HTMLInputElement>(null)
  return (
    <div className="p-2 rounded-lg border border-border bg-secondary/30">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-sm">{photo.label}{photo.required && <span className="text-red-500"> *</span>}</div>
        {photo.base64 && (
          <button onClick={onClear} className="text-xs text-red-400 underline">Clear</button>
        )}
      </div>
      {photo.previewUrl ? (
        <img src={photo.previewUrl} alt={photo.label} className="w-full max-h-48 object-cover rounded-md" />
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex-1 h-10 rounded-md bg-card border border-border text-sm"
          >📷 Take photo</button>
          <button
            onClick={() => libRef.current?.click()}
            className="flex-1 h-10 rounded-md bg-card border border-border text-sm"
          >🖼️ Choose</button>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { onPick(e.target.files?.[0] || null); e.target.value = '' }}
      />
      <input
        ref={libRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { onPick(e.target.files?.[0] || null); e.target.value = '' }}
      />
    </div>
  )
}