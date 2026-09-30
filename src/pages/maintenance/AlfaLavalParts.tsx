// Alfa Laval MIB 303 — parts list with assembly drawing.
// URL: /maintenance/alfa-laval/parts

import React, { useState } from 'react'
import { MenuLayout } from '@/components/MenuLayout'
import { MIB303_PART_GROUPS } from '@/data/alfa-laval-mib303'

export function AlfaLavalPartsPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)

  function copy(no: string) {
    navigator.clipboard?.writeText(no).then(() => {
      setCopied(no)
      setTimeout(() => setCopied(c => (c === no ? null : c)), 1500)
    }).catch(() => {})
  }

  return (
    <MenuLayout title="MIB 303 · Parts list" showBack backHref="/maintenance/calendar/alfa-laval-mib303">
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Assembly drawing</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">MIB 303 AC · Ref. 9000768 Rev. 1</div>
          </div>
          <button type="button" onClick={() => setZoom(true)} className="block w-full rounded-md overflow-hidden border border-border/60 bg-white">
            <img
              src="/maintenance/alfa-laval/assembly-drawing.jpg"
              alt="MIB 303 assembly drawing: 1 separator, 2 control cabinet, 2.1 junction box, 3 hoses and ancillary kit, 4 system manual"
              className="w-full h-auto"
            />
          </button>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ['1', 'Separator'],
              ['2', 'Control cabinet'],
              ['2.1', 'Junction box'],
              ['3', 'Hoses & ancillary kit'],
              ['4', 'System manual'],
            ].map(([n, l]) => (
              <div key={n} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
                <span className="inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full border border-red-500/60 text-red-300 text-[10px] font-bold">{n}</span>
                <span className="text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-amber-300/90">⚠ Threaded quick-coupling joints are sealed with LOCTITE 542.</div>
        </div>

        {MIB303_PART_GROUPS.map(g => (
          <div key={g.item} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold">{g.item}</span>
              <div className="text-sm font-semibold">{g.title}</div>
            </div>
            <div className="rounded-md border border-border/60 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-background/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-3 py-1.5 font-semibold">Description</th>
                    <th className="text-center px-2 py-1.5 font-semibold w-10">Qty</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Article no.</th>
                  </tr>
                </thead>
                <tbody>
                  {g.parts.map((p, i) => (
                    <tr key={p.articleNo + i} className={i % 2 === 0 ? 'bg-background/20' : ''}>
                      <td className="px-3 py-1.5 border-t border-border/40">
                        {p.description}
                        {p.ref && <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">({p.ref})</span>}
                      </td>
                      <td className="px-2 py-1.5 border-t border-border/40 text-center tabular-nums">{p.qty}</td>
                      <td className="px-3 py-1.5 border-t border-border/40 text-right">
                        <button
                          type="button"
                          onClick={() => copy(p.articleNo)}
                          title="Copy article number"
                          className="font-mono text-foreground hover:text-red-300"
                        >
                          {copied === p.articleNo ? 'copied ✓' : p.articleNo}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">Tap an article number to copy it for ordering.</p>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3" onClick={() => setZoom(false)}>
          <img src="/maintenance/alfa-laval/assembly-drawing.jpg" alt="MIB 303 assembly drawing" className="max-w-full max-h-full object-contain bg-white rounded" />
        </div>
      )}
    </MenuLayout>
  )
}
