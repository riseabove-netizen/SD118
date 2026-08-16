import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRpmAverages, type RpmBand } from '@/lib/api'

type Side = 'port' | 'stbd'

type Field = { key: string; label: string; unit: string; tolPct: number; tolAbs: number; digits?: number }

const FIELDS: Field[] = [
  // Non-benchmarked at top
  { key: 'engine_hours',        label: 'Engine Hours',     unit: 'hrs',  tolPct: 0,    tolAbs: 0,    digits: 1 },
  { key: 'rpm',                 label: 'RPM',              unit: '',     tolPct: 0,    tolAbs: 0,    digits: 0 },
  // Benchmarked
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
  { key: 'coolant_level',       label: 'Coolant Level',    unit: '',     tolPct: 0,    tolAbs: 0 },
]

const HINTS: Record<string, { high: string; low: string }> = {
  fuel_rate: {
    high: 'Fouled hull/prop, extra load (gen/thrusters), fuel filter/injector fault, air in fuel.',
    low: 'Check throttle/gear engagement, tach signal, sensor drift.',
  },
  coolant_temp: {
    high: 'Check sea-water intake/strainer, coolant level & mix, HX fouling, thermostat, RW pump impeller.',
    low: 'Warm-up or stuck-open thermostat.',
  },
  trans_oil_temp: { high: 'Check gearbox oil level, cooler flow, oil condition.', low: 'Warm-up or sensor issue.' },
  oil_temp: { high: 'Check oil level & condition, oil cooler flow, load.', low: 'Warm-up or sensor issue.' },
  oil_press: { high: 'Cold oil is normal; sustained high = regulator/blocked passages.', low: 'CRITICAL: check oil level. Reduce load until confirmed.' },
  trans_oil_press: { high: 'Check oil level (over-fill) or filter condition.', low: 'CRITICAL for gearbox: check oil level, pump, filter. Reduce load.' },
  fuel_temp: { high: 'Fuel cooler / return line, hot ER, low tank level.', low: 'Fresh cold fuel loaded or sensor drift.' },
  fuel_pressure: { high: 'Check fuel regulator, blocked return line.', low: 'Filter clogged (primary/secondary), lift pump weak, air in fuel.' },
  engine_load: { high: 'Fouled hull/prop, load imbalance, wrong RPM band.', low: 'Prop slip, gear not engaged, sensor issue.' },
  battery_voltage: { high: 'Regulator/alternator fault (overcharge).', low: 'Alternator not charging, belt slip, battery fault. Check ECU power.' },
  exhaust_temp_l: { high: 'Injector fault on that bank, air filter clog, turbo issue, load imbalance.', low: 'Injector under-fueling or sensor fault.' },
  exhaust_temp_r: { high: 'Injector fault on that bank, air filter clog, turbo issue, load imbalance.', low: 'Injector under-fueling or sensor fault.' },
  inlet_manifold_temp: { high: 'Charge-air cooler fouled, ER hot, turbo overspeeding.', low: 'Sensor drift.' },
}

type Status = 'inline' | 'high' | 'low' | 'nobench' | 'missing' | 'nocompare'

function nearestBand(bands: RpmBand[], rpm: number): RpmBand | null {
  if (!bands.length) return null
  let best = bands[0]; let bestD = Math.abs(bands[0].rpm - rpm)
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
  const rounded = Math.round(n * f) / f
  return digits === 0 ? String(Math.round(rounded)) : rounded.toFixed(digits)
}

function StatusDot({ s }: { s: Status }) {
  const cls =
    s === 'inline' ? 'bg-emerald-500' :
    s === 'high'   ? 'bg-red-500' :
    s === 'low'    ? 'bg-amber-500' :
    s === 'missing'? 'bg-red-500 animate-pulse' :
    'bg-white/15'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />
}

function borderForStatus(s: Status): string {
  if (s === 'missing') return 'border-red-500/60 bg-red-500/5'
  if (s === 'high') return 'border-red-500/40 bg-red-500/5'
  if (s === 'low') return 'border-amber-500/40 bg-amber-500/5'
  if (s === 'inline') return 'border-emerald-500/30 bg-emerald-500/5'
  return 'border-white/10 bg-black/30'
}

function textForStatus(s: Status): string {
  if (s === 'high') return 'text-red-400'
  if (s === 'low') return 'text-amber-400'
  if (s === 'missing') return 'text-red-400 placeholder-red-400/60'
  if (s === 'inline') return 'text-emerald-100'
  return 'text-foreground'
}

interface Props {
  values: Record<string, string>
  onChange: (key: string, val: string) => void
}

export function EngineTable({ values, onChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['rpm-averages'],
    queryFn: getRpmAverages,
    staleTime: 5 * 60 * 1000,
  })

  const portRpm = values.port_rpm ? parseInt(values.port_rpm, 10) : NaN
  const stbdRpm = values.stbd_rpm ? parseInt(values.stbd_rpm, 10) : NaN
  const portBand = data && !Number.isNaN(portRpm) ? nearestBand(data.bands, portRpm) : null
  const stbdBand = data && !Number.isNaN(stbdRpm) ? nearestBand(data.bands, stbdRpm) : null

  const rows = FIELDS.map(f => {
    const portKey = `port_${f.key}`
    const stbdKey = `stbd_${f.key}`
    const portRaw = values[portKey] || ''
    const stbdRaw = values[stbdKey] || ''
    const portActual = portRaw ? parseFloat(portRaw.replace(',', '.')) : NaN
    const stbdActual = stbdRaw ? parseFloat(stbdRaw.replace(',', '.')) : NaN
    const portBench = portBand?.port?.[f.key]
    const stbdBench = stbdBand?.stbd?.[f.key]
    const avgLabel: number | null = portBench?.avg ?? stbdBench?.avg ?? null
    // Determine per-cell status.
    // Non-benchmarkable fields (engine_hours, rpm, coolant_level): 'nocompare' but still red-highlight if missing.
    const isBenchmarked = f.tolAbs > 0 || f.tolPct > 0
    let portCls: Status
    let stbdCls: Status
    if (!portRaw) portCls = 'missing'
    else if (!isBenchmarked) portCls = 'nocompare'
    else portCls = classify(portActual, portBench?.avg ?? null, portBench?.sigma ?? null, f.tolPct, f.tolAbs).status
    if (!stbdRaw) stbdCls = 'missing'
    else if (!isBenchmarked) stbdCls = 'nocompare'
    else stbdCls = classify(stbdActual, stbdBench?.avg ?? null, stbdBench?.sigma ?? null, f.tolPct, f.tolAbs).status

    // Hint (skip for the RPM row itself)
    let hint: string | null = null
    if (isBenchmarked && HINTS[f.key]) {
      if (portCls === 'high' || stbdCls === 'high') hint = HINTS[f.key].high
      else if (portCls === 'low' || stbdCls === 'low') hint = HINTS[f.key].low
    }
    return { f, portKey, stbdKey, portRaw, stbdRaw, portCls, stbdCls, avgLabel, hint }
  })

  const rpmHeader =
    portBand || stbdBand
      ? `Nearest band${portBand && stbdBand && portBand.rpm !== stbdBand.rpm ? 's' : ''}: ` +
        (portBand ? `Port ${portBand.rpm}` : '—') + ' · ' +
        (stbdBand ? `STBD ${stbdBand.rpm}` : '—')
      : 'Enter an RPM value to compare against benchmarks'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="p-3 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-bold">Engine Data</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{rpmHeader}</div>
        </div>
        {isLoading && <span className="text-[11px] text-muted-foreground">loading benchmarks…</span>}
        {error && <span className="text-[11px] text-red-400">bench load failed</span>}
        <div className="text-[10px] text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
          <span className="flex items-center gap-1"><StatusDot s="inline" />in-line</span>
          <span className="flex items-center gap-1"><StatusDot s="high" />above</span>
          <span className="flex items-center gap-1"><StatusDot s="low" />below</span>
          <span className="flex items-center gap-1"><StatusDot s="missing" />missing</span>
        </div>
      </div>
      <table className="w-full text-xs table-fixed">
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[22%]" />
          <col className="w-[22%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-white/10">
            <th className="text-left px-3 py-2 font-semibold">Metric</th>
            <th className="text-center px-1 py-2 font-semibold">Port</th>
            <th className="text-center px-1 py-2 font-semibold">STBD</th>
            <th className="text-right px-3 py-2 font-semibold">Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <React.Fragment key={row.f.key}>
              <tr className={idx % 2 === 0 ? 'bg-black/10' : ''}>
                <td className="px-3 py-1.5">
                  <div className="text-[13px] font-medium leading-tight">{row.f.label}</div>
                  {row.f.unit && <div className="text-[10px] text-muted-foreground leading-tight">{row.f.unit}</div>}
                </td>
                <td className="px-1 py-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode={row.f.key === 'coolant_level' ? 'text' : 'decimal'}
                      value={row.portRaw}
                      onChange={e => onChange(row.portKey, e.target.value)}
                      placeholder={row.portCls === 'missing' ? 'missing' : '—'}
                      className={`w-full h-8 rounded border text-[13px] px-1.5 pr-4 text-center focus:outline-none focus:ring-1 focus:ring-primary ${borderForStatus(row.portCls)} ${textForStatus(row.portCls)}`}
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none">
                      <StatusDot s={row.portCls} />
                    </span>
                  </div>
                </td>
                <td className="px-1 py-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode={row.f.key === 'coolant_level' ? 'text' : 'decimal'}
                      value={row.stbdRaw}
                      onChange={e => onChange(row.stbdKey, e.target.value)}
                      placeholder={row.stbdCls === 'missing' ? 'missing' : '—'}
                      className={`w-full h-8 rounded border text-[13px] px-1.5 pr-4 text-center focus:outline-none focus:ring-1 focus:ring-primary ${borderForStatus(row.stbdCls)} ${textForStatus(row.stbdCls)}`}
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none">
                      <StatusDot s={row.stbdCls} />
                    </span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground text-[12px]">
                  {fmt(row.avgLabel, row.f.digits ?? 1)}
                </td>
              </tr>
              {row.hint && (
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
  )
}
