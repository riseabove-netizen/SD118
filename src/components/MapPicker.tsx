import React, { useEffect, useRef, useState } from 'react'
import { esriSatelliteUrl } from '@/lib/anchor-watch-utils'
import { formatCoords } from '@/lib/useGeolocation'

// A lightweight Esri-satellite map picker.
//
// • The image fills the picker. A crosshair pin is locked to the center.
// • Dragging the image pans the underlying lat/lon (image moves with the
//   finger; pin stays fixed, so dragging right moves the chosen point
//   *west*).
// • Pinch / wheel changes the zoom level (smaller halfDeg = closer in).
// • On release the chosen lat/lon is reported via onChange. Confirm/Cancel
//   buttons live in the parent component.
//
// We intentionally don't bring in Leaflet/Mapbox/etc — a single Esri image
// export is enough for a "pick the anchorage" UX and keeps the bundle slim.

export interface MapPickerProps {
  lat: number
  lon: number
  onChange: (lat: number, lon: number) => void
  // Optional GPS dot we draw inside the map for reference.
  gpsLat?: number | null
  gpsLon?: number | null
  // Image height in pixels (width fills the container).
  height?: number
  // Initial map "half side" in degrees. Smaller = zoomed in. Default ≈ 2.5 km.
  initialHalfDeg?: number
}

const MIN_HALF = 0.0008  // ~80 m on a side — very close in
const MAX_HALF = 0.25    // ~25 km — wide view

export function MapPicker(props: MapPickerProps) {
  const { lat, lon, onChange, gpsLat, gpsLon, height = 320, initialHalfDeg = 0.012 } = props

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth]   = useState<number>(720)
  const [halfDeg, setHalfDeg] = useState<number>(initialHalfDeg)

  // Drag state
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startLat: number; startLon: number } | null>(null)

  // Pinch state
  const pinchRef = useRef<{ active: boolean; startDist: number; startHalfDeg: number } | null>(null)

  // The currently-fetched image URL. We refresh it after every drag/zoom end
  // (and a debounced version mid-drag so the user sees movement).
  const [imgUrl, setImgUrl] = useState<string>('')

  // ── Track container width so we get a properly sized Esri image ────
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setWidth(Math.max(280, Math.floor(el.clientWidth)))
    })
    obs.observe(el)
    setWidth(Math.max(280, Math.floor(el.clientWidth)))
    return () => obs.disconnect()
  }, [])

  // Refresh the image whenever lat/lon/halfDeg/size changes.
  // Aspect ratio of the bbox should match width/height so the pin sits
  // perfectly on the geometric center.
  useEffect(() => {
    if (!isFinite(lat) || !isFinite(lon)) return
    const url = esriSatelliteUrl(lat, lon, {
      halfDeg,
      w: width,
      h: height,
    })
    setImgUrl(url)
  }, [lat, lon, halfDeg, width, height])

  // ── Convert a pixel delta on screen into a lat/lon delta ────────────
  function pxToDegrees(dx: number, dy: number) {
    // The image spans (2 * halfDeg) degrees of longitude over `width` px,
    // and (2 * halfDegLat) degrees of latitude over `height` px.
    // To keep the visual square correct we already match aspect via the
    // bbox; but to be safe we compute lat span from height ratio.
    const halfDegLat = halfDeg * (height / width)
    const dLon = -(dx / width)  * (2 * halfDeg)
    const dLat =  (dy / height) * (2 * halfDegLat)
    return { dLat, dLon }
  }

  // ── Pointer handlers ───────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    // Pinch is handled in touch handlers; ignore secondary touch here.
    if (e.pointerType === 'touch' && e.isPrimary === false) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startLat: lat,
      startLon: lon,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d || !d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const { dLat, dLon } = pxToDegrees(dx, dy)
    onChange(clampLat(d.startLat + dLat), clampLon(d.startLon + dLon))
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  // Wheel = zoom. Up = zoom in (smaller halfDeg).
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18
    setHalfDeg(h => clampHalf(h * factor))
  }

  // Touch handlers for pinch-zoom (pointer events don't expose pinch directly)
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      pinchRef.current = {
        active: true,
        startDist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        startHalfDeg: halfDeg,
      }
      dragRef.current = null
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    const p = pinchRef.current
    if (p && p.active && e.touches.length === 2) {
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      if (dist > 0 && p.startDist > 0) {
        setHalfDeg(clampHalf(p.startHalfDeg * (p.startDist / dist)))
      }
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null
  }

  // ── Render ────────────────────────────────────────────────────────
  const formatted = formatCoords(lat, lon)

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-lg border border-border bg-secondary/30 select-none"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {imgUrl && (
          // The image is just a visual reference — pointer events go to the wrapper.
          <img
            src={imgUrl}
            alt="Map"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {/* GPS dot, only visible if it falls inside the current bbox */}
        {gpsLat != null && gpsLon != null && (() => {
          const halfDegLat = halfDeg * (height / width)
          const dx = ((gpsLon - lon) / (2 * halfDeg)) * width
          const dy = -((gpsLat - lat) / (2 * halfDegLat)) * height
          const x = width / 2 + dx
          const y = height / 2 + dy
          if (x < 0 || x > width || y < 0 || y > height) return null
          return (
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow pointer-events-none"
              style={{ left: x - 5, top: y - 5 }}
              title="GPS position"
            />
          )
        })()}

        {/* Center crosshair pin */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Crosshair />
        </div>

        {/* Zoom buttons (right) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setHalfDeg(h => clampHalf(h / 1.5))}
            className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 text-white text-lg font-bold flex items-center justify-center"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setHalfDeg(h => clampHalf(h * 1.5))}
            className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 text-white text-lg font-bold flex items-center justify-center"
          >
            −
          </button>
        </div>

        {/* Scale hint (bottom-left) */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] tracking-wide">
          ±{(halfDeg * 111).toFixed(halfDeg < 0.01 ? 2 : 1)} km
        </div>

        {/* Coords label (bottom-right) */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/55 text-white text-[10px] font-medium">
          {formatted}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Drag the map to move the pin. Pinch or scroll to zoom. Tap + / − for fixed zoom steps.
      </p>
    </div>
  )
}

function Crosshair() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="13" stroke="#fff" strokeWidth="2" />
      <circle cx="22" cy="22" r="13" stroke="#ef4444" strokeWidth="1" />
      <circle cx="22" cy="22" r="3" fill="#ef4444" stroke="#fff" strokeWidth="1" />
      <line x1="22" y1="2"  x2="22" y2="9"  stroke="#fff" strokeWidth="2" />
      <line x1="22" y1="35" x2="22" y2="42" stroke="#fff" strokeWidth="2" />
      <line x1="2"  y1="22" x2="9"  y2="22" stroke="#fff" strokeWidth="2" />
      <line x1="35" y1="22" x2="42" y2="22" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}

function clampHalf(v: number) {
  return Math.max(MIN_HALF, Math.min(MAX_HALF, v))
}
function clampLat(v: number) {
  return Math.max(-85, Math.min(85, v))
}
function clampLon(v: number) {
  let x = v
  if (x > 180) x -= 360
  if (x < -180) x += 360
  return x
}

// Build a Google Maps URL for the given coords.
export function googleMapsUrl(lat: number, lon: number, zoom = 15): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}&zoom=${zoom}`
}
