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
      {
        id: 'seal-kits',
        label: 'Replace seal kits as necessary',
        detail: 'On-condition. Log each replacement to keep a service history.',
        interval: { kind: 'as-needed' },
      },
    ],
  },

  // ------------------------------------------------------------------
  // Strainer baskets — weekly cleaning, monthly zinc anode check
  // ------------------------------------------------------------------
  {
    id: 'strainer-baskets',
    label: 'Strainer Baskets',
    tileEmoji: '🕸️',
    tileBlurb: 'Weekly basket clean · monthly zinc anode check',
    units: [
      { id: 'main-port',      label: 'Main Port',      group: 'Main engines' },
      { id: 'main-starboard', label: 'Main Starboard', group: 'Main engines' },
      { id: 'aux-port',       label: 'Aux Port',       group: 'Auxiliaries' },
      { id: 'aux-starboard',  label: 'Aux Starboard',  group: 'Auxiliaries' },
    ],
    items: [
      {
        id: 'clean-basket',
        label: 'Remove basket and clean',
        detail: 'Weekly. Rinse debris, inspect basket for damage.',
        interval: { kind: 'weekly' },
      },
      {
        id: 'check-anode',
        label: 'Check anode and replace if necessary',
        detail: 'Monthly. Replace if more than ~50% consumed.',
        interval: { kind: 'monthly' },
      },
    ],
  },

  // ------------------------------------------------------------------
  // Tender — yearly/100h engine service, monthly bilge/corrosion,
  // water filter, and biennial/200h pump wear ring
  // ------------------------------------------------------------------
  {
    id: 'tender',
    label: 'Tender',
    tileEmoji: '🛥️',
    tileBlurb: 'Yearly/100h engine service · monthly bilge · wear ring',
    units: [{ id: 'tender', label: 'Tender' }],
    items: [
      {
        id: 'oil-change',
        label: 'Change engine oil',
        detail: 'Yearly or every 100 hours.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'oil-filter',
        label: 'Replace oil filter',
        detail: 'Yearly or every 100 hours, with oil change.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'fuel-filter',
        label: 'Replace fuel filter',
        detail: 'Yearly or every 100 hours.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'anodes',
        label: 'Inspect and replace anodes',
        detail: 'Yearly or every 100 hours.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'bilge-clean',
        label: 'Clean and dry bilges',
        detail: 'Monthly.',
        interval: { kind: 'monthly' },
      },
      {
        id: 'engine-corrosion-t9',
        label: 'Clean corrosion and spray T9 on engine block and mounts',
        detail: 'Monthly.',
        interval: { kind: 'monthly' },
      },
      {
        id: 'water-filter-clean',
        label: 'Clean water filter',
        detail: 'Tender only. Monthly.',
        interval: { kind: 'monthly' },
      },
      {
        id: 'pump-wear-ring',
        label: 'Replace pump wear ring',
        detail: 'Every 2 years or 200 hours.',
        interval: { kind: 'months', every: 24 },
      },
    ],
  },

  // ------------------------------------------------------------------
  // Jetski — same schedule as tender minus the raw-water filter
  // ------------------------------------------------------------------
  {
    id: 'jetski',
    label: 'Jetski',
    tileEmoji: '🛶',
    tileBlurb: 'Yearly/100h engine service · monthly bilge · wear ring',
    units: [{ id: 'jetski', label: 'Jetski' }],
    items: [
      {
        id: 'oil-change',
        label: 'Change engine oil',
        detail: 'Yearly or every 100 hours.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'oil-filter',
        label: 'Replace oil filter',
        detail: 'Yearly or every 100 hours, with oil change.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'fuel-filter',
        label: 'Replace fuel filter',
        detail: 'Yearly or every 100 hours.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'anodes',
        label: 'Inspect and replace anodes',
        detail: 'Yearly or every 100 hours.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-05-15',
      },
      {
        id: 'bilge-clean',
        label: 'Clean and dry bilges',
        detail: 'Monthly.',
        interval: { kind: 'monthly' },
      },
      {
        id: 'engine-corrosion-t9',
        label: 'Clean corrosion and spray T9 on engine block and mounts',
        detail: 'Monthly.',
        interval: { kind: 'monthly' },
      },
      {
        id: 'pump-wear-ring',
        label: 'Replace pump wear ring',
        detail: 'Every 2 years or 200 hours.',
        interval: { kind: 'months', every: 24 },
      },
    ],
  },

  // ------------------------------------------------------------------
  // Hydraulic power pack — yearly oil + oil-filter service
  // ------------------------------------------------------------------
  {
    id: 'hydraulic-power-pack',
    label: 'Hydraulic Power Pack',
    tileEmoji: '🛢️',
    tileBlurb: 'Yearly oil change + oil filter replacement',
    units: [{ id: 'pack', label: 'Hydraulic power pack' }],
    items: [
      {
        id: 'oil-change',
        label: 'Change hydraulic oil',
        detail: 'Drain reservoir, refill with manufacturer-spec hydraulic oil, check for leaks.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-08-01',
      },
      {
        id: 'oil-filter',
        label: 'Replace oil filter',
        detail: 'Replace hydraulic oil filter element.',
        interval: { kind: 'yearly' },
        seedLastDone: '2026-08-01',
      },
    ],
  },

  // ------------------------------------------------------------------
  // Fresh water system — tank + pumps + UV lamps + silver-ion dosing
  //
  // Merged view: what used to be three tiles (Fresh Water System, Fresh
  // Water Tank, Fresh Water Pumps) now lives here, so the crew has one
  // place to see every fresh-water job. The soonest interval bubbles up
  // to the maintenance hub.
  // ------------------------------------------------------------------
  {
    id: 'fresh-water-system',
    label: 'Fresh Water System',
    tileEmoji: '🚰',
    tileBlurb: 'Tank · pumps · UV lamps · silver-ion doser',
    units: [
      { id: 'tank',          label: 'Fresh water tank',        group: 'Tank' },
      { id: 'pump-ac',       label: 'Fresh water pump — AC',   group: 'Pumps' },
      { id: 'pump-dc',       label: 'Fresh water pump — DC',   group: 'Pumps' },
      { id: 'uv-left',       label: 'UV lamp — left',          group: 'UV sterilizer' },
      { id: 'uv-right',      label: 'UV lamp — right',         group: 'UV sterilizer' },
      { id: 'silver-ion',    label: 'Silver-ion dosing pump',  group: 'Silver-ion doser' },
    ],
    items: [
      {
        id: 'tank-test-empty-clean',
        label: 'Test water, empty tank, clean as necessary',
        detail: 'Applies to the tank only. Once per year.',
        interval: { kind: 'yearly' },
        seedLastDone: '2025-11-15',
      },
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
  const isTank = unitId === 'tank'
  const isPump = unitId === 'pump-ac' || unitId === 'pump-dc'
  const isUv   = unitId === 'uv-left' || unitId === 'uv-right'
  const isSilver = unitId === 'silver-ion'
  switch (itemId) {
    case 'tank-test-empty-clean': return isTank
    case 'seal-kit':              return isPump
    case 'motor-replace':         return isPump
    case 'uv-lamp-replace':       return isUv
    case 'silver-ion-refill':     return isSilver
    default: return true
  }
}

export function findSystem(id: string): CalendarSystem | undefined {
  return CALENDAR_SYSTEMS.find(s => s.id === id)
}
