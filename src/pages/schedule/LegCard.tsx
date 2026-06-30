import React from 'react'
import { type Leg, projectInBbox } from './enricos-legs'

const IMG_W = 800
const IMG_H = 360

/**
 * Renders an inter-chapter leg: satellite snapshot with a red route line
 * overlaid as SVG, plus distance / travel time / bearing summary.
 *
 * The basemap is a single ArcGIS World_Imagery export call (no API key).
 * The route line and endpoint markers are drawn as an SVG layer on top,
 * which is more reliable than baking a polyline into the export URL across
 * CDNs and proxies.
 */
export function LegCard({ leg }: { leg: Leg }) {
  const { ax, ay, bx, by } = projectInBbox(leg.from, leg.to, IMG_W, IMG_H)

  // Compass cardinal for bearing.
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const cardinal = cardinals[Math.round(leg.bearingDeg / 45) % 8]

  return (
    <div className="relative my-3 rounded-2xl overflow-hidden border border-border bg-card">
      <div className="relative w-full" style={{ aspectRatio: `${IMG_W} / ${IMG_H}` }}>
        <img
          src={leg.satelliteUrl}
          alt={`Satellite view: ${leg.fromLabel} → ${leg.toLabel}`}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Subtle dark gradient for legibility of overlaid text */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/50 pointer-events-none" />

        {/* Route + markers as SVG using the same projection math */}
        <svg
          viewBox={`0 0 ${IMG_W} ${IMG_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <defs>
            <filter id="leg-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer halo behind the line for visibility on bright water */}
          <line
            x1={ax}
            y1={ay}
            x2={bx}
            y2={by}
            stroke="black"
            strokeOpacity="0.55"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Main red route */}
          <line
            x1={ax}
            y1={ay}
            x2={bx}
            y2={by}
            stroke="rgb(239 68 68)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="14 8"
            filter="url(#leg-glow)"
          />

          {/* Endpoint markers */}
          <circle cx={ax} cy={ay} r="9" fill="white" stroke="rgb(239 68 68)" strokeWidth="3" />
          <circle cx={bx} cy={by} r="9" fill="rgb(239 68 68)" stroke="white" strokeWidth="3" />
        </svg>

        {/* Origin label */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-[11px] text-white font-medium backdrop-blur-sm">
          {leg.fromLabel}
        </div>
        {/* Destination label */}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-red-600/85 text-[11px] text-white font-medium backdrop-blur-sm">
          {leg.toLabel}
        </div>

        {/* Distance / time / bearing chip */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/70 text-white backdrop-blur-sm">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-red-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-8-7.58-8-12a8 8 0 0 1 16 0c0 4.42-8 12-8 12Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div className="leading-tight">
            <div className="text-xs font-semibold">
              {leg.distanceNm.toFixed(0)} nm
            </div>
            <div className="text-[10px] text-white/80">
              ~{leg.travelLabel} @ {leg.cruiseKnots} kn · {cardinal} {Math.round(leg.bearingDeg)}°
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>
          Passage from <span className="text-foreground font-medium">{leg.fromLabel}</span> to{' '}
          <span className="text-foreground font-medium">{leg.toLabel}</span>
        </span>
        <a
          href={leg.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Open in Maps
        </a>
      </div>
    </div>
  )
}
