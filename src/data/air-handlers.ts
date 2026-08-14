// Air handler unit catalog and shared service checklist.
//
// M/Y Rise Above HVAC layout — every unit shares the same monthly service
// checklist. Grouping (Guest / Crew) drives the two Perform pages so the
// user can service a whole zone in one go without wading through the
// entire vessel list.

export interface AirHandlerUnit {
  id: string
  label: string
  zone: 'guest' | 'crew'
  group?: string // sub-group label for UI (e.g. "Salon", "Bridge deck")
}

export const AIR_HANDLERS: AirHandlerUnit[] = [
  // ---- Guest ----
  { id: 'salon-port-fwd',        label: 'Salon — Port Forward',        zone: 'guest', group: 'Salon' },
  { id: 'salon-stbd-fwd',        label: 'Salon — Starboard Forward',   zone: 'guest', group: 'Salon' },
  { id: 'salon-aft-port',        label: 'Salon — Aft Port',            zone: 'guest', group: 'Salon' },
  { id: 'guest-port-fwd',        label: 'Guest Port Forward',          zone: 'guest', group: 'Guest cabins' },
  { id: 'guest-port-aft',        label: 'Guest Port Aft',              zone: 'guest', group: 'Guest cabins' },
  { id: 'guest-stbd-fwd',        label: 'Guest STBD Forward',          zone: 'guest', group: 'Guest cabins' },
  { id: 'guest-stbd-aft',        label: 'Guest STBD Aft',              zone: 'guest', group: 'Guest cabins' },
  { id: 'master-port',           label: 'Master — Port AHU',           zone: 'guest', group: 'Master' },
  { id: 'master-stbd',           label: 'Master — Starboard AHU',      zone: 'guest', group: 'Master' },
  { id: 'bridge-deck-port',      label: 'Bridge Deck — Port',          zone: 'guest', group: 'Bridge deck' },
  { id: 'bridge-deck-stbd',      label: 'Bridge Deck — Starboard',     zone: 'guest', group: 'Bridge deck' },

  // ---- Crew ----
  { id: 'bridge-port',           label: 'Bridge — Port',               zone: 'crew',  group: 'Bridge' },
  { id: 'bridge-stbd',           label: 'Bridge — Starboard',          zone: 'crew',  group: 'Bridge' },
  { id: 'bridge-uta-port',       label: 'Bridge — UTA Port',           zone: 'crew',  group: 'Bridge' },
  { id: 'bridge-uta-stbd',       label: 'Bridge — UTA Starboard',      zone: 'crew',  group: 'Bridge' },
  { id: 'bridge-crew-stairs',    label: 'Bridge crew stairs',          zone: 'crew',  group: 'Crew accommodations' },
  { id: 'galley',                label: 'Galley',                      zone: 'crew',  group: 'Crew accommodations' },
  { id: 'crew-mess',             label: 'Crew mess',                   zone: 'crew',  group: 'Crew accommodations' },
  { id: 'crew-port-aft',         label: 'Port Aft crew cabin',         zone: 'crew',  group: 'Crew cabins' },
  { id: 'crew-port-fwd',         label: 'Port Forward crew cabin',     zone: 'crew',  group: 'Crew cabins' },
  { id: 'captain-cabin',         label: 'Captain cabin',               zone: 'crew',  group: 'Crew cabins' },
  { id: 'crew-stbd-fwd',         label: 'STBD Forward cabin',          zone: 'crew',  group: 'Crew cabins' },
  { id: 'av-rack-bridge-deck',   label: 'Bridge Deck AV Rack',         zone: 'crew',  group: 'AV racks' },
  { id: 'av-rack-main-deck',     label: 'Main Deck AV Rack',           zone: 'crew',  group: 'AV racks' },
]

// Shared checklist — same items for every unit.
export const AIR_HANDLER_CHECKLIST: { id: string; label: string; detail?: string }[] = [
  { id: 'filter',        label: 'Clean air filter' },
  { id: 'pan-debris',    label: 'Check pan for debris and liquid' },
  { id: 'pan-drainage',  label: 'Check pan drainage' },
  { id: 'drain-cleaner', label: 'Pour drain cleaner', detail: 'Small dose of enzyme cleaner into the primary drain.' },
  { id: 'chilled-water', label: 'Check chilled-water line for air' },
  { id: 'cooling',       label: 'Confirm unit is properly cooling' },
  { id: 'vents',         label: 'Check vents and clean as necessary' },
]

// Monthly interval — the "due" clock is 30 days from last service.
export const AIR_HANDLER_INTERVAL_DAYS = 30

// Grace period before we flag a unit as "overdue" (red vs amber).
export const AIR_HANDLER_OVERDUE_GRACE_DAYS = 7

export function unitsByZone(zone: 'guest' | 'crew'): AirHandlerUnit[] {
  return AIR_HANDLERS.filter(u => u.zone === zone)
}

export function findUnit(id: string): AirHandlerUnit | undefined {
  return AIR_HANDLERS.find(u => u.id === id)
}
