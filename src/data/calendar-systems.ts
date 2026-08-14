// Calendar-based maintenance systems.
//
// Everything here services on a wall-clock interval (weekly / monthly /
// 6-monthly / yearly / as-needed), not engine hours. Each system has one
// or more physical units and a set of service items. Each item can have
// its own interval AND its own last-performed seed date so we can
// backfill history that predates the app.
//
// The generic status page and Perform page consume this file directly.

export type Interval =
  | { kind: 'weekly' }
  | { kind: 'monthly' }
  | { kind: 'months'; every: number }
  | { kind: 'yearly' }
  | { kind: 'as-needed' } // never flags overdue

export interface CalendarUnit {
  id: string
  label: string
  group?: string
}

export interface CalendarServiceItem {
  id: string
  label: string
  detail?: string
  interval: Interval
  // ISO date (YYYY-MM-DD) of the most recent service prior to app
  // adoption. Used as a fallback when the log has no history for this
  // (unit × item) pair.
  seedLastDone?: string
}

export interface CalendarSystem {
  id: string
  label: string
  tileEmoji: string
  tileBlurb: string
  units: CalendarUnit[]      // must have at least one; use a single "unit" for singletons
  items: CalendarServiceItem[]
}

// ---------- Intervals ----------

export function intervalDays(iv: Interval): number {
  switch (iv.kind) {
    case 'weekly':   return 7
    case 'monthly':  return 30
    case 'months':   return iv.every * 30
    case 'yearly':   return 365
    case 'as-needed': return Infinity
  }
}

export function intervalLabel(iv: Interval): string {
  switch (iv.kind) {
    case 'weekly':    return 'Weekly'
    case 'monthly':   return 'Monthly'
    case 'months':    return `Every ${iv.every} months`
    case 'yearly':    return 'Yearly'
    case 'as-needed': return 'As needed'
  }
}

// ---------- Systems ----------

export const CALENDAR_SYSTEMS: CalendarSystem[] = [
  // ------------------------------------------------------------------
  // Air Conditioning — chiller side, lower & upper unit
  // ------------------------------------------------------------------
  {
    id: 'ac-chillers',
    label: 'AC Chillers',
    tileEmoji: '❄',
    tileBlurb: 'Lower & upper chiller units · pressure + Barnacle Buster',
    units: [
      { id: 'lower', label: 'Lower unit' },
      { id: 'upper', label: 'Upper unit' },
    ],
    items: [
      {
        id: 'chilled-water-pressure',
        label: 'Check chilled-water pressure',
        interval: { kind: 'weekly' },
      },
      {
        id: 'barnacle-buster',
        label: 'Flush with Barnacle Buster to remove growth',
        detail: 'Every 6 months or earlier as necessary.',
        interval: { kind: 'months', every: 6 },
        seedLastDone: '2026-06-28',
      },
    ],
  },

  // ------------------------------------------------------------------
  // Fresh water tank — yearly service
  // ------------------------------------------------------------------
  {
    id: 'fresh-water-tank',
    label: 'Fresh Water Tank',
    tileEmoji: '💧',
    tileBlurb: 'Yearly test / empty / clean',
    units: [{ id: 'tank', label: 'Fresh water tank' }],
    items: [
      {
        id: 'test-empty-clean',
        label: 'Test water, empty tank, clean as necessary',
        detail: 'Once per year.',
        interval: { kind: 'yearly' },
        seedLastDone: '2025-11-15',
      },
    ],
  },

  // ------------------------------------------------------------------
  // Black / Grey water tank — yearly service
  // ------------------------------------------------------------------
  {
    id: 'blackgrey-tank',
    label: 'Black / Grey Water Tank',
    tileEmoji: '🚽',
    tileBlurb: 'Yearly empty / flush / bacteria dose',
    units: [{ id: 'tank', label: 'Black / grey water tank' }],
    items: [
      {
        id: 'empty-flush-bacteria',
        label: 'Empty · fill w/ cleaner · flush · dose with bacteria',
        detail: 'Empty tank, refill with water + cleaner, empty, repeat a couple times, then add water + odor-control bacteria.',
        interval: { kind: 'yearly' },
        seedLastDone: '2025-11-15',
      },
    ],
  },

  // ------------------------------------------------------------------
  // Fresh water system — pumps, UV lamps, silver-ion dosing
  // ------------------------------------------------------------------
  {
    id: 'fresh-water-system',
    label: 'Fresh Water System',
    tileEmoji: '🚰',
    tileBlurb: 'Pumps · UV lamps · silver-ion doser',
    units: [
      { id: 'pump-ac',       label: 'Fresh water pump — AC',   group: 'Pumps' },
      { id: 'pump-dc',       label: 'Fresh water pump — DC',   group: 'Pumps' },
      { id: 'uv-left',       label: 'UV lamp — left',          group: 'UV sterilizer' },
      { id: 'uv-right',      label: 'UV lamp — right',         group: 'UV sterilizer' },
      { id: 'silver-ion',    label: 'Silver-ion dosing pump',  group: 'Silver-ion doser' },
    ],
    items: [
      {
        id: 'seal-kit',
        label: 'Replace seal kit / service pump',
        detail: 'Applies to fresh water pumps only. As necessary.',
        interval: { kind: 'as-needed' },
      },
      {
        id: 'motor-replace',
        label: 'Replace pump motor',
        detail: 'Applies to fresh water pumps only. As necessary.',
        interval: { kind: 'as-needed' },
      },
      {
        id: 'uv-lamp-replace',
        label: 'Replace UV lamp',
        detail: 'Applies to UV lamps (left/right). As necessary.',
        interval: { kind: 'as-needed' },
      },
      {
        id: 'silver-ion-refill',
        label: 'Refill silver-ion reservoir',
        detail: 'Inside crew mess cabinetry. Monthly.',
        interval: { kind: 'monthly' },
        // "3 weeks ago" seed relative to app introduction (Aug 14 2026)
        seedLastDone: '2026-07-24',
      },
    ],
  },
]

// Which items apply to which unit? Some items only apply to certain
// units within a multi-unit system (e.g. UV-lamp replacement doesn't
// apply to a pump). This filter is a hint for the UI; the log itself
// still records exactly what the user picked.
export function itemAppliesToUnit(system: CalendarSystem, itemId: string, unitId: string): boolean {
  if (system.id !== 'fresh-water-system') return true
  const isPump = unitId === 'pump-ac' || unitId === 'pump-dc'
  const isUv   = unitId === 'uv-left' || unitId === 'uv-right'
  const isSilver = unitId === 'silver-ion'
  switch (itemId) {
    case 'seal-kit':          return isPump
    case 'motor-replace':     return isPump
    case 'uv-lamp-replace':   return isUv
    case 'silver-ion-refill': return isSilver
    default: return true
  }
}

export function findSystem(id: string): CalendarSystem | undefined {
  return CALENDAR_SYSTEMS.find(s => s.id === id)
}
