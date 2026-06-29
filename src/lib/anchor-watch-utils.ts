// Helpers for the Anchor Watchkeeper Log feature: wind forecast (Open-Meteo,
// no auth required), Esri World Imagery static map URLs, and small math for
// rendering a 24 h wind chart inline in the React page and the PDF.

export interface WindHourly {
  time: string[]              // ISO timestamps
  windSpeedKt: number[]       // knots
  windDirDeg: number[]        // degrees
  gustKt?: number[]           // knots (may be missing)
}

export interface WindForecast {
  fetchedAt: string
  lat: number
  lon: number
  hourly: WindHourly          // first 24 hours from now
  maxKt: number
  maxGustKt: number
  dominantDirDeg: number
}

const DEG_TO_COMPASS = [
  'N','NNE','NE','ENE','E','ESE','SE','SSE',
  'S','SSW','SW','WSW','W','WNW','NW','NNW',
]

export function compass(deg: number | undefined | null): string {
  if (deg === null || deg === undefined || isNaN(deg)) return '—'
  const i = Math.round(((deg % 360) / 22.5)) % 16
  return DEG_TO_COMPASS[i]
}

export async function fetchWindForecast(lat: number, lon: number): Promise<WindForecast> {
  // wind units default m/s; request knots directly via wind_speed_unit=kn
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&wind_speed_unit=kn&forecast_days=2&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Wind API ${res.status}`)
  const data = await res.json()
  const times: string[] = data?.hourly?.time || []
  const speeds: number[] = data?.hourly?.wind_speed_10m || []
  const dirs: number[]   = data?.hourly?.wind_direction_10m || []
  const gusts: number[]  = data?.hourly?.wind_gusts_10m || []

  // Find index of "now" — Open-Meteo returns full-day hours; pick first >= now.
  const now = Date.now()
  let start = 0
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]).getTime() >= now - 30 * 60 * 1000) { start = i; break }
  }
  const end = Math.min(start + 24, times.length)

  const hourly: WindHourly = {
    time: times.slice(start, end),
    windSpeedKt: speeds.slice(start, end),
    windDirDeg: dirs.slice(start, end),
    gustKt: gusts.slice(start, end),
  }

  // Aggregate stats
  const maxKt = hourly.windSpeedKt.reduce((a, b) => Math.max(a, b), 0)
  const maxGustKt = (hourly.gustKt || []).reduce((a, b) => Math.max(a, b), 0)
  // dominant direction = circular mean
  let sx = 0, sy = 0
  for (let i = 0; i < hourly.windDirDeg.length; i++) {
    const r = (hourly.windDirDeg[i] * Math.PI) / 180
    sx += Math.cos(r); sy += Math.sin(r)
  }
  let dominantDirDeg = (Math.atan2(sy, sx) * 180) / Math.PI
  if (dominantDirDeg < 0) dominantDirDeg += 360

  return {
    fetchedAt: new Date().toISOString(),
    lat, lon,
    hourly,
    maxKt,
    maxGustKt,
    dominantDirDeg,
  }
}

// Esri World Imagery static map export. Free, no auth, supports JPEG.
// Bbox is computed from a center + a half-side in degrees.
export function esriSatelliteUrl(lat: number, lon: number, opts?: { halfDeg?: number; w?: number; h?: number }): string {
  const half = opts?.halfDeg ?? 0.006  // ~600 m at mid-latitudes
  const w = opts?.w ?? 720
  const h = opts?.h ?? 480
  const minLon = lon - half
  const minLat = lat - half
  const maxLon = lon + half
  const maxLat = lat + half
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`
  const base = 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export'
  return `${base}?bbox=${encodeURIComponent(bbox)}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`
}

// Build a compact inline SVG showing wind speed (and gusts) over 24 hours.
// Used both on screen and embedded in the PDF as a PNG bitmap.
export function buildWindSvg(fc: WindForecast, opts?: { width?: number; height?: number; bg?: string }): string {
  const w = opts?.width ?? 720
  const h = opts?.height ?? 220
  const padL = 36, padR = 16, padT = 18, padB = 28
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const bg = opts?.bg ?? '#0b1220'
  const grid = '#1f2937'
  const speedColor = '#ef4444'     // red — accent
  const gustColor = '#f59e0b'      // amber
  const labelColor = '#94a3b8'
  const titleColor = '#fef2f2'

  const data = fc.hourly.windSpeedKt
  const gusts = fc.hourly.gustKt || []
  if (data.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="100%" height="100%" fill="${bg}"/>
      <text x="${w/2}" y="${h/2}" fill="${labelColor}" font-family="system-ui" font-size="14" text-anchor="middle">No wind data</text>
    </svg>`
  }
  const yMax = Math.max(20, Math.ceil((Math.max(fc.maxKt, fc.maxGustKt) + 4) / 5) * 5)
  const x = (i: number) => padL + (i / (data.length - 1)) * innerW
  const y = (v: number) => padT + innerH - (v / yMax) * innerH

  // gridlines at every 5 kt
  const gridLines: string[] = []
  for (let v = 0; v <= yMax; v += 5) {
    gridLines.push(`<line x1="${padL}" y1="${y(v)}" x2="${padL + innerW}" y2="${y(v)}" stroke="${grid}" stroke-width="0.5"/>`)
    gridLines.push(`<text x="${padL - 4}" y="${y(v) + 3}" fill="${labelColor}" font-family="system-ui" font-size="9" text-anchor="end">${v}</text>`)
  }

  // x-axis labels (every 3 h)
  const xLabels: string[] = []
  for (let i = 0; i < data.length; i += 3) {
    const t = new Date(fc.hourly.time[i])
    const hh = t.getHours().toString().padStart(2, '0')
    xLabels.push(`<text x="${x(i)}" y="${h - 8}" fill="${labelColor}" font-family="system-ui" font-size="9" text-anchor="middle">${hh}h</text>`)
  }

  // gust area
  let gustPath = ''
  if (gusts.length === data.length && fc.maxGustKt > 0) {
    let d = `M ${x(0)} ${y(gusts[0])}`
    for (let i = 1; i < gusts.length; i++) d += ` L ${x(i)} ${y(gusts[i])}`
    d += ` L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`
    gustPath = `<path d="${d}" fill="${gustColor}" fill-opacity="0.18" stroke="none"/>`
  }
  // gust line
  let gustLine = ''
  if (gusts.length === data.length && fc.maxGustKt > 0) {
    let d = `M ${x(0)} ${y(gusts[0])}`
    for (let i = 1; i < gusts.length; i++) d += ` L ${x(i)} ${y(gusts[i])}`
    gustLine = `<path d="${d}" fill="none" stroke="${gustColor}" stroke-width="1.5" stroke-dasharray="3 2"/>`
  }

  // speed line
  let speedPath = `M ${x(0)} ${y(data[0])}`
  for (let i = 1; i < data.length; i++) speedPath += ` L ${x(i)} ${y(data[i])}`
  const speedFill = speedPath + ` L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`

  // direction barbs (every 3 h) — small arrows
  const barbs: string[] = []
  for (let i = 0; i < data.length; i += 3) {
    const cx = x(i), cy = padT + 8
    const deg = fc.hourly.windDirDeg[i]
    const r = ((deg + 180) * Math.PI) / 180  // arrow points where wind is going
    const dx = Math.sin(r) * 6, dy = -Math.cos(r) * 6
    barbs.push(`<line x1="${cx}" y1="${cy}" x2="${cx + dx}" y2="${cy + dy}" stroke="${speedColor}" stroke-width="1.5"/>`)
    barbs.push(`<circle cx="${cx}" cy="${cy}" r="1.5" fill="${speedColor}"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <text x="${padL}" y="${padT - 4}" fill="${titleColor}" font-family="system-ui" font-size="11" font-weight="600">Wind forecast · next 24 h · kn</text>
    <text x="${w - padR}" y="${padT - 4}" fill="${labelColor}" font-family="system-ui" font-size="10" text-anchor="end">max ${fc.maxKt.toFixed(0)} kn · gust ${fc.maxGustKt.toFixed(0)} kn · ${compass(fc.dominantDirDeg)}</text>
    ${gridLines.join('')}
    ${gustPath}
    <path d="${speedFill}" fill="${speedColor}" fill-opacity="0.25" stroke="none"/>
    <path d="${speedPath}" fill="none" stroke="${speedColor}" stroke-width="2"/>
    ${gustLine}
    ${barbs.join('')}
    ${xLabels.join('')}
  </svg>`
}

// Convert an SVG string to a PNG dataURL using the browser canvas. Used to
// embed the wind chart into the PDF via pdf-lib's embedPng.
export async function svgToPngBytes(svg: string, scale = 2): Promise<Uint8Array> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG load failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth * scale
    canvas.height = img.naturalHeight * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.split(',')[1]
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Fetch any URL (incl. cross-origin Esri tile) and return its bytes for PDF embedding.
export async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch ${res.status}`)
  const blob = await res.blob()
  const buf = await blob.arrayBuffer()
  return { bytes: new Uint8Array(buf), mime: blob.type || 'image/jpeg' }
}
