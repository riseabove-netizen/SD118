// Unified picker catalog for the "Perform maintenance → Custom repair" flow.
//
// The maintenance module has two kinds of systems:
//   - hour-based (MAINTENANCE_SYSTEMS): engines, watermakers, generators…
//   - calendar-based (CALENDAR_SYSTEMS): jetski, tender, chillers, tanks…
//
// For a custom / one-off repair the user should be able to pick ANY of them.
// This helper flattens both catalogs into a common "PickerSystem" shape and
// groups them so the UI can render a two-step picker
//   parent (e.g. "Main engine")  ->  child (e.g. "Port" / "Starboard").
//
// The picker deliberately keeps the calendar entries as their own group so
// they slot in cleanly ("Jetski", "Tender", "Fresh water system", etc.)
// alongside the hour-based groups.

import {
  MAINTENANCE_SYSTEMS,
  MaintenanceSystem,
} from './maintenance-systems'
import {
  CALENDAR_SYSTEMS,
  CalendarSystem,
} from './calendar-systems'

export type PickerKind = 'hours' | 'calendar'

export interface PickerSystem {
  // Real backend systemId used by the maintenance-log API. For calendar
  // systems this is the CalendarSystem.id (jetski, tender, …).
  id: string
  label: string
  icon: string
  kind: PickerKind
  // For hour-based systems: the same driveFolderPath as MaintenanceSystem.
  // For calendar systems we synthesize one under Maintenance/<Label>/.
  driveFolderPath: string[]
  // Optional side/sub-component label. Blank when the system is atomic.
  sideLabel?: string
}

export interface PickerGroup {
  parentId: string   // stable id used for group key
  label: string      // group heading, e.g. "Main engine", "Watermaker", "Jetski"
  icon: string
  systems: PickerSystem[]  // one entry when atomic, 2+ when the group has sides
}

// Human labels for parentId groups — falls back to the parentId if missing.
const PARENT_LABEL: Record<string, string> = {
  'generator': 'Generator',
  'main-engine': 'Main engine',
  'watermaker': 'Watermaker',
  'hamann': 'Hamann sewage system',
  'strainer': 'Strainer',
  'ac': 'Air conditioning',
  'fresh-water-pump': 'Fresh water pump',
  'grey-black-pump': 'Grey/black-water pump',
}

// Nice side labels, e.g. "Port" instead of "port".
function sideLabel(side?: string): string | undefined {
  if (!side) return undefined
  switch (side) {
    case 'port': return 'Port'
    case 'starboard': return 'Starboard'
    case 'top': return 'Top'
    case 'bottom': return 'Bottom'
    case 'left': return 'Left'
    case 'right': return 'Right'
    case 'ac': return 'AC'
    case 'dc': return 'DC'
    case 'main-port': return 'Main — Port'
    case 'main-starboard': return 'Main — Starboard'
    case 'aux-port': return 'Aux — Port'
    case 'aux-starboard': return 'Aux — Starboard'
    default: return side
  }
}

function toHoursGroup(parentId: string, list: MaintenanceSystem[]): PickerGroup {
  return {
    parentId,
    label: PARENT_LABEL[parentId] || parentId,
    icon: list[0]?.icon || '🛠️',
    systems: list.map(s => ({
      id: s.id,
      label: s.label,
      icon: s.icon,
      kind: 'hours' as const,
      driveFolderPath: s.driveFolderPath,
      sideLabel: sideLabel(s.side),
    })),
  }
}

function toCalendarGroup(sys: CalendarSystem): PickerGroup {
  // Calendar systems each become their own group. When they have multiple
  // units, expose those units as pickable sides so e.g. "AC Chillers →
  // Lower unit / Upper unit" works exactly like hour-based sides.
  const units = sys.units.length > 0 ? sys.units : [{ id: sys.id, label: sys.label }]
  return {
    parentId: `calendar:${sys.id}`,
    label: sys.label,
    icon: sys.tileEmoji || '🗓️',
    systems: units.map(u => ({
      // Encode unit in the id so the log carries it, e.g. "jetski#jetski",
      // "ac-chillers#lower". The server treats this as an opaque systemId
      // so it survives round-trip; the picker splits on '#' for display.
      id: units.length === 1 && u.id === sys.id ? sys.id : `${sys.id}#${u.id}`,
      label: units.length === 1 ? sys.label : `${sys.label} — ${u.label}`,
      icon: sys.tileEmoji || '🗓️',
      kind: 'calendar' as const,
      driveFolderPath: ['Maintenance', sys.label, ...(units.length > 1 ? [u.label] : [])],
      sideLabel: units.length === 1 ? undefined : u.label,
    })),
  }
}

/**
 * Build the grouped picker catalog. Includes:
 *   - every MAINTENANCE_SYSTEMS entry (grouped by parentId)
 *   - every CALENDAR_SYSTEMS entry (one group per system)
 */
export function buildCustomPickerGroups(): PickerGroup[] {
  const groups: PickerGroup[] = []

  // Group hour-based systems by parentId, preserving catalog order.
  const seen = new Set<string>()
  const byParent: Record<string, MaintenanceSystem[]> = {}
  const order: string[] = []
  for (const s of MAINTENANCE_SYSTEMS) {
    if (!byParent[s.parentId]) { byParent[s.parentId] = []; order.push(s.parentId) }
    byParent[s.parentId].push(s)
  }
  for (const pid of order) {
    groups.push(toHoursGroup(pid, byParent[pid]))
    seen.add(pid)
  }

  // Then every calendar system, each in its own group.
  for (const cs of CALENDAR_SYSTEMS) {
    groups.push(toCalendarGroup(cs))
  }

  return groups
}

/**
 * Look up a PickerSystem by its (possibly compound) id — used when the
 * page loads with ?systemId=... from a per-system detail page.
 */
export function findPickerSystem(id: string): PickerSystem | undefined {
  for (const g of buildCustomPickerGroups()) {
    const hit = g.systems.find(s => s.id === id)
    if (hit) return hit
  }
  return undefined
}
