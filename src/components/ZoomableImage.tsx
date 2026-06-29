import React, { useEffect, useRef, useState } from 'react'

// Full-screen image viewer with:
//   • Pinch-to-zoom (two-finger touch)
//   • Mouse-wheel zoom (Ctrl-wheel or any wheel)
//   • Drag to pan (mouse + single-finger touch when zoomed)
//   • Double-tap / double-click to toggle between fit and 2.5×
//   • +/- on-screen buttons and a reset button
//   • Close on background tap or X button
//
// No external libs.

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 8

export function ZoomableImage({ src, alt, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)

  // Gesture state
  const stateRef = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    startDist: 0,
    startScale: 1,
    startMidX: 0,
    startMidY: 0,
    startTx: 0,
    startTy: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    lastTap: 0,
  })

  // Clamp pan so the image doesn't drift off-screen at high zoom.
  const clamp = (s: number, x: number, y: number) => {
    const c = containerRef.current
    const img = imgRef.current
    if (!c || !img) return { x, y }
    const cw = c.clientWidth
    const ch = c.clientHeight
    const iw = img.clientWidth * s
    const ih = img.clientHeight * s
    const maxX = Math.max(0, (iw - cw) / 2)
    const maxY = Math.max(0, (ih - ch) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  const applyZoom = (nextScale: number, cx?: number, cy?: number) => {
    const c = containerRef.current
    if (!c) return
    const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale))
    // Zoom around (cx, cy) in container coords. Keep that point stable.
    if (cx === undefined || cy === undefined) {
      const clamped = clamp(ns, tx, ty)
      setScale(ns)
      setTx(clamped.x)
      setTy(clamped.y)
      return
    }
    const rect = c.getBoundingClientRect()
    const originX = cx - rect.left - rect.width / 2
    const originY = cy - rect.top - rect.height / 2
    const k = ns / scale
    const nx = originX - k * (originX - tx)
    const ny = originY - k * (originY - ty)
    const clamped = clamp(ns, nx, ny)
    setScale(ns)
    setTx(clamped.x)
    setTy(clamped.y)
  }

  const reset = () => {
    setScale(1); setTx(0); setTy(0)
  }

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') applyZoom(scale * 1.25)
      else if (e.key === '-' || e.key === '_') applyZoom(scale / 1.25)
      else if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scale, tx, ty])

  // Pointer handlers (covers mouse + touch + pen)
  const onPointerDown = (e: React.PointerEvent) => {
    const c = containerRef.current
    if (!c) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const s = stateRef.current
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (s.pointers.size === 1) {
      // Possible pan or double-tap
      const now = Date.now()
      if (now - s.lastTap < 280) {
        // double-tap toggle
        if (scale > 1.05) reset()
        else applyZoom(2.5, e.clientX, e.clientY)
        s.lastTap = 0
      } else {
        s.lastTap = now
      }
      s.isPanning = scale > 1.001
      s.panStartX = e.clientX
      s.panStartY = e.clientY
      s.startTx = tx
      s.startTy = ty
    } else if (s.pointers.size === 2) {
      const [a, b] = Array.from(s.pointers.values())
      s.startDist = Math.hypot(b.x - a.x, b.y - a.y)
      s.startScale = scale
      s.startMidX = (a.x + b.x) / 2
      s.startMidY = (a.y + b.y) / 2
      s.startTx = tx
      s.startTy = ty
      s.isPanning = false
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = stateRef.current
    if (!s.pointers.has(e.pointerId)) return
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (s.pointers.size === 2) {
      const [a, b] = Array.from(s.pointers.values())
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      if (s.startDist > 0) {
        const factor = dist / s.startDist
        applyZoom(s.startScale * factor, s.startMidX, s.startMidY)
      }
    } else if (s.pointers.size === 1 && s.isPanning) {
      const dx = e.clientX - s.panStartX
      const dy = e.clientY - s.panStartY
      const clamped = clamp(scale, s.startTx + dx, s.startTy + dy)
      setTx(clamped.x)
      setTy(clamped.y)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const s = stateRef.current
    s.pointers.delete(e.pointerId)
    if (s.pointers.size < 2) s.startDist = 0
    if (s.pointers.size === 0) s.isPanning = false
  }

  // Wheel zoom (with passive: false so we can preventDefault)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const direction = e.deltaY < 0 ? 1 : -1
      const factor = direction > 0 ? 1.15 : 1 / 1.15
      applyZoom(scale * factor, e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scale, tx, ty])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 select-none touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        // Only close when clicking the empty background (not the image or controls)
        if (e.target === containerRef.current) onClose()
      }}
      style={{ cursor: scale > 1 ? 'grab' : 'zoom-in' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          ref={imgRef}
          src={src}
          alt={alt || 'Zoomed image'}
          draggable={false}
          className="max-w-full max-h-full object-contain pointer-events-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: stateRef.current.pointers.size === 0 ? 'transform 80ms ease-out' : 'none',
            willChange: 'transform',
          }}
        />
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-2 py-1.5">
        <button
          onClick={() => applyZoom(scale / 1.25)}
          className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center text-white"
          aria-label="Zoom out"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="12" x2="18" y2="12"/>
          </svg>
        </button>
        <button
          onClick={reset}
          className="px-3 h-10 rounded-full hover:bg-white/15 text-white text-xs font-medium tabular-nums min-w-[3.5rem]"
          aria-label="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => applyZoom(scale * 1.25)}
          className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center text-white"
          aria-label="Zoom in"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="12" y1="6" x2="12" y2="18"/>
            <line x1="6" y1="12" x2="18" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="absolute top-4 left-4 text-white/60 text-xs">
        Pinch · scroll · drag · double-tap
      </div>
    </div>
  )
}
