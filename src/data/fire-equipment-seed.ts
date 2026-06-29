// Initial seed values for the Life Saving Equipment list.
// Transcribed from the binder pages (Fire extinguishers, Life Rafts, Flares,
// Line Throwers, Life Jackets, SART, EPIRB, Immersion Suits, Portable VHF,
// Life Buoys, MED KIT) — values can be edited inline by any user, or updated
// in bulk through the Safety Equipment Test workflow.

export interface FireEqRow {
  // Free-form cells. Empty string allowed.
  values: string[]
}

export interface FireEqTable {
  id: string                 // stable section id
  title: string              // visible heading
  category: 'fire' | 'lsa'   // used by the testing flow to group rows
  deck: 'lower' | 'main' | 'upper' | 'sun' | 'all'  // grouping for testing flow
  columns: string[]          // header row labels — last two are always "Pressure" and "Last Checked By"
  rows: FireEqRow[]
}

// Helper to append Pressure + Last Checked By to every row.
function withTestCols(values: string[]): FireEqRow {
  return { values: [...values, '', ''] }
}

const FIRE_BASE_COLS  = ['Location', 'Characteristics', 'Expiry Date', 'Pressure', 'Last Checked By']

export const FIRE_EQUIPMENT_SEED: FireEqTable[] = [
  // ---- Fire extinguishers ----
  {
    id: 'fe-lower',
    title: 'Fire Extinguishers — Lower Deck',
    category: 'fire', deck: 'lower',
    columns: FIRE_BASE_COLS,
    rows: [
      withTestCols(['Crew Cabin PT FWD',   'Powder 2 Kg', '03/23']),
      withTestCols(['Crew Cabin PT AFT',   'Powder 2 Kg', '03/23']),
      withTestCols(['Crew Cabin STB FWD',  'Powder 2 Kg', '03/23']),
      withTestCols(['Crew Cabin STB AFT',  'Powder 2 Kg', '03/23']),
      withTestCols(['Guest Cabin PT FWD',  'Powder 2 Kg', '03/23']),
      withTestCols(['Guest Cabin PT AFT',  'Powder 2 Kg', '03/23']),
      withTestCols(['Guest Cabin STB FWD', 'Powder 2 Kg', '03/23']),
      withTestCols(['Guest Cabin STB AFT', 'Powder 2 Kg', '03/23']),
      withTestCols(['Crew mess cupboard',  'Powder 6 Kg', '03/23']),
      withTestCols(['Under guest staircase', 'Powder 6 Kg', '03/23']),
      withTestCols(['Engine STB',          'Powder 6 Kg', '03/23']),
      withTestCols(['Engine PT',           'Powder 6 Kg', '03/23']),
      withTestCols(['Engine STB',          'Foam 9 L',    '03/23']),
      withTestCols(['Engine PT',           'Foam 9 L',    '03/23']),
      withTestCols(['Engine / garage entrance', 'CO2 9 Kg × 2', '03/23']),
    ],
  },
  {
    id: 'fe-main',
    title: 'Fire Extinguishers — Main Deck',
    category: 'fire', deck: 'main',
    columns: FIRE_BASE_COLS,
    rows: [
      withTestCols(['Emergency Fire Pump',  'Powder 2 Kg', '03/23']),
      withTestCols(['Main saloon',          'Powder 6 Kg', '03/23']),
      withTestCols(['Master cupboard',      'Powder 6 Kg', '03/23']),
      withTestCols(['Galley',               'Foam 9 L',    '03/23']),
      withTestCols(['Main saloon',          'CO2 5 Kg',    '03/23']),
    ],
  },
  {
    id: 'fe-upper',
    title: 'Fire Extinguishers — Upper Deck',
    category: 'fire', deck: 'upper',
    columns: FIRE_BASE_COLS,
    rows: [
      withTestCols(['Under Bar',            'Powder 2 Kg', '03/23']),
      withTestCols(['Bridge Behind Sofa',   'Powder 2 Kg', '03/23']),
      withTestCols(['Bridge PT cupboard',   'Powder 6 Kg', '03/23']),
    ],
  },
  {
    id: 'fe-sun',
    title: 'Fire Extinguishers — Sun Deck',
    category: 'fire', deck: 'sun',
    columns: FIRE_BASE_COLS,
    rows: [
      withTestCols(['Under Bar',            'Powder 6 Kg', '03/23']),
    ],
  },

  // ---- Life Rafts ----
  {
    id: 'life-rafts',
    title: 'Life Rafts',
    category: 'lsa', deck: 'upper',
    columns: ['Location', 'Next inspection', 'HRU expiry date', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Upper Deck Aft PT',  '10/23', '02/2024']),
      withTestCols(['Upper Deck Aft PT',  '10/23', '02/2024']),
      withTestCols(['Upper Deck Aft STB', '10/23', '02/2024']),
      withTestCols(['Upper Deck Aft STB', '10/23', '02/2024']),
    ],
  },

  // ---- Flares ----
  {
    id: 'flares',
    title: 'Flares',
    category: 'lsa', deck: 'upper',
    columns: ['Type of flare', 'Amount', 'Expiry Date', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Smoke Flare',       '2', '12/25']),
      withTestCols(['Hand held',         '6', '12/25']),
      withTestCols(['Parachute / rocket','6', '12/25']),
    ],
  },

  // ---- Line Throwers ----
  {
    id: 'line-throwers',
    title: 'Line Throwers',
    category: 'lsa', deck: 'upper',
    columns: ['Location', 'Amount', 'Expiry date', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Bridge PT locker', '2', '2031']),
    ],
  },

  // ---- Life Jackets ----
  {
    id: 'life-jackets',
    title: 'Life Jackets',
    category: 'lsa', deck: 'all',
    columns: ['Location', 'Type / amount', 'Next service', 'Lights', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Crew cabin PT AFT',           'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Crew cabin PT FWD',           'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Crew cabin STB FWD',          'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Crew cabin STB AFT',          'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Guest cabin PT AFT',          'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Guest cabin STB AFT',         'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Guest cabin PT FWD',          'Adult / 2 · Kids / 2',   '01/23', '02/26']),
      withTestCols(['Guest cabin STB FWD',         'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Main Saloon STB Cupboard',    'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Main saloon Port Cupboard',   'Kids / 2',               '01/23', '02/26']),
      withTestCols(['Bridge',                      'Adult / 2',              '01/23', '02/26']),
      withTestCols(['Tender',                      '',                       '',       ''     ]),
      withTestCols(['Master Cabin',                'Adult / 2',              '01/23', '02/26']),
    ],
  },

  // ---- SART ----
  {
    id: 'sart',
    title: 'SART',
    category: 'lsa', deck: 'upper',
    columns: ['Location', 'Amount', 'Expiry', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Bridge', '1', '07/24']),
    ],
  },

  // ---- EPIRB ----
  {
    id: 'epirb',
    title: 'EPIRB',
    category: 'lsa', deck: 'upper',
    columns: ['Location', 'Amount', 'Service', 'HRU expiry', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Upper Deck Aft', '1', '03/27', '03/24']),
    ],
  },

  // ---- Immersion Suits ----
  {
    id: 'immersion-suits',
    title: 'Immersion Suits',
    category: 'lsa', deck: 'main',
    columns: ['Location', 'Amount / Type', 'Service date', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Main Deck Aft', '20 adult · 2 kids', '10/31']),
    ],
  },

  // ---- Portable VHF ----
  {
    id: 'portable-vhf',
    title: 'Portable VHF',
    category: 'lsa', deck: 'upper',
    columns: ['Location', 'Amount', 'Expiry', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Bridge main unit', '2', 'N/A']),
      withTestCols(['Spare battery',    '2', '06/24']),
    ],
  },

  // ---- Life Buoys ----
  {
    id: 'life-buoys',
    title: 'Life Buoys',
    category: 'lsa', deck: 'all',
    columns: ['Location / Type', 'Amount', 'Expiry', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Light and smoke', '1', '09/25']),
      withTestCols(['Light only',      '2', 'N/A']),
    ],
  },

  // ---- MED KIT ----
  {
    id: 'med-kit',
    title: 'Medical Kit',
    category: 'lsa', deck: 'upper',
    columns: ['Location', 'Certificate issue', 'Certificate expiry', 'Pressure', 'Last Checked By'],
    rows: [
      withTestCols(['Bridge', '11/21', '11/22']),
    ],
  },
]

export const FIRE_EQUIPMENT_GUIDE_ID = 'FIRE-EQUIPMENT-LIST'

// Convenience: indices of the trailing two columns in any seeded table.
export const PRESSURE_COL_OFFSET_FROM_END = 1   // second-to-last
export const CHECKED_BY_COL_OFFSET_FROM_END = 0 // last
