import React from 'react'
import { useLocation } from 'wouter'
import type { EquipmentDataEntry } from '@/data/equipment-data'

// Shared "Equipment data" card used by hour-based and calendar-based
// maintenance system pages. Extra links (oil samples, manuals, parts)
// can be passed in addition to the static entry's own links.
export function EquipmentCard({
  equip,
  extraLinks = [],
}: {
  equip: EquipmentDataEntry
  extraLinks?: { label: string; href: string; icon?: string }[]
}) {
  const [, setLocation] = useLocation()
  const links = [...(equip.links || []), ...extraLinks]
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Equipment data</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">
          {equip.title}
        </div>
      </div>
      {equip.rows.length > 0 && (
        <div className="rounded-md border border-border/60 overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {equip.rows.map((r, i) => (
                <tr key={r.label} className={i % 2 === 0 ? 'bg-background/30' : ''}>
                  <td className="px-3 py-1.5 text-muted-foreground border-b border-border/40 w-1/2">{r.label}</td>
                  <td className="px-3 py-1.5 font-mono text-foreground border-b border-border/40">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {equip.manualUrl && (
        <a
          href={equip.manualUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:underline"
        >
          📖 View service manual
          {equip.manualLabel && <span className="text-muted-foreground"> — {equip.manualLabel}</span>}
          <span aria-hidden>↗</span>
        </a>
      )}
      {equip.procedureGuideId && (
        <a
          href={`/guides/${equip.procedureGuideId}`}
          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:underline"
        >
          📋 {equip.procedureLabel || 'View procedure'}
          <span aria-hidden>→</span>
        </a>
      )}
      {links.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {links.map(l => (
            <button
              key={l.href}
              type="button"
              onClick={() => setLocation(l.href)}
              className="flex items-center justify-between gap-2 rounded-md border border-red-500/40 bg-red-500/5 hover:bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300"
            >
              <span>{l.icon ? `${l.icon} ` : ''}{l.label}</span>
              <span aria-hidden>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
