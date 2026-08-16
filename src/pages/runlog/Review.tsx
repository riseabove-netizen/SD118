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
import { EngineTable } from '@/components/EngineTable'

// Shared suffix list used by both ENGINE_FIELDS (UI) and MERGE_TARGETS (re-upload).
const ENGINE_FIELDS_LIST = [
  'engine_hours','rpm','fuel_rate','coolant_temp','trans_oil_temp','oil_temp',
  'oil_press','trans_oil_press','fuel_temp','fuel_pressure','engine_load','coolant_level',
  'battery_voltage','exhaust_temp_l','exhaust_temp_r','inlet_manifold_temp',
] as const

const engineKeys = (prefix: 'port' | 'stbd'): string[] =>
  ENGINE_FIELDS_LIST.map(s => `${prefix}_${s}`)

// Field labels used by the re-upload picker so the user can choose
// individual missing fields (e.g. "Exhaust Temp Right Port" only).
const ENGINE_FIELD_LABELS: Record<string, string> = {
  engine_hours: 'Engine Hours',
  rpm: 'RPM',
  fuel_rate: 'Fuel Rate',
  coolant_temp: 'Coolant Temp',
  trans_oil_temp: 'Trans Oil Temp',
  oil_temp: 'Engine Oil Temp',
  oil_press: 'Engine Oil Pressure',
  trans_oil_press: 'Trans Oil Pressure',
  fuel_temp: 'Fuel Temp',
  fuel_pressure: 'Fuel Pressure',
  engine_load: 'Engine Load',
  coolant_level: 'Coolant Level',
  battery_voltage: 'Batt Voltage',
  exhaust_temp_l: 'Exhaust Temp Left',
  exhaust_temp_r: 'Exhaust Temp Right',
  inlet_manifold_temp: 'Inlet Manifold Temp',
}

type FieldDef = { key: string; label: string }
type FieldGroup = { id: string; label: string; fields: FieldDef[] }

const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'datetime', label: 'Date / Time',
    fields: [{ key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }],
  },
  {
    id: 'nav', label: 'Navigation',
    fields: [
      { key: 'latitude',  label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      { key: 'cog',       label: 'COG' },
      { key: 'sog',       label: 'SOG' },
    ],
  },
  {
    id: 'tanks', label: 'Fuel Tanks',
    fields: [
      { key: 'fuel_daily', label: 'Daily Tank' },
      { key: 'fuel_aft',   label: 'Aft Main Tank' },
      { key: 'fuel_fwd',   label: 'FWD Main Tank' },
    ],
  },
  {
    id: 'port', label: 'Port Engine',
    fields: ENGINE_FIELDS_LIST.map(s => ({ key: `port_${s}`, label: ENGINE_FIELD_LABELS[s] || s })),
  },
  {
    id: 'stbd', label: 'Starboard Engine',
    fields: ENGINE_FIELDS_LIST.map(s => ({ key: `stbd_${s}`, label: ENGINE_FIELD_LABELS[s] || s })),
  },
]

const ALL_MERGEABLE_KEYS: string[] = FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key))

// Per-engine fields (rendered once for Port and once for Starboard)
const ENGINE_FIELDS: { suffix: string; label: string; unit?: string }[] = [
  { suffix: 'engine_hours', label: 'Engine Hours', unit: 'hrs' },
  { suffix: 'rpm', label: 'RPM' },
  { suffix: 'fuel_rate', label: 'Fuel Rate', unit: 'L/h' },
  { suffix: 'coolant_temp', label: 'Coolant Temp', unit: '°C' },
  { suffix: 'trans_oil_temp', label: 'Transmission Oil Temp', unit: '°C' },
  { suffix: 'oil_temp', label: 'Engine Oil Temp', unit: '°C' },
  { suffix: 'oil_press', label: 'Engine Oil Pressure', unit: 'kPa' },
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
  // Populated in the useState initializer below — tracks how many photos were
  // sent to Claude and how many fields it returned, so the crew can tell when
  // the AI came back empty vs. actually populated the form.
  const [extractInfo, setExtractInfo] = useState<{
    imagesProcessed: number | null
    fieldsFilled: number
    fieldsTotal: number
  } | null>(null)
  // Raw AI response for on-device debugging (previous session or last extract).
  // Kept inside a collapsed panel — surfaces silent-null / wrong-key issues.
  const [rawExtract, setRawExtract] = useState<string>('')
  const [rawOpen, setRawOpen] = useState(false)
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
      // Keep raw payload around so the crew can inspect it if fields don't populate.
      setTimeout(() => setRawExtract(raw), 0)
      try {
        const extracted = JSON.parse(raw) as Record<string, unknown>
        let filled = 0
        for (const [sectionKey, section] of Object.entries(extracted)) {
          if (sectionKey === '_meta') continue
          if (section && typeof section === 'object') {
            for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
              if (typeof v === 'string' || typeof v === 'number') {
                defaults[k] = String(v)
                filled++
              }
            }
          }
        }
        for (const [k, v] of Object.entries(extracted)) {
          if (k === '_meta') continue
          if (typeof v === 'string' || typeof v === 'number') {
            defaults[k] = String(v)
            filled++
          }
        }
        const meta = (extracted as any)._meta
        // Defer setState to next tick — useState initializer can't call setState
        setTimeout(() => setExtractInfo({
          imagesProcessed: typeof meta?.images_processed === 'number' ? meta.images_processed : null,
          fieldsFilled: filled,
          fieldsTotal: ALL_MERGEABLE_KEYS.length,
        }), 0)
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
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreFiles, setMoreFiles] = useState<File[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [imagesProcessed, setImagesProcessed] = useState<number | null>(null)
  const moreCameraRef = useRef<HTMLInputElement>(null)
  const moreLibraryRef = useRef<HTMLInputElement>(null)

  const toggleKey = (key: string) =>
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })

  const toggleGroup = (groupId: string) => {
    const grp = FIELD_GROUPS.find(g => g.id === groupId)
    if (!grp) return
    const groupKeys = grp.fields.map(f => f.key)
    const allOn = groupKeys.every(k => selectedKeys.has(k))
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (allOn) groupKeys.forEach(k => next.delete(k))
      else groupKeys.forEach(k => next.add(k))
      return next
    })
  }

  const toggleGroupOpen = (groupId: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
      return next
    })

  const selectMissing = () => {
    const missing = ALL_MERGEABLE_KEYS.filter(k => !values[k] || values[k] === '')
    setSelectedKeys(new Set(missing))
    const groups = new Set<string>()
    for (const g of FIELD_GROUPS) {
      if (g.fields.some(f => missing.includes(f.key))) groups.add(g.id)
    }
    setOpenGroups(groups)
  }

  const clearSelection = () => setSelectedKeys(new Set())

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
      // Capture image-count debug echo from server
      const meta = (data as any)._meta
      if (meta && typeof meta === 'object') {
        setImagesProcessed(typeof meta.images_processed === 'number' ? meta.images_processed : null)
      }

      // Flatten the AI response (nested under date_time / navigation / fuel_tanks / port_engine / stbd_engine)
      const flat: Record<string, string> = {}
      for (const [sectionKey, section] of Object.entries(data)) {
        if (sectionKey === '_meta') continue
        if (section && typeof section === 'object') {
          for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
            if (typeof v === 'string' || typeof v === 'number') flat[k] = String(v)
          }
        }
      }
      for (const [k, v] of Object.entries(data)) {
        if (k === '_meta') continue
        if (typeof v === 'string' || typeof v === 'number') flat[k] = String(v)
      }

      // Merge ONLY the user-selected individual fields
      setValues(prev => {
        const next = { ...prev }
        selectedKeys.forEach(k => {
          const v = flat[k]
          if (v !== undefined && v !== null && v !== '') next[k] = v
        })
        return next
      })
      setMoreFiles([])
      setSelectedKeys(new Set())
    },
  })
  // —————————— end re-upload ——————————

  const set = (key: string, val: string) =>
    setValues(prev => ({ ...prev, [key]: val }))

  // Show a field only when empty. Filled fields are surfaced in a compact
  // "captured" chip strip at the top of each section so the crew can still
  // spot-check and tap-to-edit.
  const isEmpty = (k: string) => !values[k] || String(values[k]).trim() === ''

  const [editKey, setEditKey] = useState<string | null>(null)

  const FILLED_LABELS: Record<string, string> = {
    date: 'Date', time: 'Time', entry_type: 'Type',
    fuel_daily: 'Daily', fuel_aft: 'Aft', fuel_fwd: 'FWD',
    gen_running: 'Gen', gen_port_hours: 'Port Gen hrs', gen_stbd_hours: 'STBD Gen hrs',
    latitude: 'Lat', longitude: 'Lon', cog: 'COG', sog: 'SOG',
    wind: 'Wind', sea_conditions: 'Sea',
  }

  const FilledChip = ({ k }: { k: string }) => (
    <button
      type="button"
      onClick={() => setEditKey(k)}
      className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-2 py-0.5 hover:border-emerald-400"
    >
      <span className="font-semibold">{FILLED_LABELS[k] || k}</span>
      <span className="text-emerald-100">{values[k]}</span>
    </button>
  )

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

        {/* Raw AI response — debug panel for when fields don't populate.
            Collapsed by default; opens on tap. Always visible if there IS a raw payload. */}
        {rawExtract && (
          <div className="rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setRawOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs"
              aria-expanded={rawOpen}
            >
              <span className="font-medium text-muted-foreground">
                Debug: raw AI response ({rawExtract.length.toLocaleString()} chars)
              </span>
              <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${rawOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {rawOpen && (
              <div className="px-3 pb-3 border-t border-border">
                <pre className="text-[10px] leading-tight whitespace-pre-wrap break-all bg-background rounded p-2 mt-2 max-h-64 overflow-auto font-mono">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(rawExtract), null, 2)
                    } catch {
                      return rawExtract
                    }
                  })()}
                </pre>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(rawExtract).catch(() => {}) }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Copy to clipboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* AI extraction summary — helps the crew tell empty responses apart
            from populated ones (previously silent when the AI returned all nulls).
            If Claude explicitly refused / didn't return JSON, show his reply so
            we can debug the photo without having to open the raw panel. */}
        {(() => {
          try {
            const parsed = rawExtract ? JSON.parse(rawExtract) : null
            const meta = parsed?._meta
            const parseError = meta?.parse_error
            const claudeReply = meta?.claude_reply
            if (parseError && claudeReply) {
              return (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5">
                  <p className="text-sm font-semibold text-destructive">Claude returned no data</p>
                  <p className="mt-1 text-xs text-destructive/90">{parseError}</p>
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">Claude's reply (first 400 chars):</p>
                  <p className="mt-1 text-[11px] text-foreground/80 whitespace-pre-wrap break-words bg-background/50 rounded p-2 max-h-40 overflow-auto">
                    {String(claudeReply).slice(0, 400)}
                  </p>
                </div>
              )
            }
          } catch {}
          return null
        })()}

        {extractInfo && (extractInfo.imagesProcessed !== null || extractInfo.fieldsFilled > 0) && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              extractInfo.fieldsFilled === 0
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-primary/30 bg-primary/10 text-primary'
            }`}
          >
            {extractInfo.fieldsFilled === 0 ? (
              <>
                <span className="font-semibold">AI could not read any values</span> from
                {' '}{extractInfo.imagesProcessed ?? '?'} photo{extractInfo.imagesProcessed === 1 ? '' : 's'}.
                Try re-uploading clearer, closer shots of the gauge screens, or fill the form manually.
              </>
            ) : (
              <>
                AI populated <span className="font-semibold">{extractInfo.fieldsFilled}</span> of {extractInfo.fieldsTotal} fields
                from {extractInfo.imagesProcessed ?? '?'} photo{extractInfo.imagesProcessed === 1 ? '' : 's'}.
              </>
            )}
          </div>
        )}

        {/* Add more photos & merge — collapsed by default, expands on click */}
        <div className="rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            aria-expanded={moreOpen}
          >
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span className="text-sm font-semibold uppercase tracking-wider">Add more photos</span>
              {selectedKeys.size > 0 && (
                <span className="text-xs rounded-full bg-primary/20 text-primary px-2 py-0.5">{selectedKeys.size} field{selectedKeys.size > 1 ? 's' : ''}</span>
              )}
            </div>
            <svg viewBox="0 0 24 24" className={`w-4 h-4 text-muted-foreground transition-transform ${moreOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {moreOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Pick the exact fields you want the AI to fill, then upload photos of those gauges.
              </p>

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

              {/* Field picker — collapsible groups with per-field checkboxes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Fields to fill:</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectMissing} className="text-xs text-primary hover:underline">
                      All missing
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button type="button" onClick={clearSelection} className="text-xs text-muted-foreground hover:underline">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-md border border-border overflow-hidden">
                  {FIELD_GROUPS.map(g => {
                    const groupKeys = g.fields.map(f => f.key)
                    const selectedInGroup = groupKeys.filter(k => selectedKeys.has(k)).length
                    const totalInGroup = groupKeys.length
                    const allOn = selectedInGroup === totalInGroup
                    const expanded = openGroups.has(g.id)
                    return (
                      <div key={g.id} className="bg-background">
                        <div className="flex items-center px-3 py-2 hover:bg-card/50">
                          <label className="flex items-center gap-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allOn}
                              ref={el => { if (el) el.indeterminate = selectedInGroup > 0 && !allOn }}
                              onChange={() => toggleGroup(g.id)}
                              className="accent-primary"
                            />
                            <span className="text-sm font-medium">{g.label}</span>
                            {selectedInGroup > 0 && (
                              <span className="text-xs text-muted-foreground">({selectedInGroup}/{totalInGroup})</span>
                            )}
                          </label>
                          <button
                            type="button"
                            onClick={() => toggleGroupOpen(g.id)}
                            className="text-muted-foreground hover:text-foreground px-2"
                            aria-label={expanded ? 'Collapse' : 'Expand'}
                          >
                            <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                        </div>
                        {expanded && (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-3 pt-1 border-t border-border bg-card/30">
                            {g.fields.map(f => {
                              const checked = selectedKeys.has(f.key)
                              const hasValue = !!values[f.key]
                              return (
                                <label
                                  key={f.key}
                                  className={`flex items-center gap-2 text-xs py-1 cursor-pointer ${
                                    hasValue ? 'text-muted-foreground' : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleKey(f.key)}
                                    className="accent-primary"
                                  />
                                  <span>{f.label}</span>
                                  {hasValue && <span className="text-[10px] text-muted-foreground/70">(filled)</span>}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Upload buttons */}
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
                    {moreFiles.length} photo{moreFiles.length > 1 ? 's' : ''} ready
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

              {mergeMutation.isError && (
                <p className="text-xs text-destructive">
                  {mergeMutation.error instanceof Error ? mergeMutation.error.message : 'Extraction failed.'}
                </p>
              )}

              {imagesProcessed !== null && (
                <p className="text-xs text-muted-foreground">
                  Last run: AI processed {imagesProcessed} photo{imagesProcessed !== 1 ? 's' : ''}.
                </p>
              )}

              <Button
                type="button"
                onClick={() => mergeMutation.mutate()}
                disabled={moreFiles.length === 0 || selectedKeys.size === 0 || mergeMutation.isPending}
                className="w-full h-11"
              >
                {mergeMutation.isPending ? 'Extracting…' : `Extract & Fill ${selectedKeys.size} Field${selectedKeys.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>

        {/* Date / Time */}
        {(() => {
          const keys = ['date','time','entry_type']
          const missing = keys.filter(isEmpty).filter(k => editKey !== k || !isEmpty(k))
          const showEdit = (k: string) => editKey === k || isEmpty(k)
          const anyRender = keys.some(showEdit) || keys.some(k => !isEmpty(k))
          if (!anyRender) return null
          return (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Date / Time</h3>
              <div className="flex flex-wrap gap-1.5">
                {keys.filter(k => !isEmpty(k) && editKey !== k).map(k => <FilledChip key={k} k={k} />)}
              </div>
            </div>
            {(showEdit('date') || showEdit('time')) && (
              <div className="grid grid-cols-2 gap-3">
                {showEdit('date') && (
                  <div className="space-y-1">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" value={values.date || ''} onChange={e => set('date', e.target.value)} onBlur={() => setEditKey(null)} />
                  </div>
                )}
                {showEdit('time') && (
                  <div className="space-y-1">
                    <Label htmlFor="time">Time</Label>
                    <Input id="time" type="time" value={values.time || ''} onChange={e => set('time', e.target.value)} onBlur={() => setEditKey(null)} />
                  </div>
                )}
              </div>
            )}
            {showEdit('entry_type') && (
              <div className="space-y-1">
                <Label htmlFor="entry_type">Entry Type</Label>
                <select
                  id="entry_type"
                  value={values.entry_type || ''}
                  onChange={e => set('entry_type', e.target.value)}
                  onBlur={() => setEditKey(null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {ENTRY_TYPES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          )
        })()}

        {/* Fuel Tanks */}
        {(() => {
          const keys = ['fuel_daily','fuel_aft','fuel_fwd']
          const showEdit = (k: string) => editKey === k || isEmpty(k)
          const filled = keys.filter(k => !isEmpty(k) && editKey !== k)
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fuel Tanks</h3>
                <div className="flex flex-wrap gap-1.5">
                  {filled.map(k => <FilledChip key={k} k={k} />)}
                </div>
              </div>
              {keys.some(showEdit) && (
                <div className="grid grid-cols-3 gap-3">
                  {showEdit('fuel_daily') && (
                    <div className="space-y-1">
                      <Label htmlFor="fuel_daily">Daily [L]</Label>
                      <Input id="fuel_daily" type="text" inputMode="decimal" value={values.fuel_daily || ''} onChange={e => set('fuel_daily', e.target.value)} onBlur={() => setEditKey(null)} placeholder="L" />
                    </div>
                  )}
                  {showEdit('fuel_aft') && (
                    <div className="space-y-1">
                      <Label htmlFor="fuel_aft">Aft Main [L]</Label>
                      <Input id="fuel_aft" type="text" inputMode="decimal" value={values.fuel_aft || ''} onChange={e => set('fuel_aft', e.target.value)} onBlur={() => setEditKey(null)} placeholder="L" />
                    </div>
                  )}
                  {showEdit('fuel_fwd') && (
                    <div className="space-y-1">
                      <Label htmlFor="fuel_fwd">FWD Main [L]</Label>
                      <Input id="fuel_fwd" type="text" inputMode="decimal" value={values.fuel_fwd || ''} onChange={e => set('fuel_fwd', e.target.value)} onBlur={() => setEditKey(null)} placeholder="L" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Generators */}
        {(() => {
          const keys = ['gen_running','gen_port_hours','gen_stbd_hours']
          const showEdit = (k: string) => editKey === k || isEmpty(k)
          const filled = keys.filter(k => !isEmpty(k) && editKey !== k)
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Generators</h3>
                <div className="flex flex-wrap gap-1.5">
                  {filled.map(k => <FilledChip key={k} k={k} />)}
                </div>
              </div>
              {showEdit('gen_running') && (
                <div className="space-y-1">
                  <Label htmlFor="gen_running">Which generator is running?</Label>
                  <select
                    id="gen_running"
                    value={values.gen_running || ''}
                    onChange={e => set('gen_running', e.target.value)}
                    onBlur={() => setEditKey(null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {GEN_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {(showEdit('gen_port_hours') || showEdit('gen_stbd_hours')) && (
                <div className="grid grid-cols-2 gap-3">
                  {showEdit('gen_port_hours') && (
                    <div className="space-y-1">
                      <Label htmlFor="gen_port_hours">Port Gen Hours</Label>
                      <Input id="gen_port_hours" type="text" inputMode="decimal" value={values.gen_port_hours || ''} onChange={e => set('gen_port_hours', e.target.value)} onBlur={() => setEditKey(null)} placeholder="hrs" />
                    </div>
                  )}
                  {showEdit('gen_stbd_hours') && (
                    <div className="space-y-1">
                      <Label htmlFor="gen_stbd_hours">STBD Gen Hours</Label>
                      <Input id="gen_stbd_hours" type="text" inputMode="decimal" value={values.gen_stbd_hours || ''} onChange={e => set('gen_stbd_hours', e.target.value)} onBlur={() => setEditKey(null)} placeholder="hrs" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Position & Navigation */}
        {(() => {
          const keys = ['latitude','longitude','cog','sog']
          const showEdit = (k: string) => editKey === k || isEmpty(k)
          const filled = keys.filter(k => !isEmpty(k) && editKey !== k)
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Position & Navigation</h3>
                <div className="flex flex-wrap gap-1.5">
                  {filled.map(k => <FilledChip key={k} k={k} />)}
                </div>
              </div>
              {(showEdit('latitude') || showEdit('longitude')) && (
                <div className="grid grid-cols-2 gap-3">
                  {showEdit('latitude') && (
                    <div className="space-y-1">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input id="latitude" type="text" inputMode="decimal" value={values.latitude || ''} onChange={e => set('latitude', e.target.value)} onBlur={() => setEditKey(null)} placeholder="from nav screen" />
                    </div>
                  )}
                  {showEdit('longitude') && (
                    <div className="space-y-1">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input id="longitude" type="text" inputMode="decimal" value={values.longitude || ''} onChange={e => set('longitude', e.target.value)} onBlur={() => setEditKey(null)} placeholder="from nav screen" />
                    </div>
                  )}
                </div>
              )}
              {(showEdit('cog') || showEdit('sog')) && (
                <div className="grid grid-cols-2 gap-3">
                  {showEdit('cog') && (
                    <div className="space-y-1">
                      <Label htmlFor="cog">COG [°]</Label>
                      <Input id="cog" type="text" inputMode="decimal" value={values.cog || ''} onChange={e => set('cog', e.target.value)} onBlur={() => setEditKey(null)} placeholder="—" />
                    </div>
                  )}
                  {showEdit('sog') && (
                    <div className="space-y-1">
                      <Label htmlFor="sog">SOG [kn]</Label>
                      <Input id="sog" type="text" inputMode="decimal" value={values.sog || ''} onChange={e => set('sog', e.target.value)} onBlur={() => setEditKey(null)} placeholder="—" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Engines — single editable comparison table (Port | STBD | Avg) */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
            Engines
          </h3>
          <EngineTable values={values} onChange={set} />
        </div>

        {/* Conditions */}
        {(() => {
          const keys = ['wind','sea_conditions']
          const showEdit = (k: string) => editKey === k || isEmpty(k)
          const filled = keys.filter(k => !isEmpty(k) && editKey !== k)
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Conditions</h3>
                <div className="flex flex-wrap gap-1.5">
                  {filled.map(k => <FilledChip key={k} k={k} />)}
                </div>
              </div>
              {showEdit('wind') && (
                <div className="space-y-1">
                  <Label htmlFor="wind">Wind</Label>
                  <Input id="wind" type="text" value={values.wind || ''} onChange={e => set('wind', e.target.value)} onBlur={() => setEditKey(null)} placeholder="SW 5kts" />
                </div>
              )}
              {showEdit('sea_conditions') && (
                <div className="space-y-1">
                  <Label htmlFor="sea_conditions">Sea Conditions</Label>
                  <Input id="sea_conditions" type="text" value={values.sea_conditions || ''} onChange={e => set('sea_conditions', e.target.value)} onBlur={() => setEditKey(null)} placeholder="following seas 0.6m, short period" />
                </div>
              )}
            </div>
          )
        })()}

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