// Units that have an Oil Sampling Results page.
// URL: /maintenance/oil-samples/:unitId
//
// Transmissions don't have their own hour meter in the app — they share
// the running hours of the main engine they're coupled to.

export interface OilSampleUnit {
  id: string
  label: string
  hoursSystemId: string   // MaintenanceSystem id used to prefill running hours
  parentSystemId: string  // page to link back to
  driveFolder: string     // Maintenance/Oil Samples/<driveFolder>
}

export const OIL_SAMPLE_UNITS: OilSampleUnit[] = [
  { id: 'generator-port',        label: 'Generator — Port',        hoursSystemId: 'generator-port',        parentSystemId: 'generator-port',        driveFolder: 'Generator Port' },
  { id: 'generator-starboard',   label: 'Generator — Starboard',   hoursSystemId: 'generator-starboard',   parentSystemId: 'generator-starboard',   driveFolder: 'Generator Starboard' },
  { id: 'main-engine-port',      label: 'Main engine — Port',      hoursSystemId: 'main-engine-port',      parentSystemId: 'main-engine-port',      driveFolder: 'Main Engine Port' },
  { id: 'main-engine-starboard', label: 'Main engine — Starboard', hoursSystemId: 'main-engine-starboard', parentSystemId: 'main-engine-starboard', driveFolder: 'Main Engine Starboard' },
  { id: 'transmission-port',      label: 'Transmission — Port',      hoursSystemId: 'main-engine-port',      parentSystemId: 'main-engine-port',      driveFolder: 'Transmission Port' },
  { id: 'transmission-starboard', label: 'Transmission — Starboard', hoursSystemId: 'main-engine-starboard', parentSystemId: 'main-engine-starboard', driveFolder: 'Transmission Starboard' },
]

export function findOilSampleUnit(id: string): OilSampleUnit | undefined {
  return OIL_SAMPLE_UNITS.find(u => u.id === id)
}

export function oilSampleLinksForSystem(systemId: string): { label: string; href: string; icon?: string }[] {
  return OIL_SAMPLE_UNITS
    .filter(u => u.parentSystemId === systemId)
    .map(u => ({
      label: u.id.startsWith('transmission') ? 'Transmission oil samples' : u.id.startsWith('main-engine') ? 'Engine oil samples' : 'Oil sampling results',
      href: `/maintenance/oil-samples/${u.id}`,
      icon: '🧪',
    }))
}
