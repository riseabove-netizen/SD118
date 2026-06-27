// M/Y Rise Above — Watch Duties checklist (transcribed from the printed form).
//
// One DutySection per time-block on the form. Each item has a stable `id`
// so completion state can be persisted reliably even if the wording changes
// in a later revision.

export type WatchDutyItem = {
  id: string
  label: string
  /** Optional context shown smaller under the main label. */
  note?: string
}

export type WatchDutySection = {
  id: string
  /** Time-block label printed in the left column (e.g. "07:45 – 08:00"). */
  time: string
  /** Header line printed in the right column (often blank, or a title like "UNLOCK DOORS …"). */
  title?: string
  /** Sub-time printed under the time, e.g. "SUNSET". */
  subtime?: string
  items: WatchDutyItem[]
  /** True when this block ends with a signature line on the printed form. */
  signoff?: boolean
  /** Label for the signoff range, e.g. "08:00 – 10:00". */
  signoffRange?: string
}

export const WATCH_DUTY_SECTIONS: WatchDutySection[] = [
  {
    id: 'morning',
    time: '07:45 – 08:00',
    title: 'Unlock doors — crew door, port and STB bridge doors (week days only)',
    items: [
      { id: 'm1', label: 'Complete a full walk through of ALL areas of vessel INTERIOR AND DECK.' },
      { id: 'm2', label: 'Check Fridges and Freezer temps and fill in Fridge Log, TO BE DONE EVERY ROUND.' },
      { id: 'm3', label: 'Check Engineroom and report anything out of the ordinary to the Engineer.' },
      { id: 'm4', label: 'Check lines, fenders and gangway.' },
      { id: 'm5', label: 'Interior — Please make sure dishwasher is turned on if empty, not loaded before lunch.' },
      { id: 'm6', label: 'Turn off Exterior Lights.' },
      { id: 'm7', label: 'Bridge External Light Panel — Wheel house Panel.' },
      { id: 'm8', label: 'Put the Flag up — SUNDECK.' },
    ],
    signoff: true,
    signoffRange: '08:00 – 10:00',
  },
  {
    id: 'midday',
    time: '12:00',
    items: [
      { id: 'l1', label: 'Interior — Please assist the chef in setting up for lunch.' },
      { id: 'l2', label: 'Complete Round — Check lines, fenders and gangway.' },
      { id: 'l3', label: 'CREW ON WATCH — Pack away after lunch, food in tupperwares, crew mess cleaned up.' },
      { id: 'l4', label: 'Complete Full Round.' },
    ],
    signoff: true,
    signoffRange: '12:00 – 14:00',
  },
  {
    id: 'afternoon',
    time: '17:00',
    items: [
      { id: 'a1', label: 'Complete full round. Check lines, fenders and gangway.' },
      {
        id: 'a2',
        label:
          'Lock all exterior doors but leave the crew door until 21:00. This should be completed as soon as the working day has come to a close.',
      },
      { id: 'a3', label: 'Initial Watch Log in the bridge.' },
    ],
  },
  {
    id: 'sunset',
    time: '17:00',
    subtime: 'SUNSET',
    title: 'Set up for crew dinner (mats, food, plates, cutlery, condiments etc.)',
    items: [
      { id: 's1', label: '20 minutes before Sunset — Exterior lights turned on.' },
      { id: 's2', label: 'Bridge External Light Panel (Marked).' },
      { id: 's3', label: 'Take Flag down at Sunset (GOOGLE THE TIME).' },
      {
        id: 's4',
        label:
          'All lights in the interior guest areas must be switched off except corridors and ensure that all the interior doors are closed.',
      },
    ],
  },
  {
    id: 'evening',
    time: '18:00',
    items: [
      { id: 'e1', label: 'Put all food away in Tupperware, in Galley fridge (food to be thrown away in CM bins only).' },
      { id: 'e2', label: 'Wash dishes, if you use Galley dishwasher, dry and put away.' },
      { id: 'e3', label: 'Wipe down all surfaces in Crew Mess. Hoover floor and wipe down seats if necessary.' },
    ],
  },
  {
    id: 'before-bed',
    time: 'Before you retire for the night',
    items: [
      { id: 'b1', label: 'Clean and refill coffee machine.' },
      { id: 'b2', label: 'Restock fridges and crew mess water.' },
      { id: 'b3', label: 'Empty all Crew Mess rubbish bins and place in dock bins.' },
      { id: 'b4', label: 'Unpack dishwasher when cycle finished and put all dishes away.' },
    ],
  },
  {
    id: 'night',
    time: '21:00',
    items: [
      { id: 'n1', label: 'Check lines, fenders and gangway and complete final security round & re-check exterior doors.' },
      { id: 'n2', label: 'Carry Crew UHF radio left during the night while on watch in case of early hours emergency.' },
    ],
  },
]

export const WATCH_DUTIES_REMINDERS: string[] = [
  'You are responsible for the Safety & Security of the vessel on your watch day. Make sure duties are carried out diligently and on time. Pay close attention to weather changes and alert the Chief Officer / Captain with any concerns regarding Safety or Security of the vessel.',
  'Inform owner at all times and carry your radio with you. After work hours you need to be monitoring CCTV, phone calls and alarms.',
  'No drinking during, or 6 hrs prior to your watch. Make sure you are 100% fit for duty on your watch day.',
  'Watches may only be swapped with prior approval of the Chief Officer or Captain.',
]

/** YYYY-MM-DD in the user's LOCAL timezone (matches the "resets at midnight" requirement). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function allItemIds(): string[] {
  return WATCH_DUTY_SECTIONS.flatMap(s => s.items.map(i => i.id))
}

export type WatchDutyState = {
  /** Local YYYY-MM-DD — used as the spreadsheet row id. */
  date: string
  /** Crew member on duty (free text, defaults to current crew name). */
  crewOnDuty: string
  /** Watch handover to (free text). */
  handoverTo: string
  /** Map of item id → boolean checked. */
  checks: Record<string, boolean>
  /** Map of section id → comments string. */
  sectionComments: Record<string, string>
  /** General comments at the bottom. */
  generalComments: string
  /** Signoff signatures keyed by section id (e.g. 'morning', 'midday'). */
  signoffs: Record<string, { name: string; time: string }>
  /** Handover signature (printed bottom-left). */
  handoverSignature: { name: string; time: string }
  /** Receipt signature (printed bottom-right). */
  receiptSignature: { name: string; time: string }
  /** When finalized, the Drive PDF URL. */
  pdfLink?: string
  /** ISO timestamp of finalize. */
  finalizedAt?: string
}

export function emptyState(date: string, crewName?: string): WatchDutyState {
  return {
    date,
    crewOnDuty: crewName || '',
    handoverTo: '',
    checks: {},
    sectionComments: {},
    generalComments: '',
    signoffs: {},
    handoverSignature: { name: '', time: '' },
    receiptSignature: { name: '', time: '' },
  }
}
