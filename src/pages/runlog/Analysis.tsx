import React, { useMemo } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { getRpmAverages, type RpmBand } from '@/lib/api'

type Side = 'port' | 'stbd'

const FIELDS: { key: string; label: string; unit: string; tolPct: number; tolAbs: number }[] = [
  // tolAbs = absolute minimum tolerance to avoid tiny σ producing false alarms
  { key: 'fuel_rate',       label: 'Fuel Rate',        unit: 'L/hr', tolPct: 0.10, tolAbs: 3 },
  { key: 'coolant_temp',    label: 'Coolant Temp',     unit: '°C',   tolPct: 0.05, tolAbs: 3 },
  { key: 'trans_oil_temp',  label: 'Trans Oil Temp',   unit: '°C',   tolPct: 0.08, tolAbs: 3 },
  { key: 'oil_temp',        label: 'Engine Oil Temp',  unit: '°C',   tolPct: 0.05, tolAbs: 3 },
  { key: 'oil_press',       label: 'Engine Oil Press', unit: 'kPa',  tolPct: 0.10, tolAbs: 20 },
  { key: 'trans_oil_press', label: 'Trans Oil Press',  unit: 'kPa',  tolPct: 0.05, tolAbs: 40 },
]

const CHECK_HINTS: Record<string, { high: string; low: string }> = {
  fuel_rate: {
    high: 'Check for fouled hull/prop, extra load (gen or thrusters), fuel filter/injector fault, or air in fuel.',
    low:  'Check throttle/gear engagement, tach signal, or possible sensor drift.',
  },
  coolant_temp: {
    high: 'Check sea-water intake/strainer, coolant level & mix, HX for fouling, thermostat, raw-water pump impeller.',
    low:  'Cold engine (still warming up) or stuck-open thermostat.',
  },
  trans_oil_temp: {
    high: 'Check gearbox oil level, cooler flow, oil condition. Sustained high = investigate before load increase.',
    low:  'Cold gear (warm-up) or sensor issue.',
  },
  oil_temp: {
    high: 'Check oil level & condition, oil cooler flow, load level.',
    low:  'Warm-up in progress or sensor issue.',
  },
  oil_press: {
    high: 'Cold oil is normal; sustained high after warm-up = check regulator or blocked passages.',
    low:  'CRITICAL: check oil level immediately. Also check for dilution, oil grade, sensor fault. Reduce load until confirmed.',
  },
  trans_oil_press: {
    high: 'Check oil level (over-fill) or filter condition.',
    low:  'CRITICAL for gearbox: check oil level, pump, filter. Reduce load until confirmed.',
  },
}

type Status = 'inline' | 'high' | 'low' | 'nobench'

function nearestBand(bands: RpmBand[], rpm: number): RpmBand | null {
  if (!bands.length) return null
  let best = bands[0]
  let bestD = Math.abs(bands[0].rpm - rpm)
  for (const b of bands) {
    const d = Math.abs(b.rpm - rpm)
    if (d < bestD) { best = b; bestD = d }
  }
  return best
}

function classify(actual: number, avg: number | null, sigma: number | null, tolPct: number, tolAbs: number): { status: Status; delta: number; tol: number } {
  if (avg == null) return { status: 'nobench', delta: 0, tol: 0 }
  // Tolerance = max(σ, tolPct*avg, tolAbs). Fall back to abs+pct when σ missing.
  const s = sigma != null && sigma > 0 ? sigma : 0
  const tol = Math.max(s, Math.abs(avg) * tolPct, tolAbs)
  const delta = actual - avg
  if (Math.abs(delta) <= tol) return { status: 'inline', delta, tol }
  return { status: delta > 0 ? 'high' : 'low', delta, tol }
}

function fmt(n: number | null | undefined, unit: string): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Math.round(n * 10) / 10} ${unit}`
}

function StatusPill({ s }: { s: Status }) {
  if (s === 'inline') {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">IN-LINE</span>
  }
  if (s === 'high') {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">ABOVE</span>
  }
  if (s === 'low') {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">BELOW</span>
  }
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10">NO BENCHMARK</span>
}

function SideCard({ side, rpm, values, band }: { side: Side; rpm: number | null; values: Record<string, string>; band: RpmBand | null }) {
  const label = side === 'port' ? 'Port Engine' : 'Starboard Engine'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{label}</h3>
        <div className="text-xs text-muted-foreground">
          {rpm != null ? `${rpm} RPM` : 'RPM not entered'}
          {band != null && rpm != null && band.rpm !== rpm ? ` · nearest band ${band.rpm}` : ''}
        </div>
      </div>
      {rpm == null || band == null ? (
        <p className="text-sm text-muted-foreground">
          {rpm == null ? 'No RPM entered — skipping benchmark comparison.' : 'No benchmark band available.'}
        </p>
      ) : (
        <div className="space-y-2">
          {FIELDS.map(f => {
            const raw = values[`${side}_${f.key}`]
            const actual = raw ? parseFloat(String(raw).replace(',', '.')) : NaN
            const bench = band[side][f.key]
            if (!raw || Number.isNaN(actual)) {
              return null
            }
            const { status, delta, tol } = classify(actual, bench?.avg ?? null, bench?.sigma ?? null, f.tolPct, f.tolAbs)
            const hint = status === 'high' ? CHECK_HINTS[f.key]?.high : status === 'low' ? CHECK_HINTS[f.key]?.low : null
            return (
              <div key={f.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{f.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Reading <span className="text-foreground">{fmt(actual, f.unit)}</span>
                      {bench?.avg != null && (
                        <> · avg <span className="text-foreground">{fmt(bench.avg, f.unit)}</span></>
                      )}
                      {status !== 'nobench' && status !== 'inline' && (
                        <> · <span className={status === 'high' ? 'text-red-400' : 'text-amber-400'}>
                          {delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10} {f.unit}
                        </span> (tol ±{Math.round(tol * 10) / 10})</>
                      )}
                    </div>
                  </div>
                  <StatusPill s={status} />
                </div>
                {hint && (
                  <div className="mt-2 text-xs text-muted-foreground border-t border-white/10 pt-2">
                    <span className="font-semibold text-foreground">Check: </span>{hint}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AnalysisPage() {
  const [, setLocation] = useLocation()
  const values = useMemo<Record<string, string>>(() => {
    try {
      const raw = sessionStorage.getItem('lastRunlog')
      if (!raw) return {}
      return JSON.parse(raw) as Record<string, string>
    } catch {
      return {}
    }
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['rpm-averages'],
    queryFn: getRpmAverages,
    staleTime: 5 * 60 * 1000,
  })

  const portRpm = values.port_rpm ? parseInt(values.port_rpm, 10) : NaN
  const stbdRpm = values.stbd_rpm ? parseInt(values.stbd_rpm, 10) : NaN
  const portBand = data && !Number.isNaN(portRpm) ? nearestBand(data.bands, portRpm) : null
  const stbdBand = data && !Number.isNaN(stbdRpm) ? nearestBand(data.bands, stbdRpm) : null

  const anyEntry = Object.keys(values).length > 0

  return (
    <MenuLayout title="Reading Check" showBack backHref="/runlog/review">
      <div className="space-y-4 pb-4">
        <div>
          <h2 className="text-xl font-bold">Reading Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comparing your readings to the historical averages for the nearest RPM band.
          </p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading RPM benchmarks…</p>}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            Couldn't load RPM averages: {(error as Error).message}
          </div>
        )}
        {!anyEntry && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            No log data found. Please go back and submit a running log entry.
          </div>
        )}

        {data && (
          <>
            <SideCard side="port" rpm={Number.isNaN(portRpm) ? null : portRpm} values={values} band={portBand} />
            <SideCard side="stbd" rpm={Number.isNaN(stbdRpm) ? null : stbdRpm} values={values} band={stbdBand} />
          </>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button className="w-full h-12" onClick={() => setLocation('/runlog/success')}>Continue</Button>
          <Button variant="outline" className="w-full h-12" onClick={() => setLocation('/menu')}>Back to Menu</Button>
        </div>
      </div>
    </MenuLayout>
  )
}
