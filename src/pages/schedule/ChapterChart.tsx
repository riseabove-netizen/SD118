// Lightweight nautical chart for a chapter detail page.
//
// Renders an OpenStreetMap basemap + OpenSeaMap nautical overlay by stitching
// 256×256 slippy-map tiles inside a clipped container, then overlays an SVG
// route polyline + numbered markers for each stop. No mapping library — keeps
// the bundle flat. Routes follow curated waypoints from chapter-ports.ts so
// the line stays over water, never crossing land.
//
// Tile sources are free public services:
//   - OSM tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png
//   - OpenSeaMap overlay: https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png
//
// Attribution is rendered in the chart footer per the OSM/OpenSeaMap license.

import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPolyline, routeBounds, type ChapterRoute, type Coord } from './chapter-ports'

interface ChapterChartProps {
  route: ChapterRoute
  /** Maximum pixel width of the rendered chart. Actual width is measured from
   *  the container so tile positions and SVG overlay stay pixel-perfect on
   *  every screen size. Height adapts to the route aspect. */
  maxWidth?: number
  /** Optional height override; if omitted, computed from the bbox aspect ratio. */
  height?: number
}

// === slippy-map tile math (OSM/OpenSeaMap standard) ===

function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z)
}

function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180
  return (
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) *
    Math.pow(2, z)
  )
}

const TILE = 256

/**
 * Pick the largest zoom level where the route bbox fits within `width × height`
 * tile-pixels. Returns z plus pixel-projection helpers.
 */
function pickZoom(
  bbox: { west: number; east: number; south: number; north: number },
  width: number,
  height: number,
): {
  z: number
  // pixel projection (CSS pixels relative to the rendered chart box)
  lonToPx: (lon: number) => number
  latToPx: (lat: number) => number
  // tile range (inclusive) to render
  x0: number; x1: number; y0: number; y1: number
  // pixel offset of tile-grid origin within the chart box
  offsetX: number; offsetY: number
} {
  // Find the highest z where the bbox spans <= width × height pixels.
  let chosen = 3
  for (let z = 12; z >= 3; z--) {
    const wPx = Math.abs(lonToTileX(bbox.east, z) - lonToTileX(bbox.west, z)) * TILE
    const hPx = Math.abs(latToTileY(bbox.south, z) - latToTileY(bbox.north, z)) * TILE
    if (wPx <= width && hPx <= height) {
      chosen = z
      break
    }
  }
  const z = chosen
  // World-pixel coords of bbox corners.
  const wxW = lonToTileX(bbox.west, z) * TILE
  const wxE = lonToTileX(bbox.east, z) * TILE
  const wyN = latToTileY(bbox.north, z) * TILE
  const wyS = latToTileY(bbox.south, z) * TILE
  const routeW = wxE - wxW
  const routeH = wyS - wyN
  // Center the route inside (width, height).
  const offsetX = (width - routeW) / 2 - wxW
  const offsetY = (height - routeH) / 2 - wyN

  const lonToPx = (lon: number) => lonToTileX(lon, z) * TILE + offsetX
  const latToPx = (lat: number) => latToTileY(lat, z) * TILE + offsetY

  // Tile range (inclusive) covering the chart box.
  const x0 = Math.floor((-offsetX) / TILE)
  const x1 = Math.floor((width - offsetX) / TILE)
  const y0 = Math.floor((-offsetY) / TILE)
  const y1 = Math.floor((height - offsetY) / TILE)

  return { z, lonToPx, latToPx, x0, x1, y0, y1, offsetX, offsetY }
}

export function ChapterChart({ route, maxWidth = 760, height }: ChapterChartProps) {
  const bbox = useMemo(() => routeBounds(route, 0.22), [route])

  // Measure the actual rendered width so tile (px) and SVG (px) coordinates
  // share the same coordinate space at any viewport size.
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [measuredWidth, setMeasuredWidth] = useState<number>(maxWidth)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => {
      const w = Math.max(200, Math.min(maxWidth, el.clientWidth))
      setMeasuredWidth(Math.round(w))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWidth])

  const width = measuredWidth

  // Compute a height proportional to the bbox aspect if not given.
  const finalHeight = useMemo(() => {
    if (height) return height
    // Approximate aspect from lat/lon span at the bbox midpoint.
    const midLat = (bbox.north + bbox.south) / 2
    const lonSpan = (bbox.east - bbox.west) * Math.cos((midLat * Math.PI) / 180)
    const latSpan = bbox.north - bbox.south
    const aspect = lonSpan === 0 ? 0.5 : latSpan / lonSpan
    const h = Math.round(width * Math.max(0.42, Math.min(0.85, aspect)))
    return h
  }, [bbox, height, width])

  const proj = useMemo(
    () => pickZoom(bbox, width, finalHeight),
    [bbox, width, finalHeight],
  )

  // Build the polyline pixel coordinates.
  const poly: Coord[] = useMemo(() => buildPolyline(route), [route])
  const polyPx = useMemo(
    () => poly.map(c => `${proj.lonToPx(c.lon).toFixed(1)},${proj.latToPx(c.lat).toFixed(1)}`).join(' '),
    [poly, proj],
  )

  // Build a list of tiles to render.
  const tiles: Array<{ x: number; y: number; left: number; top: number }> = []
  const tilesMax = Math.pow(2, proj.z)
  for (let tx = proj.x0; tx <= proj.x1; tx++) {
    for (let ty = proj.y0; ty <= proj.y1; ty++) {
      if (ty < 0 || ty >= tilesMax) continue
      // wrap longitude
      const wrapped = ((tx % tilesMax) + tilesMax) % tilesMax
      tiles.push({
        x: wrapped,
        y: ty,
        left: tx * TILE + proj.offsetX,
        top: ty * TILE + proj.offsetY,
      })
    }
  }

  // Marker positions (only the named stops, not waypoints).
  const markers = route.stops.map((s, i) => ({
    i,
    name: s.short || s.name,
    x: proj.lonToPx(s.coord.lon),
    y: proj.latToPx(s.coord.lat),
  }))

  return (
    <div ref={wrapRef} className="rounded-2xl overflow-hidden border border-border bg-card">
      <div className="relative" style={{ width: `${width}px`, height: `${finalHeight}px` }}>
        {/* Tile layers — OSM basemap + OpenSeaMap nautical overlay */}
        <div className="absolute inset-0 overflow-hidden bg-[#aad3df]">
          {tiles.map(t => (
            <img
              key={`base-${t.x}-${t.y}`}
              src={`https://tile.openstreetmap.org/${proj.z}/${t.x}/${t.y}.png`}
              alt=""
              loading="lazy"
              draggable={false}
              referrerPolicy="no-referrer"
              style={{
                position: 'absolute',
                left: `${t.left}px`,
                top: `${t.top}px`,
                width: `${TILE}px`,
                height: `${TILE}px`,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          ))}
          {tiles.map(t => (
            <img
              key={`sea-${t.x}-${t.y}`}
              src={`https://tiles.openseamap.org/seamark/${proj.z}/${t.x}/${t.y}.png`}
              alt=""
              loading="lazy"
              draggable={false}
              referrerPolicy="no-referrer"
              style={{
                position: 'absolute',
                left: `${t.left}px`,
                top: `${t.top}px`,
                width: `${TILE}px`,
                height: `${TILE}px`,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>

        {/* Route polyline + markers — SVG uses the same pixel coordinate
            space as the absolute-positioned tile <img>s above, so markers
            land exactly on top of the harbor they represent. */}
        <svg
          width={width}
          height={finalHeight}
          viewBox={`0 0 ${width} ${finalHeight}`}
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
        >
          {/* Route glow + line */}
          <polyline
            points={polyPx}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.65}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={polyPx}
            fill="none"
            stroke="#dc2626"
            strokeWidth={2.5}
            strokeDasharray="7 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Stop markers */}
          {markers.map(m => (
            <g key={`m-${m.i}`}>
              {/* halo */}
              <circle cx={m.x} cy={m.y} r={11} fill="#ffffff" fillOpacity={0.95} />
              <circle cx={m.x} cy={m.y} r={10} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
              <text
                x={m.x}
                y={m.y + 3.5}
                fontSize={10.5}
                fontWeight={700}
                fill="#ffffff"
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
              >
                {m.i + 1}
              </text>
            </g>
          ))}
        </svg>

        {/* Attribution */}
        <div className="absolute bottom-0 right-0 px-1.5 py-0.5 text-[9px] text-black/70 bg-white/70 rounded-tl">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> · <a href="https://www.openseamap.org/" target="_blank" rel="noreferrer" className="underline">OpenSeaMap</a>
        </div>
      </div>

      {/* Stop legend */}
      <div className="px-3 py-2.5 border-t border-border bg-card/60">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">CHART STOPS</div>
        <ol className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-foreground">
          {route.stops.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                {i + 1}
              </span>
              <span>{s.name}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
