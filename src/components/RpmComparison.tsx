import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRpmAverages, type RpmBand } from '@/lib/api'

type Side = 'port' | 'stbd'

type Field = { key: string; label: string; unit: string; tolPct: number; tolAbs: number; digits?: number }

const FIELDS: Field[] = [
  { key: 'fuel_rate',           label: 'Fuel Rate',        unit: 'L/hr', tolPct: 0.10, tolAbs: 3 },
  { key: 'coolant_temp',        label: 'Coolant Temp',     unit: '°C',   tolPct: 0.05, tolAbs: 3 },
  { key: 'trans_oil_temp',      label: 'Trans Oil Temp',   unit: '°C',   tolPct: 0.08, tolAbs: 3 },
  { key: 'oil_temp',            label: 'Engine Oil Temp',  unit: '°C',   tolPct: 0.05, tolAbs: 3 },
  { key: 'oil_press',           label: 'Engine Oil Press', unit: 'kPa',  tolPct: 0.10, tolAbs: 20 },
  { key: 'trans_oil_press',     label: 'Trans Oil Press',  unit: 'kPa',  tolPct: 0.05, tolAbs: 40 },
  { key: 'fuel_temp',           label: 'Fuel Temp',        unit: '°C',   tolPct: 0.10, tolAbs: 5 },
  { key: 'fuel_pressure',       label: 'Fuel Pressure',    unit: 'kPa',  tolPct: 0.15, tolAbs: 30 },
  { key: 'engine_load',         label: 'Engine Load',      unit: '%',    tolPct: 0.20, tolAbs: 8 },
  { key: 'battery_voltage',     label: 'ECU Batt',         unit: 'V',    tolPct: 0.05, tolAbs: 1, digits: 1 },
  { key: 'exhaust_temp_l',      label: 'Exhaust L',        unit: '°C',   tolPct: 0.10, tolAbs: 20 },
  { key: 'exhaust_temp_r',      label: 'Exhaust R',        unit: '°C',   tolPct: 0.10, tolAbs: 20 },
  { key: 'inlet_manifold_temp', label: 'Inlet Manifold',   unit: '°C',   tolPct: 0.10, tolAbs: 8 },
]

const CHECK_HINTS: Record<string, { high: string; low: string }> = {
  fuel_rate: {
    high: 'Fouled hull/prop, extra load (gen/thrusters), fuel filter/injector fault, air in fuel.',
    low: 'Check throttle/gear engagement, tach signal, sensor drift.',
  },
  coolant_temp: {
    high: 'Check sea-water intake/strainer, coolant level & mix, HX fouling, thermostat, RW pump impeller.',
    low: 'Warm-up or stuck-open thermostat.',
  },
  trans_oil_temp: {
    high: 'Check gearbox oil level, cooler flow, oil condition.',
    low: 'Warm-up or sensor issue.',
  },
  oil_temp: {
    high: 'Check oil level & condition, oil cooler flow, load.',
    low: 'Warm-up or sensor issue.',
  },
  oil_press: {
    high: 'Cold oil is normal; sustained high after warm-up = regulator/blocked passages.',
    low: 'CRITICAL: check oil level. Reduce load until confirmed.',
  },
  trans_oil_press: {
    high: 'Check oil level (over-fill) or filter condition.',
    low: 'CRITICAL for gearbox: check oil level, pump, filter. Reduce load.',
  },
  fuel_temp: {
    high: 'Fuel cooler / return line, hot ER, low tank level.',
    low: 'Fresh cold fuel loaded or sensor drift.',
  },
  fuel_pressure: {
    high: 'Check fuel regulator, blocked return line.',
    low: 'Filter clogged (primary/secondary), lift pump weak, air in fuel.',
  },
  engine_load: {
    high: 'Fouled hull/prop, load imbalance, wrong RPM band.',
    low: 'Prop slip, gear not engaged, sensor issue.',
  },
  battery_voltage: {
    high: 'Regulator/alternator fault (overcharge).',
    low: 'Alternator not charging, belt slip, battery fault. Check ECU power.',
  },
  exhaust_temp_l: {
    high: 'Injector fault on that bank, air filter clog, turbo issue, load imbalance.',
    low: 'Injector under-fueling or sensor fault.',
  },
  exhaust_temp_r: {
    high: 'Injector fault on that bank, air filter clog, turbo issue, load imbalance.',
    low: 'Injector under-fueling or sensor fault.',
  },
  inlet_manifold_temp: {
    high: 'Charge-air cooler fouled, ER hot, turbo overspeeding.',
    low: 'Sensor drift.',
  },
}

type Status = 'inline' | 'high' | 'low' | 'nobench' | 'noinput'

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
  const s = sigma != null && sigma > 0 ? sigma : 0
  const tol = Math.max(s, Math.abs(avg) * tolPct, tolAbs)
  const delta = actual - avg
  if (Math.abs(delta) <= tol) return { status: 'inline', delta, tol }
  return { status: delta > 0 ? 'high' : 'low', delta, tol }
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  const f = Math.pow(10, digits)
  return String(Math.round(n * f) / f)
}

function StatusDot({ s }: { s: Status }) {
  const cls =
    s === 'inline' ? 'bg-emerald-500' :
    s === 'high'   ? 'bg-red-500' :
    s === 'low'    ? 'bg-amber-500' :
    'bg-white/20'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
}

function ValueCell({ status, actual, digits }: { status: Status; actual: string; digits: number }) {
  const text = actual ? fmt(parseFloat(actual.replace(',', '.')), digits) : '—'
  const cls =
    status === 'high' ? 'text-red-400 font-semibold' :
    status === 'low'  ? 'text-amber-400 font-semibold' :
    status === 'inline' ? 'text-foreground' :
    'text-muted-foreground'
  return (
    <div className={`text-sm ${cls} flex items-center gap-1.5 justify-end`}>
      <StatusDot s={status} />
      <span>{text}</span>
    </div>
  )
}

export interface RpmComparisonProps {
  /** Form values keyed as `port_<field>` / `stbd_<field>` / `port_rpm` / `stbd_rpm` */
  values: Record<string, string>
  compact?: boolean
}

export function RpmComparison({ values, compact = false }: RpmComparisonProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['rpm-averages'],
    queryFn: getRpmAverages,
    staleTime: 5 * 60 * 1000,
  })

  const portRpm = values.port_rpm ? parseInt(values.port_rpm, 10) : NaN
  const stbdRpm = values.stbd_rpm ? parseInt(values.stbd_rpm, 10) : NaN
  const portBand = data && !Number.isNaN(portRpm) ? nearestBand(data.bands, portRpm) : null
  const stbdBand = data && !Number.isNaN(stbdRpm) ? nearestBand(data.bands, stbdRpm) : null

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-2">Loading RPM benchmarks…</div>
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
        Couldn't load RPM averages: {(error as Error).message}
      </div>
    )
  }
  if (!portBand && !stbdBand) {
    return <div className="text-xs text-muted-foreground py-2">Enter RPM for at least one engine to see the analysis.</div>
  }

  const rpmLabel =
    portBand && stbdBand
      ? `Port ${portRpm} RPM · STBD ${stbdRpm} RPM${portBand.rpm !== portRpm || stbdBand.rpm !== stbdRpm ? ` (nearest bands ${portBand.rpm}/${stbdBand.rpm})` : ''}`
      : portBand
        ? `Port ${portRpm} RPM${portBand.rpm !== portRpm ? ` (nearest band ${portBand.rpm})` : ''}`
        : `STBD ${stbdRpm} RPM${stbdBand!.rpm !== stbdRpm ? ` (nearest band ${stbdBand!.rpm})` : ''}`

  const rows = FIELDS.map(f => {
    const portRaw = values[`port_${f.key}`] || ''
    const stbdRaw = values[`stbd_${f.key}`] || ''
    const portActual = portRaw ? parseFloat(portRaw.replace(',', '.')) : NaN
    const stbdActual = stbdRaw ? parseFloat(stbdRaw.replace(',', '.')) : NaN
    const portBench = portBand?.port?.[f.key]
    const stbdBench = stbdBand?.stbd?.[f.key]
    const portAvg = portBench?.avg ?? null
    const stbdAvg = stbdBench?.avg ?? null
    // Show one average per row — prefer port, fall back to stbd. Both engines usually match closely.
    const avgLabel = portAvg != null ? portAvg : stbdAvg
    const portCls = !portRaw ? 'noinput' as Status : classify(portActual, portAvg, portBench?.sigma ?? null, f.tolPct, f.tolAbs).status
    const stbdCls = !stbdRaw ? 'noinput' as Status : classify(stbdActual, stbdAvg, stbdBench?.sigma ?? null, f.tolPct, f.tolAbs).status
    // Hint priority: port high/low over stbd
    let hint: string | null = null
    for (const s of [portCls, stbdCls]) {
      if (s === 'high' && CHECK_HINTS[f.key]) { hint = CHECK_HINTS[f.key].high; break }
      if (s === 'low'  && CHECK_HINTS[f.key]) { hint = CHECK_HINTS[f.key].low; break }
    }
    return { f, portRaw, stbdRaw, portCls, stbdCls, avgLabel, hint }
  })

  const anyOOB = rows.some(r => r.portCls === 'high' || r.portCls === 'low' || r.stbdCls === 'high' || r.stbdCls === 'low')

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Reading Check</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{rpmLabel}</div>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-3">
          <span className="flex items-center gap-1"><StatusDot s="inline" /> in-line</span>
          <span className="flex items-center gap-1"><StatusDot s="high" /> above</span>
          <span className="flex items-center gap-1"><StatusDot s="low" /> below</span>
        </div>
      </div>
      <div className="overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-3 py-2 font-semibold">Metric</th>
              <th className="text-right px-2 py-2 font-semibold">Port</th>
              <th className="text-right px-2 py-2 font-semibold">STBD</th>
              <th className="text-right px-3 py-2 font-semibold">Avg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <React.Fragment key={row.f.key}>
                <tr className={idx % 2 === 0 ? 'bg-black/10' : ''}>
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{row.f.label}</div>
                    <div className="text-[10px] text-muted-foreground">{row.f.unit}</div>
                  </td>
                  <td className="px-2 py-2"><ValueCell status={row.portCls} actual={row.portRaw} digits={row.f.digits ?? 1} /></td>
                  <td className="px-2 py-2"><ValueCell status={row.stbdCls} actual={row.stbdRaw} digits={row.f.digits ?? 1} /></td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmt(row.avgLabel, row.f.digits ?? 1)}</td>
                </tr>
                {row.hint && !compact && (
                  <tr className={idx % 2 === 0 ? 'bg-black/10' : ''}>
                    <td colSpan={4} className="px-3 pb-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Check: </span>{row.hint}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!anyOOB && (
        <div className="px-3 py-2 border-t border-white/10 text-[11px] text-emerald-400">
          All readings within tolerance of the historical average for this RPM band.
        </div>
      )}
    </div>
  )
}
