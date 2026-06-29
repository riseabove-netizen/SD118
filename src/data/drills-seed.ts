export const DRILLS_GUIDE_ID = 'DRILLS-TESTING'

export const DRILLS_SEED_INTRO = `Mandatory drills and training are to be carried out onboard. Fire and abandon ship drill are to be carried out at fortnightly intervals.

Monthly training is to be carried out simulating various emergency events.

These include but are not limited to:`

export const DRILLS_SEED_EVENTS: string[] = [
  'Critical plant failure',
  'Collision',
  'Grounding',
  'Fire',
  'Man overboard',
  'Heavy weather',
  'Steering failure',
]

export interface TestRow {
  description: string
  scale: string
}

export const DRILLS_SEED_TESTS: TestRow[] = [
  { description: 'Fuel quick closing valve',             scale: 'Weekly' },
  { description: 'Fire (smoke / heat / gas) detectors',  scale: 'Three months' },
  { description: 'Fire dampers',                         scale: 'Weekly' },
  { description: 'Bilge pumps and high level water alarms', scale: 'Weekly' },
  { description: 'Emergency lighting / flash lights',    scale: 'Weekly' },
  { description: 'Emergency fire pump',                  scale: 'Weekly' },
  { description: 'Emergency steering',                   scale: 'Three months' },
]

export const DRILLS_SEED_OUTRO = `The EPIRB and fire extinguishers (fix and portable) are to be tested annually by an approved service station and test report / certificates kept onboard.`

export interface DrillsData {
  intro: string
  events: string[]
  tests: TestRow[]
  outro: string
}

export const DRILLS_SEED: DrillsData = {
  intro: DRILLS_SEED_INTRO,
  events: DRILLS_SEED_EVENTS,
  tests: DRILLS_SEED_TESTS,
  outro: DRILLS_SEED_OUTRO,
}
