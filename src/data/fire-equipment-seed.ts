// Initial seed values for the Fire & Safety Equipment list.
// Transcribed from the binder pages (Fire extinguishers, Life Rafts, Flares,
// Line Throwers, Life Jackets, SART, EPIRB, Immersion Suits, Portable VHF,
// Life Buoys, MED KIT) — values can be edited inline by any user.

export interface FireEqRow {
  // Free-form cells. Empty string allowed.
  values: string[]
}

export interface FireEqTable {
  id: string                 // stable section id
  title: string              // visible heading
  columns: string[]          // header row labels
  rows: FireEqRow[]
}

export const FIRE_EQUIPMENT_SEED: FireEqTable[] = [
  // ---- Fire extinguishers ----
  {
    id: 'fe-lower',
    title: 'Fire Extinguishers — Lower Deck',
    columns: ['Location', 'Characteristics', 'Expiry Date'],
    rows: [
      { values: ['Crew Cabin PT FWD',   'Powder 2 Kg', '03/23'] },
      { values: ['Crew Cabin PT AFT',   'Powder 2 Kg', '03/23'] },
      { values: ['Crew Cabin STB FWD',  'Powder 2 Kg', '03/23'] },
      { values: ['Crew Cabin STB AFT',  'Powder 2 Kg', '03/23'] },
      { values: ['Guest Cabin PT FWD',  'Powder 2 Kg', '03/23'] },
      { values: ['Guest Cabin PT AFT',  'Powder 2 Kg', '03/23'] },
      { values: ['Guest Cabin STB FWD', 'Powder 2 Kg', '03/23'] },
      { values: ['Guest Cabin STB AFT', 'Powder 2 Kg', '03/23'] },
      { values: ['Crew mess cupboard',  'Powder 6 Kg', '03/23'] },
      { values: ['Under guest staircase', 'Powder 6 Kg', '03/23'] },
      { values: ['Engine STB',          'Powder 6 Kg', '03/23'] },
      { values: ['Engine PT',           'Powder 6 Kg', '03/23'] },
      { values: ['Engine STB',          'Foam 9 L',    '03/23'] },
      { values: ['Engine PT',           'Foam 9 L',    '03/23'] },
      { values: ['Engine / garage entrance', 'CO2 9 Kg × 2', '03/23'] },
    ],
  },
  {
    id: 'fe-main',
    title: 'Fire Extinguishers — Main Deck',
    columns: ['Location', 'Characteristics', 'Expiry Date'],
    rows: [
      { values: ['Emergency Fire Pump',  'Powder 2 Kg', '03/23'] },
      { values: ['Main saloon',          'Powder 6 Kg', '03/23'] },
      { values: ['Master cupboard',      'Powder 6 Kg', '03/23'] },
      { values: ['Galley',               'Foam 9 L',    '03/23'] },
      { values: ['Main saloon',          'CO2 5 Kg',    '03/23'] },
    ],
  },
  {
    id: 'fe-upper',
    title: 'Fire Extinguishers — Upper Deck',
    columns: ['Location', 'Characteristics', 'Expiry Date'],
    rows: [
      { values: ['Under Bar',            'Powder 2 Kg', '03/23'] },
      { values: ['Bridge Behind Sofa',   'Powder 2 Kg', '03/23'] },
      { values: ['Bridge PT cupboard',   'Powder 6 Kg', '03/23'] },
    ],
  },
  {
    id: 'fe-sun',
    title: 'Fire Extinguishers — Sun Deck',
    columns: ['Location', 'Characteristics', 'Expiry Date'],
    rows: [
      { values: ['Under Bar',            'Powder 6 Kg', '03/23'] },
    ],
  },

  // ---- Life Rafts ----
  {
    id: 'life-rafts',
    title: 'Life Rafts',
    columns: ['Location', 'Next inspection', 'HRU expiry date'],
    rows: [
      { values: ['Upper Deck Aft PT',  '10/23', '02/2024'] },
      { values: ['Upper Deck Aft PT',  '10/23', '02/2024'] },
      { values: ['Upper Deck Aft STB', '10/23', '02/2024'] },
      { values: ['Upper Deck Aft STB', '10/23', '02/2024'] },
    ],
  },

  // ---- Flares ----
  {
    id: 'flares',
    title: 'Flares',
    columns: ['Type of flare', 'Amount', 'Expiry Date'],
    rows: [
      { values: ['Smoke Flare',       '2', '12/25'] },
      { values: ['Hand held',         '6', '12/25'] },
      { values: ['Parachute / rocket','6', '12/25'] },
    ],
  },

  // ---- Line Throwers ----
  {
    id: 'line-throwers',
    title: 'Line Throwers',
    columns: ['Location', 'Amount', 'Expiry date'],
    rows: [
      { values: ['Bridge PT locker', '2', '2031'] },
    ],
  },

  // ---- Life Jackets ----
  {
    id: 'life-jackets',
    title: 'Life Jackets',
    columns: ['Location', 'Type / amount', 'Next service', 'Lights'],
    rows: [
      { values: ['Crew cabin PT AFT',           'Adult / 2',              '01/23', '02/26'] },
      { values: ['Crew cabin PT FWD',           'Adult / 2',              '01/23', '02/26'] },
      { values: ['Crew cabin STB FWD',          'Adult / 2',              '01/23', '02/26'] },
      { values: ['Crew cabin STB AFT',          'Adult / 2',              '01/23', '02/26'] },
      { values: ['Guest cabin PT AFT',          'Adult / 2',              '01/23', '02/26'] },
      { values: ['Guest cabin STB AFT',         'Adult / 2',              '01/23', '02/26'] },
      { values: ['Guest cabin PT FWD',          'Adult / 2 · Kids / 2',   '01/23', '02/26'] },
      { values: ['Guest cabin STB FWD',         'Adult / 2',              '01/23', '02/26'] },
      { values: ['Main Saloon STB Cupboard',    'Adult / 2',              '01/23', '02/26'] },
      { values: ['Main saloon Port Cupboard',   'Kids / 2',               '01/23', '02/26'] },
      { values: ['Bridge',                      'Adult / 2',              '01/23', '02/26'] },
      { values: ['Tender',                      '',                       '',       ''     ] },
      { values: ['Master Cabin',                'Adult / 2',              '01/23', '02/26'] },
    ],
  },

  // ---- SART ----
  {
    id: 'sart',
    title: 'SART',
    columns: ['Location', 'Amount', 'Expiry'],
    rows: [
      { values: ['Bridge', '1', '07/24'] },
    ],
  },

  // ---- EPIRB ----
  {
    id: 'epirb',
    title: 'EPIRB',
    columns: ['Location', 'Amount', 'Service', 'HRU expiry'],
    rows: [
      { values: ['Upper Deck Aft', '1', '03/27', '03/24'] },
    ],
  },

  // ---- Immersion Suits ----
  {
    id: 'immersion-suits',
    title: 'Immersion Suits',
    columns: ['Location', 'Amount / Type', 'Service date'],
    rows: [
      { values: ['Main Deck Aft', '20 adult · 2 kids', '10/31'] },
    ],
  },

  // ---- Portable VHF ----
  {
    id: 'portable-vhf',
    title: 'Portable VHF',
    columns: ['Location', 'Amount', 'Expiry'],
    rows: [
      { values: ['Bridge main unit', '2', 'N/A'] },
      { values: ['Spare battery',    '2', '06/24'] },
    ],
  },

  // ---- Life Buoys ----
  {
    id: 'life-buoys',
    title: 'Life Buoys',
    columns: ['Location / Type', 'Amount', 'Expiry'],
    rows: [
      { values: ['Light and smoke', '1', '09/25'] },
      { values: ['Light only',      '2', 'N/A'] },
    ],
  },

  // ---- MED KIT ----
  {
    id: 'med-kit',
    title: 'Medical Kit',
    columns: ['Location', 'Certificate issue', 'Certificate expiry'],
    rows: [
      { values: ['Bridge', '11/21', '11/22'] },
    ],
  },
]

export const FIRE_EQUIPMENT_GUIDE_ID = 'FIRE-EQUIPMENT-LIST'
