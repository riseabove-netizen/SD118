// Zinc-rod inspection/replacement guide — modal popup shown from the main
// engine maintenance detail page and from the Perform Service checklist
// (50h kit → "Inspect / replace zinc rods" row). The modal never navigates,
// so parent state (partially-filled Perform form, scroll position on the
// detail page) is fully preserved when the crew closes it.
//
// Content summarized + illustrations extracted from Caterpillar C32 ACERT
// Operation & Maintenance Manual SEBU8775-12, "Zinc Rods - Inspect/Replace",
// pages 123-125. Five location illustrations are pre-cropped into
// /public/assets/zinc-rods/.

import React, { useEffect } from 'react'

export interface ZincRodLocation {
  label: string
  count: number
  img: string
  caption: string
}

const LOCATIONS: ZincRodLocation[] = [
  {
    label: 'Auxiliary water pump (front of engine)',
    count: 1,
    img: '/assets/zinc-rods/aux-water-pump.png',
    caption: 'One rod on the front of the engine, next to the auxiliary water pump. (Illustration 59, item 1)',
  },
  {
    label: 'Heat exchanger',
    count: 2,
    img: '/assets/zinc-rods/heat-exchanger.png',
    caption: 'One rod on the water line above the heat-exchanger frame (item 2), one on the water line on the right side of the frame (item 3). (Illustration 60)',
  },
  {
    label: 'Auxiliary water lines (top of engine)',
    count: 2,
    img: '/assets/zinc-rods/aux-water-lines-top.png',
    caption: 'One rod on each auxiliary water line on top of the engine. (Illustration 61, items 4 & 5)',
  },
  {
    label: 'Aftercooler',
    count: 4,
    img: '/assets/zinc-rods/aftercooler.png',
    caption: 'One rod on each side of the FRONT of the aftercooler, one on each side of the REAR. (Illustration 62, items 6, 7, 8, 9)',
  },
  {
    label: 'Auxiliary water line — left side of engine',
    count: 1,
    img: '/assets/zinc-rods/aux-water-line-left.png',
    caption: 'One rod on the auxiliary water line on the left side of the engine. (Illustration 63, item 10)',
  },
]

const TOTAL_PER_ENGINE = LOCATIONS.reduce((s, l) => s + l.count, 0) // 10

interface ZincRodsGuideProps {
  open: boolean
  onClose(): void
}

export function ZincRodsGuide({ open, onClose }: ZincRodsGuideProps) {
  // Close on Esc.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open so the modal scroll is the only scroll.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Zinc rods location and service guide"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* panel */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-2xl max-h-[100dvh] sm:max-h-[90dvh] bg-card border-y sm:border sm:rounded-xl border-border overflow-hidden flex flex-col"
      >
        {/* Sticky header: total count + tools */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-4 pt-3 pb-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Cat C32 — Zinc Rods · Inspect / Replace
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <div className="text-2xl font-bold text-red-400 leading-none">
                {TOTAL_PER_ENGINE}
              </div>
              <div className="text-xs text-muted-foreground">
                zinc rods per engine
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground/90">Tools & consumables:</span>{' '}
              23 mm socket · adjustable wrench · Loctite 242 (US) or Loctite 5926 (Europe) on shoulder ·
              Loctite 536 (or 567 in Turkey) on plug external threads · torque plug to <strong className="text-foreground">27 – 34 N·m</strong>.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full border border-border hover:bg-secondary flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Overview */}
          <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground leading-relaxed">
            Zinc rods sit in the sea-water cooling circuit and sacrifice themselves to
            protect more critical cooling-system parts. Rapid deterioration usually
            indicates a stray-current problem in an improperly grounded electrical
            attachment. Inspect within 24 h of first filling the plumbing with sea
            water; after that, inspect <strong className="text-foreground/90">weekly or every 50 engine hours</strong>{' '}
            and replace when deteriorated or flaking. Tap each rod lightly with a hammer
            after removal — a rod that flakes gets replaced.
          </div>

          {/* Location cards */}
          <div className="space-y-4">
            {LOCATIONS.map(loc => (
              <div key={loc.label} className="rounded-lg border border-border/70 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-background/40 border-b border-border/60">
                  <div className="text-xs font-semibold">{loc.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-red-300 border border-red-500/40 rounded px-1.5 py-0.5">
                    {loc.count} rod{loc.count === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="bg-white">
                  <img
                    src={loc.img}
                    alt={loc.label}
                    className="w-full h-auto object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="px-3 py-2 text-[11px] text-muted-foreground leading-snug">
                  {loc.caption}
                </div>
              </div>
            ))}
          </div>

          {/* Procedure summary */}
          <div className="rounded-lg border border-border/70 p-3 space-y-2">
            <div className="text-xs font-semibold">Replacement procedure</div>
            <ol className="text-[11px] text-muted-foreground list-decimal pl-4 space-y-1">
              <li>Prevent start of both main engines and the generator (isolate start batteries or set ignition to OFF).</li>
              <li>Close the sea-water inlet valve for that engine before pulling any plug.</li>
              <li>Unscrew the old zinc rod (or drill it out of the plug if it snapped). Clean the plug seat.</li>
              <li>
                Apply thread-locker to the <strong className="text-foreground/90">shoulder of the new zinc rod</strong> only —
                Loctite 242 (US) or Loctite 5926 (Europe). Do not apply to any other type of zinc rod.
              </li>
              <li>Thread the new rod into the plug.</li>
              <li>Coat the plug's <strong className="text-foreground/90">external threads</strong> with Loctite 536 (or 567 in Turkey).</li>
              <li>Install the plug and torque to <strong className="text-foreground/90">27 – 34 N·m</strong>.</li>
              <li>Open the sea-water inlet, start the engine, and check for leaks.</li>
            </ol>
            <div className="text-[10px] text-amber-300/90 mt-1">
              ⚠ Never adhesive-lock the plug so it can't be removed later. Consumption depends on nearby chains, metallic hulls/piers, and shore-power isolation quality.
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground text-center pt-1">
            Source: Cat C32 O&amp;M Manual SEBU8775-12, pp. 123-125.
          </div>
        </div>

        {/* Sticky footer close */}
        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
          >
            Close and return
          </button>
        </div>
      </div>
    </div>
  )
}

// Utility: does a checklist item id / label refer to zinc rods?
// The Cat 50h kit uses id="zincs"; keep the check broad enough that a future
// rename or capitalization won't silently break the popup wiring.
export function isZincRodItem(idOrLabel: string): boolean {
  const s = idOrLabel.toLowerCase()
  return s.includes('zinc') || s.includes('anode')
}
