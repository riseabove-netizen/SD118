// Maintenance systems catalog + interval logic.
//
// The maintenance module models each piece of shipboard equipment as a
// "system" (or a system pair, e.g. port/starboard). Each system has:
//   - a stable id used in URLs and Drive folder names
//   - a display label
//   - an emoji icon for the tile grid
//   - a set of "kits" (service intervals) that repeat cumulatively at
//     multiples of the interval hours (e.g. a 250h kit is due at 250, 500,
//     750, 1000 hours, etc.)
//
// The generator kits below come straight from the John Deere 4045SFM85
// Lubrication and Maintenance Records section. Where a "500h" kit is
// specified, we treat it as cumulative so hour 1000 gets 250 + 500, hour
// 2000 gets 250 + 500 + 2000, and so on.
//
// Systems other than the generators are declared with empty kit lists for
// now — the tiles render but no schedule is computed until we fill them in.

export type MaintenanceSystemKind =
  | 'generator'
  | 'main-engine'
  | 'watermaker'
  | 'hamann'
  | 'strainer'
  | 'ac'
  | 'fresh-water-pump'
  | 'grey-black-pump'

export type MaintenanceKitInterval = 'daily' | number // number = hours

export interface MaintenanceChecklistItem {
  id: string
  label: string
  // Optional detail shown as a small caption line under the label — the
  // "how" for each step. Kept short and imperative.
  detail?: string
}

export interface MaintenanceKit {
  id: string // e.g. "250h", "500h", "2000h", "daily"
  interval: MaintenanceKitInterval
  label: string // e.g. "250h / 6 months"
  shortLabel: string // e.g. "250h"
  // The checklist for this kit. Independent of any lower-tier kit — when
  // multiple kits fall due together (e.g. hour 2000 = 250 + 500 + 2000)
  // the perform-maintenance page unions the checklists.
  checklist: MaintenanceChecklistItem[]
}

export interface MaintenanceSystem {
  id: string // e.g. "generator-port"
  parentId: string // grouping id used for Drive folder tree, e.g. "generator"
  kind: MaintenanceSystemKind
  side?: 'port' | 'starboard' | 'top' | 'bottom' | 'left' | 'right' | 'main-port' | 'main-starboard' | 'aux-port' | 'aux-starboard' | 'ac' | 'dc'
  label: string
  driveFolderPath: string[] // e.g. ["Maintenance", "Generator", "Port"]
  icon: string
  kits: MaintenanceKit[]
  // Optional current-hour hint — used only when the system has no
  // recorded log yet, to seed the "current hours" field. For the
  // generators the user told us they are around 1800h in August 2026.
  initialHoursHint?: number
}

// ---------------- Generator kits (John Deere 4045SFM85) ----------------

const GENERATOR_DAILY_KIT: MaintenanceKit = {
  id: 'daily',
  interval: 'daily',
  label: 'Daily prestart',
  shortLabel: 'Daily',
  checklist: [
    { id: 'load-test', label: 'Operate at 50–70% load for 30 min (every 2 weeks)', detail: 'Generator sets only. Load-test at rated speed.' },
    { id: 'belts', label: 'Check accessory drive belts' },
    { id: 'water-separator-drain', label: 'Drain water from fuel filters' },
    { id: 'oil-level', label: 'Check engine oil level' },
    { id: 'coolant-level', label: 'Check coolant level' },
    { id: 'fuel-return-shutoff', label: 'Open fuel return shutoff valve if equipped and verify return lines are free' },
    { id: 'sea-strainer', label: 'Check sea-water pump and strainer' },
    { id: 'wiring', label: 'Inspect wiring harness and fuses' },
    { id: 'aftercooler-drain', label: 'Check aftercooler condensate drain (if equipped)' },
    { id: 'air-cleaner', label: 'Check air cleaner dust unloader valve and air filter restriction indicator' },
    { id: 'intake', label: 'Check air intake system' },
    { id: 'walkaround', label: 'Visual walkaround inspection' },
  ],
}

const GENERATOR_250H_KIT: MaintenanceKit = {
  id: '250h',
  interval: 250,
  label: '250h / 6 months',
  shortLabel: '250h',
  checklist: [
    { id: 'oil-and-filter', label: 'Change engine oil and replace oil filter', detail: 'Requires 18 L / 19 qt of 15W‑40 engine oil. Deere 4045SFM85 filter element. Hand-tighten only; do not add 3/4–1-1/4 turn after gasket contact.' },
    { id: 'oil-drain-torque', label: 'Torque oil pan drain plug to spec', detail: '70 N·m (52 lb-ft) copper washer, or 50 N·m (37 lb-ft) O-ring.' },
    { id: 'air-cleaner-filter', label: 'Service air-cleaner filter element (4045SFM85)' },
    { id: 'fire-extinguisher', label: 'Service fire extinguisher' },
    { id: 'battery', label: 'Service battery' },
    { id: 'mounts', label: 'Check engine mounts' },
    { id: 'zincs', label: 'Inspect and replace zinc plugs (if equipped)' },
  ],
}

const GENERATOR_500H_KIT: MaintenanceKit = {
  id: '500h',
  interval: 500,
  label: '500h / 12 months',
  shortLabel: '500h',
  checklist: [
    { id: 'crankcase-vent', label: 'Replace crankcase vent filter' },
    { id: 'air-intake-clean', label: 'Clean air intake system' },
    { id: 'fuel-filter', label: 'Replace fuel filter element and clean water-separator bowl' },
    { id: 'belt-tensioner', label: 'Check automatic belt tensioner and belt wear' },
    { id: 'cooling-system', label: 'Check cooling system' },
    { id: 'pressure-test-cooling', label: 'Pressure test cooling system' },
    { id: 'heat-exchanger', label: 'Service heat-exchanger core (if equipped)' },
    { id: 'aftercooler-core', label: 'Service seawater aftercooler core (if equipped)' },
    { id: 'engine-speeds', label: 'Check and adjust engine speeds' },
    { id: 'ground-connections', label: 'Check engine electrical ground connections' },
    { id: 'impeller', label: 'Replace seawater pump impeller' },
  ],
}

const GENERATOR_2000H_KIT: MaintenanceKit = {
  id: '2000h',
  interval: 2000,
  label: '2000h / 24 months',
  shortLabel: '2000h',
  checklist: [
    { id: 'valve-clearance', label: 'Check and adjust engine valve clearance' },
    { id: 'crank-damper', label: 'Check crankshaft vibration damper' },
    { id: 'seawater-pump', label: 'Overhaul sea-water pump' },
  ],
}

const GENERATOR_KITS: MaintenanceKit[] = [
  GENERATOR_DAILY_KIT,
  GENERATOR_250H_KIT,
  GENERATOR_500H_KIT,
  GENERATOR_2000H_KIT,
]

// ---------------- System catalog ----------------

export const MAINTENANCE_SYSTEMS: MaintenanceSystem[] = [
  {
    id: 'generator-port',
    parentId: 'generator',
    kind: 'generator',
    side: 'port',
    label: 'Generator — Port',
    driveFolderPath: ['Maintenance', 'Generator', 'Port'],
    icon: '⚡',
    kits: GENERATOR_KITS,
    initialHoursHint: 1800,
  },
  {
    id: 'generator-starboard',
    parentId: 'generator',
    kind: 'generator',
    side: 'starboard',
    label: 'Generator — Starboard',
    driveFolderPath: ['Maintenance', 'Generator', 'Starboard'],
    icon: '⚡',
    kits: GENERATOR_KITS,
    initialHoursHint: 1800,
  },
  {
    id: 'main-engine-port',
    parentId: 'main-engine',
    kind: 'main-engine',
    side: 'port',
    label: 'Main engine — Port',
    driveFolderPath: ['Maintenance', 'Main Engine', 'Port'],
    icon: '🛠️',
    kits: [],
  },
  {
    id: 'main-engine-starboard',
    parentId: 'main-engine',
    kind: 'main-engine',
    side: 'starboard',
    label: 'Main engine — Starboard',
    driveFolderPath: ['Maintenance', 'Main Engine', 'Starboard'],
    icon: '🛠️',
    kits: [],
  },
  {
    id: 'watermaker-top',
    parentId: 'watermaker',
    kind: 'watermaker',
    side: 'top',
    label: 'Watermaker — Top',
    driveFolderPath: ['Maintenance', 'Watermaker', 'Top'],
    icon: '💧',
    kits: [],
  },
  {
    id: 'watermaker-bottom',
    parentId: 'watermaker',
    kind: 'watermaker',
    side: 'bottom',
    label: 'Watermaker — Bottom',
    driveFolderPath: ['Maintenance', 'Watermaker', 'Bottom'],
    icon: '💧',
    kits: [],
  },
  {
    id: 'hamann',
    parentId: 'hamann',
    kind: 'hamann',
    label: 'Hamann sewage system',
    driveFolderPath: ['Maintenance', 'Hamann'],
    icon: '♻️',
    kits: [],
  },
  {
    id: 'strainer-main-port',
    parentId: 'strainer',
    kind: 'strainer',
    side: 'main-port',
    label: 'Strainer basket — Main Port',
    driveFolderPath: ['Maintenance', 'Strainer Baskets', 'Main Port'],
    icon: '🕸️',
    kits: [],
  },
  {
    id: 'strainer-main-starboard',
    parentId: 'strainer',
    kind: 'strainer',
    side: 'main-starboard',
    label: 'Strainer basket — Main Starboard',
    driveFolderPath: ['Maintenance', 'Strainer Baskets', 'Main Starboard'],
    icon: '🕸️',
    kits: [],
  },
  {
    id: 'strainer-aux-port',
    parentId: 'strainer',
    kind: 'strainer',
    side: 'aux-port',
    label: 'Strainer basket — Aux Port',
    driveFolderPath: ['Maintenance', 'Strainer Baskets', 'Aux Port'],
    icon: '🕸️',
    kits: [],
  },
  {
    id: 'strainer-aux-starboard',
    parentId: 'strainer',
    kind: 'strainer',
    side: 'aux-starboard',
    label: 'Strainer basket — Aux Starboard',
    driveFolderPath: ['Maintenance', 'Strainer Baskets', 'Aux Starboard'],
    icon: '🕸️',
    kits: [],
  },
  {
    id: 'ac',
    parentId: 'ac',
    kind: 'ac',
    label: 'Air conditioning',
    driveFolderPath: ['Maintenance', 'Air Conditioning'],
    icon: '❄️',
    kits: [],
  },
  // Fresh-water pumps (AC / DC) now live inside the consolidated
  // "Fresh Water System" calendar tile alongside the tank, UV lamps and
  // silver-ion doser, so they're intentionally omitted from this list.
  {
    id: 'grey-black-pump-left',
    parentId: 'grey-black-pump',
    kind: 'grey-black-pump',
    side: 'left',
    label: 'Grey/black-water pump — Left',
    driveFolderPath: ['Maintenance', 'Grey Black Water Pumps', 'Left'],
    icon: '🕳️',
    kits: [],
  },
  {
    id: 'grey-black-pump-right',
    parentId: 'grey-black-pump',
    kind: 'grey-black-pump',
    side: 'right',
    label: 'Grey/black-water pump — Right',
    driveFolderPath: ['Maintenance', 'Grey Black Water Pumps', 'Right'],
    icon: '🕳️',
    kits: [],
  },
]

export function getSystem(id: string): MaintenanceSystem | undefined {
  return MAINTENANCE_SYSTEMS.find(s => s.id === id)
}

// ---------------- Interval math ----------------

export interface KitDueEntry {
  kitId: string
  kit: MaintenanceKit
  dueAtHours: number // when this specific kit's next cycle is due (absolute hours on the meter)
  hoursUntil: number // dueAtHours - currentHours
}

/**
 * For a given system and current hour reading, compute when each kit is
 * next due. Only hour-based kits are returned (daily is excluded — daily
 * is always "due today"). Kits repeat cumulatively at the interval value.
 *
 * Scheduling rule: the next service is exactly `interval` hours after
 * the most recent service. If a service was performed early (e.g. the
 * 250h kit at 3722 h instead of the grid milestone 3750 h), all future
 * cycles offset to that new baseline (next due at 3972 h, then 4222 h,
 * etc.) — we do NOT snap back to the fixed 250/500/1000 grid.
 *
 * If nothing has ever been logged for this kit, we assume the last
 * service happened at the nearest grid milestone at or below the
 * current meter (a reasonable default before backfill).
 */
export function computeKitSchedule(
  system: MaintenanceSystem,
  currentHours: number,
  lastServiceHoursByKit: Record<string, number> = {}
): KitDueEntry[] {
  const entries: KitDueEntry[] = []
  for (const kit of system.kits) {
    if (kit.interval === 'daily') continue
    const step = kit.interval
    if (!step || step <= 0) continue
    const lastDone = lastServiceHoursByKit[kit.id]
    let dueAt: number
    if (typeof lastDone === 'number' && lastDone > 0) {
      // Reset counting from the last real service.
      dueAt = lastDone + step
      // If the meter has already run past several cycles without a
      // fresh log, roll forward to the current cycle so "hoursUntil"
      // stays meaningful (still keyed off the last-known service).
      while (dueAt <= currentHours) dueAt += step
    } else {
      // Nothing recorded — assume most recent service happened at the
      // nearest lower grid multiple, so the next one is one step above.
      dueAt = Math.floor(currentHours / step) * step + step
    }
    entries.push({
      kitId: kit.id,
      kit,
      dueAtHours: dueAt,
      hoursUntil: dueAt - currentHours,
    })
  }
  entries.sort((a, b) => a.dueAtHours - b.dueAtHours)
  return entries
}

/**
 * The nearest upcoming service milestone. When multiple kits fall on the
 * same absolute hour (e.g. 2000 = 250 + 500 + 2000), they are grouped
 * together — the returned entry lists every kit due at that milestone.
 */
export interface NextDueMilestone {
  dueAtHours: number
  hoursUntil: number
  kits: MaintenanceKit[]
}

export function nextDueMilestone(
  system: MaintenanceSystem,
  currentHours: number,
  lastServiceHoursByKit: Record<string, number> = {}
): NextDueMilestone | null {
  const schedule = computeKitSchedule(system, currentHours, lastServiceHoursByKit)
  if (schedule.length === 0) return null
  const soonest = schedule[0].dueAtHours
  const kits = schedule.filter(e => e.dueAtHours === soonest).map(e => e.kit)
  return {
    dueAtHours: soonest,
    hoursUntil: soonest - currentHours,
    kits,
  }
}

/**
 * Same shape as nextDueMilestone but returns the N soonest milestones,
 * used by the detail page to render a "coming up" list.
 */
export function upcomingMilestones(
  system: MaintenanceSystem,
  currentHours: number,
  lastServiceHoursByKit: Record<string, number> = {},
  n: number = 5
): NextDueMilestone[] {
  const schedule = computeKitSchedule(system, currentHours, lastServiceHoursByKit)
  const grouped = new Map<number, MaintenanceKit[]>()
  for (const e of schedule) {
    const list = grouped.get(e.dueAtHours) || []
    list.push(e.kit)
    grouped.set(e.dueAtHours, list)
  }
  const milestones: NextDueMilestone[] = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map(([dueAt, kits]) => ({
      dueAtHours: dueAt,
      hoursUntil: dueAt - currentHours,
      kits,
    }))
  return milestones
}

/**
 * Given a set of kit IDs (e.g. because they all fall due together), return
 * the deduped union of every checklist item, prefixed with the kit label
 * that owns it so the perform-maintenance UI can group them.
 */
export interface UnifiedChecklistItem extends MaintenanceChecklistItem {
  kitId: string
  kitShortLabel: string
}

export function unionChecklists(
  system: MaintenanceSystem,
  kitIds: string[]
): UnifiedChecklistItem[] {
  const out: UnifiedChecklistItem[] = []
  const seen = new Set<string>()
  for (const kit of system.kits) {
    if (!kitIds.includes(kit.id)) continue
    for (const item of kit.checklist) {
      const key = `${kit.id}:${item.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ...item, kitId: kit.id, kitShortLabel: kit.shortLabel })
    }
  }
  return out
}

/**
 * Format a hours-until value as a compact badge string.
 * Positive = still upcoming, negative = overdue.
 */
export function formatHoursUntil(hoursUntil: number): string {
  if (hoursUntil <= 0) return `overdue by ${Math.abs(hoursUntil)} h`
  if (hoursUntil < 1) return `< 1 h`
  return `${hoursUntil} h to go`
}

/**
 * Colour tier for the "next due" badge. green > 100h, amber 25–100h, red < 25h or overdue.
 */
export function dueTier(hoursUntil: number): 'green' | 'amber' | 'red' {
  if (hoursUntil <= 25) return 'red'
  if (hoursUntil <= 100) return 'amber'
  return 'green'
}
