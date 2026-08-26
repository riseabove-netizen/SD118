// Destination catalog for the Admin → Notifications page.
//
// Structured as top-level menus (Schedule, ISM, Maintenance, Running Log,
// Anchor Watch, App) with nested sub-pages so admins can compose a deep link
// with two dropdowns (menu → sub-page) instead of typing a raw path.
//
// The lists here are derived from:
//   • src/App.tsx route table
//   • src/data/trips.ts (itinerary chapters)
//   • src/data/forms-catalog.ts (ISM operating + emergency procedures)
//   • src/data/maintenance-systems.ts + calendar-systems.ts
//
// When any of those files gain new entries, add the matching option below so
// the notification picker stays in sync. The picker also falls back to a
// custom-URL input, so unlisted paths remain reachable.

import { TRIPS } from '@/data/trips'
import { FORMS_CATALOG } from '@/data/forms-catalog'
import { MAINTENANCE_SYSTEMS } from '@/data/maintenance-systems'

export interface DestinationOption {
  /** Short label shown inside the sub-page dropdown. */
  label: string
  /** In-app path the notification opens. */
  value: string
  /** Optional grouping label rendered inside the dropdown (e.g. "Operating"). */
  group?: string
}

export interface DestinationMenu {
  /** Stable id used by the picker to switch sub-lists. */
  id: string
  /** Label shown in the top-level menu dropdown. */
  label: string
  /** Path opened when the admin picks the menu itself (no sub-page). */
  rootValue: string
  /** Sub-pages beneath the menu. */
  options: DestinationOption[]
}

// Trip chapters, in the order they appear in TRIPS. Cancelled chapters are
// still included (crew may want to reference the cancelled itinerary) but
// prefixed with the same "CANCELLED —" tag from the trip data.
const scheduleOptions: DestinationOption[] = [
  { label: 'Schedule hub', value: '/schedule' },
  { label: 'Calendar view', value: '/schedule/calendar' },
  {
    label: "Enrico's Attempt at Retirement (summer overview)",
    value: '/schedule/enricos-summer-trip',
  },
  ...TRIPS.map(t => ({
    label: t.name || t.id,
    value: `/schedule/${t.id}`,
    group: 'Itinerary chapters',
  })),
]

// ISM lists Operating and Emergency procedures under separate groups, then the
// non-form ISM sub-pages that also exist in the router.
const ismOperating = FORMS_CATALOG
  .filter(f => f.formType === 'operating')
  .map(f => ({
    label: f.formName,
    value: `/ism/form/${f.formId}`,
    group: 'Operating procedures',
  }))

const ismEmergency = FORMS_CATALOG
  .filter(f => f.formType === 'emergency')
  .map(f => ({
    label: f.formName,
    value: `/ism/form/${f.formId}`,
    group: 'Emergency procedures',
  }))

const ismOptions: DestinationOption[] = [
  { label: 'ISM hub', value: '/ism' },
  { label: 'Operating procedures list', value: '/ism/operating', group: 'Sections' },
  { label: 'Emergency procedures list', value: '/ism/emergency', group: 'Sections' },
  { label: 'Fire & Safety plan', value: '/ism/fire-safety/plan', group: 'Sections' },
  { label: 'Fire & Safety equipment', value: '/ism/fire-safety/equipment', group: 'Sections' },
  { label: 'Drills — perform', value: '/ism/drills/perform', group: 'Sections' },
  { label: 'Drills — index', value: '/ism/drills', group: 'Sections' },
  { label: 'Safety equipment test', value: '/ism/safety-equipment-test', group: 'Sections' },
  { label: 'Deckhand daily duties', value: '/ism/deckhand-duties', group: 'Sections' },
  ...ismOperating,
  ...ismEmergency,
]

// Maintenance: hub, per-system detail pages, and the two special surfaces
// (AC / Air handlers + Generator sides).
const maintenanceOptions: DestinationOption[] = [
  { label: 'Maintenance hub', value: '/maintenance' },
  { label: 'Perform maintenance (log a service)', value: '/maintenance/perform' },
  ...MAINTENANCE_SYSTEMS.map(s => ({
    label: s.label,
    value: `/maintenance/system/${s.id}`,
    group: 'Equipment',
  })),
  { label: 'Air handlers — overview', value: '/maintenance/air-handlers', group: 'HVAC' },
  { label: 'Generator — Port', value: '/maintenance/generator/port', group: 'Generators' },
  { label: 'Generator — Starboard', value: '/maintenance/generator/starboard', group: 'Generators' },
]

// Running log / engine log flow.
const runlogOptions: DestinationOption[] = [
  { label: 'Upload readings', value: '/runlog/upload' },
  { label: 'Review last extraction', value: '/runlog/review' },
  { label: 'Engine room inspection', value: '/inspection' },
]

// Anchor watch and watchkeeping surfaces.
const watchOptions: DestinationOption[] = [
  { label: 'Anchor watch (current log)', value: '/ism/anchor-watch' },
  { label: 'Watch hub', value: '/watch' },
  { label: 'Watch calendar', value: '/watch/calendar' },
  { label: 'Watch duties (daily)', value: '/watch/duties' },
]

// Everything else the admin might reasonably link to.
const appOptions: DestinationOption[] = [
  { label: 'Main menu', value: '/menu' },
  { label: 'Settings', value: '/settings' },
  { label: 'Expenses', value: '/expenses' },
  { label: 'Inventory hub', value: '/inventory' },
  { label: 'Purchase list', value: '/inventory/purchase-list' },
  { label: 'Operational guides', value: '/guides' },
  { label: 'Vessel manual', value: '/guides/manual' },
]

export const DESTINATION_MENUS: DestinationMenu[] = [
  { id: 'schedule',    label: 'Schedule',       rootValue: '/schedule',      options: scheduleOptions },
  { id: 'ism',         label: 'ISM',            rootValue: '/ism',           options: ismOptions },
  { id: 'maintenance', label: 'Maintenance',    rootValue: '/maintenance',   options: maintenanceOptions },
  { id: 'runlog',      label: 'Running log',    rootValue: '/runlog/upload', options: runlogOptions },
  { id: 'watch',       label: 'Anchor / Watch', rootValue: '/ism/anchor-watch', options: watchOptions },
  { id: 'app',         label: 'App',            rootValue: '/menu',          options: appOptions },
]

/**
 * Given a stored URL, figure out which menu it belongs to so the picker can
 * re-hydrate to the same selection when opening a draft.
 */
export function findMenuForUrl(url: string): { menuId: string; value: string } | null {
  if (!url) return null
  // Prefer the longest matching option value to disambiguate nested paths.
  let best: { menuId: string; value: string; len: number } | null = null
  for (const menu of DESTINATION_MENUS) {
    for (const opt of menu.options) {
      if (url === opt.value && (!best || opt.value.length > best.len)) {
        best = { menuId: menu.id, value: opt.value, len: opt.value.length }
      }
    }
    if (url === menu.rootValue && (!best || menu.rootValue.length > (best?.len ?? 0))) {
      best = { menuId: menu.id, value: menu.rootValue, len: menu.rootValue.length }
    }
  }
  return best ? { menuId: best.menuId, value: best.value } : null
}
