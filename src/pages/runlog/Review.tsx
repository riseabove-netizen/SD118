import React, { useState, useRef } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { extractFromImages, writeRow } from '@/lib/api'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import { useMutation } from '@tanstack/react-query'
import { formatDate, formatTime } from '@/lib/utils'

// Shared suffix list used by both ENGINE_FIELDS (UI) and MERGE_TARGETS (re-upload).
const ENGINE_FIELDS_LIST = [
  'engine_hours','rpm','fuel_rate','coolant_temp','trans_oil_temp','oil_temp',
  'trans_oil_press','fuel_temp','fuel_pressure','engine_load','coolant_level',
  'battery_voltage','exhaust_temp_l','exhaust_temp_r','inlet_manifold_temp',
] as const

const engineKeys = (prefix: 'port' | 'stbd'): string[] =>
  ENGINE_FIELDS_LIST.map(s => `${prefix}_${s}`)

// Each target maps to a set of field keys in the form.
// User picks which targets the newly-uploaded photos should fill.
const MERGE_TARGETS = [
  { id: 'datetime', label: 'Date / Time', keys: ['date', 'time'] },
  { id: 'nav',      label: 'Navigation (Lat/Lon/COG/SOG)', keys: ['latitude', 'longitude', 'cog', 'sog'] },
  { id: 'port',     label: 'Port Engine',  keys: engineKeys('port') },
  { id: 'stbd',     label: 'Starboard Engine', keys: engineKeys('stbd') },
] as const

// Per-engine fields (rendered once for Port and once for Starboard)
const ENGINE_FIELDS: { suffix: string; label: string; unit?: string }[] = [
  { suffix: 'engine_hours', label: 'Engine Hours', unit: 'hrs' },
  { suffix: 'rpm', label: 'RPM' },
  { suffix: 'fuel_rate', label: 'Fuel Rate', unit: 'L/h' },
  { suffix: 'coolant_temp', label: 'Coolant Temp', unit: '°C' },
  { suffix: 'trans_oil_temp', label: 'Transmission Oil Temp', unit: '°C' },
  { suffix: 'oil_temp', label: 'Engine Oil Temp', unit: '°C' },
  { suffix: 'trans_oil_press', label: 'Trans Oil Pressure', unit: 'kPa' },
  { suffix: 'fuel_temp', label: 'Fuel Temp', unit: '°C' },
  { suffix: 'fuel_pressure', label: 'Fuel Pressure', unit: 'kPa' },
  { suffix: 'engine_load', label: 'Engine Load', unit: '%' },
  { suffix: 'coolant_level', label: 'Coolant Level' },
  { suffix: 'battery_voltage', label: 'ECU Batt Voltage', unit: 'V' },
  { suffix: 'exhaust_temp_l', label: 'Exhaust Temp Left', unit: '°C' },
  { suffix: 'exhaust_temp_r', label: 'Exhaust Temp Right', unit: '°C' },
  { suffix: 'inlet_manifold_temp', label: 'Inlet Manifold Temp', unit: '°C' },
]

const ENTRY_TYPES = [
  { value: '', label: 'Running (default)' },
  { value: 'Bunkering', label: 'Bunkering' },
  { value: 'Departure', label: 'Departure' },
  { value: 'Arrival', label: 'Arrival' },
]

const GEN_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'none', label: 'None running' },
  { value: 'port', label: 'Port only' },
  { value: 'starboard', label: 'Starboard only' },
  { value: 'both', label: 'Both' },
]

type FormValues = Record<string, string>

export function ReviewPage() {
  const [, setLocation] = useLocation()
  const [values, setValues] = useState<FormValues>(() => {
    // Date / time and lat/lon are read from the photos by the AI —
    // we intentionally do NOT default them to the device's clock/GPS.
    const defaults: FormValues = {
      date: '',
      time: '',
      entry_type: '',
      gen_running: '',
      fuel_daily: '',
      fuel_aft: '',
      fuel_fwd: '',
      gen_port_hours: '',
      gen_stbd_hours: '',
      latitude: '',
      longitude: '',
      cog: '',
      sog: '',
      notes: '',
      comments: '',
      wind: '',
      sea_conditions: '',
    }

    // Pull any AI-extracted values
    const raw = sessionStorage.getItem('extractedData')
    if (raw) {
      try {
        const extracted = JSON.parse(raw) as Record<string, unknown>
        for (const section of Object.values(extracted)) {
          if (section && typeof section === 'object') {
            for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
              if (typeof v === 'string' || typeof v === 'number') {
                defaults[k] = String(v)
              }
            }
          }
        }
        for (const [k, v] of Object.entries(extracted)) {
          if (typeof v === 'string' || typeof v === 'number') {
            defaults[k] = String(v)
          }
        }
      } catch {
        // ignore
      }
    }
    return defaults
  })

  const mutation = useMutation({
    mutationFn: () => writeRow(values),
    onSuccess: () => {
      sessionStorage.removeItem('extractedData')
      setLocation('/runlog/success')
    },
  })

  // —————————— Re-upload: add more photos & merge ——————————
  const [moreFiles, setMoreFiles] = useState<File[]>([])
  const [mergeTargets, setMergeTargets] = useState<string[]>(['port', 'stbd'])
  const moreCameraRef = useRef<HTMLInputElement>(null)
  const moreLibraryRef = useRef<HTMLInputElement>(null)

  const toggleTarget = (id: string) =>
    setMergeTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addMoreFiles = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return
    setMoreFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  const removeMoreFile = (idx: number) =>
    setMoreFiles(prev => prev.filter((_, i) => i !== idx))

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const images: string[] = []
      for (const file of moreFiles) {
        const b64 = await compressImageToJpegBase64(file, { maxDim: 1600, quality: 0.82 })
        images.push(b64)
      }
      return extractFromImages(images)
    },
    onSuccess: (data: Record<string, unknown>) => {
      // Flatten the AI response (it nests under date_time / navigation / port_engine / stbd_engine)
      const flat: Record<string, string> = {}
      for (const section of Object.values(data)) {
        if (section && typeof section === 'object') {
          for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
            if (typeof v === 'string' || typeof v === 'number') flat[k] = String(v)
          }
        }
      }
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'string' || typeof v === 'number') flat[k] = String(v)
      }

      // Only write keys belonging to the selected merge targets,
      // and only when the AI actually returned a non-empty value.
      const allowedKeys = new Set<string>()
      for (const t of MERGE_TARGETS) {
        if (mergeTargets.includes(t.id)) {
          for (const k of t.keys) allowedKeys.add(k)
        }
      }

      setValues(prev => {
        const next = { ...prev }
        for (const k of allowedKeys) {
          const v = flat[k]
          if (v !== undefined && v !== null && v !== '') next[k] = v
        }
        return next
      })
      setMoreFiles([])
    },
  })
  // —————————— end re-upload ——————————

  const set = (key: string, val: string) =>
    setValues(prev => ({ ...prev, [key]: val }))

  const renderEngineSection = (prefix: 'port' | 'stbd', title: string) => (
    <div key={prefix} className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
        {title}
      </h3>
      <div className="space-y-3">
        {ENGINE_FIELDS.map(f => {
          const key = `${prefix}_${f.suffix}`
          const label = f.unit ? `${f.label} [${f.unit}]` : f.label
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="text"
                value={values[key] || ''}
                onChange={e => set(key, e.target.value)}
                placeholder="—"
              />
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <MenuLayout title="Review & Save" showBack backHref="/runlog/upload">
      <div className="space-y-6 pb-8">
        <div>
          <h2 className="text-xl font-bold">Running Log</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Check and edit values before saving.
          </p>
        </div>

        {/* Add more photos & merge */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider">Add more photos</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Upload extra engine / nav screen photos and pick which sections they should fill.
              Empty fields will be filled; existing values overwrite only when the AI reads a new value.
            </p>
          </div>

          <input
            ref={moreCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e => { addMoreFiles(e.target.files); e.target.value = '' }}
            className="hidden"
          />
          <input
            ref={moreLibraryRef}
            type="file"
            accept="image/*"
            multiple
            onChange={e => { addMoreFiles(e.target.files); e.target.value = '' }}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={() => moreCameraRef.current?.click()} className="h-11">
              Take Photo
            </Button>
            <Button type="button" variant="outline" onClick={() => moreLibraryRef.current?.click()} className="h-11">
              Choose Photos
            </Button>
          </div>

          {moreFiles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {moreFiles.length} file{moreFiles.length > 1 ? 's' : ''} ready
              </p>
              {moreFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border border-border px-2 py-1.5">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => removeMoreFile(i)}
                    className="text-muted-foreground hover:text-destructive px-1"
                    aria-label="Remove"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Fill these sections from new photos:</p>
            <div className="grid grid-cols-2 gap-2">
              {MERGE_TARGETS.map(t => {
                const checked = mergeTargets.includes(t.id)
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                      checked ? 'border-primary bg-primary/10' : 'border-border bg-background'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTarget(t.id)}
                      className="accent-primary"
                    />
                    <span>{t.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {mergeMutation.isError && (
            <p className="text-xs text-destructive">
              {mergeMutation.error instanceof Error ? mergeMutation.error.message : 'Extraction failed.'}
            </p>
          )}

          <Button
            type="button"
            onClick={() => mergeMutation.mutate()}
            disabled={moreFiles.length === 0 || mergeTargets.length === 0 || mergeMutation.isPending}
            className="w-full h-11"
          >
            {mergeMutation.isPending ? 'Extracting…' : 'Extract & Merge'}
          </Button>
        </div>

        {/* Date / Time */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
            Date / Time
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={values.date || ''} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={values.time || ''} onChange={e => set('time', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="entry_type">Entry Type</Label>
            <select
              id="entry_type"
              value={values.entry_type || ''}
              onChange={e => set('entry_type', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {ENTRY_TYPES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fuel Tanks */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
            Fuel Tanks
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fuel_daily">Daily [L]</Label>
              <Input id="fuel_daily" type="text" inputMode="decimal" value={values.fuel_daily || ''} onChange={e => set('fuel_daily', e.target.value)} placeholder="L" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fuel_aft">Aft Main [L]</Label>
              <Input id="fuel_aft" type="text" inputMode="decimal" value={values.fuel_aft || ''} onChange={e => set('fuel_aft', e.target.value)} placeholder="L" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fuel_fwd">FWD Main [L]</Label>
              <Input id="fuel_fwd" type="text" inputMode="decimal" value={values.fuel_fwd || ''} onChange={e => set('fuel_fwd', e.target.value)} placeholder="L" />
            </div>
          </div>
        </div>

        {/* Generators */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
            Generators
          </h3>
          <div className="space-y-1">
            <Label htmlFor="gen_running">Which generator is running?</Label>
            <select
              id="gen_running"
              value={values.gen_running || ''}
              onChange={e => set('gen_running', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {GEN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="gen_port_hours">Port Gen Hours</Label>
              <Input
                id="gen_port_hours"
                type="text"
                inputMode="decimal"
                value={values.gen_port_hours || ''}
                onChange={e => set('gen_port_hours', e.target.value)}
                placeholder="hrs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gen_stbd_hours">STBD Gen Hours</Label>
              <Input
                id="gen_stbd_hours"
                type="text"
                inputMode="decimal"
                value={values.gen_stbd_hours || ''}
                onChange={e => set('gen_stbd_hours', e.target.value)}
                placeholder="hrs"
              />
            </div>
          </div>
        </div>

        {/* Position & Navigation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
            Position & Navigation
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="text"
                inputMode="decimal"
                value={values.latitude || ''}
                onChange={e => set('latitude', e.target.value)}
                placeholder="from nav screen"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="text"
                inputMode="decimal"
                value={values.longitude || ''}
                onChange={e => set('longitude', e.target.value)}
                placeholder="from nav screen"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cog">COG [°]</Label>
              <Input
                id="cog"
                type="text"
                inputMode="decimal"
                value={values.cog || ''}
                onChange={e => set('cog', e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sog">SOG [kn]</Label>
              <Input
                id="sog"
                type="text"
                inputMode="decimal"
                value={values.sog || ''}
                onChange={e => set('sog', e.target.value)}
                placeholder="—"
              />
            </div>
          </div>
        </div>

        {/* Engines */}
        {renderEngineSection('port', 'Port Engine')}
        {renderEngineSection('stbd', 'Starboard Engine')}

        {/* Conditions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
            Conditions
          </h3>
          <div className="space-y-1">
            <Label htmlFor="wind">Wind</Label>
            <Input
              id="wind"
              type="text"
              value={values.wind || ''}
              onChange={e => set('wind', e.target.value)}
              placeholder="SW 5kts"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sea_conditions">Sea Conditions</Label>
            <Input
              id="sea_conditions"
              type="text"
              value={values.sea_conditions || ''}
              onChange={e => set('sea_conditions', e.target.value)}
              placeholder="following seas 0.6m, short period"
            />
          </div>
        </div>

        {/* Comments */}
        <div className="space-y-2">
          <Label htmlFor="comments">Comments</Label>
          <Textarea
            id="comments"
            value={values.comments || ''}
            onChange={e => set('comments', e.target.value)}
            placeholder="Watch comments, observations, events…"
            className="min-h-[100px]"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : 'Save failed. Please try again.'}
          </p>
        )}

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full h-14 text-base"
        >
          {mutation.isPending ? 'Saving…' : 'Save to Log'}
        </Button>
      </div>
    </MenuLayout>
  )
}