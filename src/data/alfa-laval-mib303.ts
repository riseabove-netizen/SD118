// Alfa Laval MIB 303 fuel separator — parts list.
// Source: MIB 303 AC system manual, 2.1.1 Assembly Drawing,
// System Reference Ref. 9000768 Rev. 1.

export interface Mib303Part {
  description: string
  qty: number
  articleNo: string
  ref?: string // electrical reference designator, e.g. Q1, K4
}

export interface Mib303PartGroup {
  item: string
  title: string
  parts: Mib303Part[]
}

export const MIB303_PART_GROUPS: Mib303PartGroup[] = [
  {
    item: '1',
    title: 'Separator',
    parts: [
      { description: 'Separator MIB 303 S-13/S-33', qty: 1, articleNo: '881176-11-02' },
    ],
  },
  {
    item: '2',
    title: 'Starter / control unit',
    parts: [
      { description: 'Main switch 16 A', ref: 'Q1', qty: 1, articleNo: '590025-01' },
      { description: 'Extended shaft 180 mm', ref: 'Q1', qty: 1, articleNo: '590025-15' },
      { description: 'Handle IP65', ref: 'Q1', qty: 1, articleNo: '590025-18' },
      { description: 'VFD kit', ref: 'A1', qty: 1, articleNo: '9010354-80' },
      { description: 'Auxiliary contact', ref: 'K4', qty: 1, articleNo: '9002021-07' },
      { description: 'Auxiliary contact', ref: 'K1', qty: 1, articleNo: '9002021-08' },
      { description: 'Filter', qty: 1, articleNo: '9001365-02' },
      { description: 'Auxiliary contact, front mount', qty: 2, articleNo: '590968-17' },
      { description: 'Time relay kit', ref: 'K2', qty: 1, articleNo: '9010632-80' },
      { description: 'Pilot light 230 VAC, white', qty: 2, articleNo: '596791-20' },
    ],
  },
  {
    item: '3',
    title: 'Ancillary kit',
    parts: [
      { description: 'T-pipe', qty: 1, articleNo: '1763699-02' },
      { description: 'Quick coupling', qty: 1, articleNo: '1764716-01' },
      { description: 'Funnel', qty: 1, articleNo: '1764481-80' },
      { description: 'Nipple', qty: 2, articleNo: '1764491-01' },
      { description: 'Hose', qty: 2, articleNo: '1764241-01' },
      { description: 'Rectangular ring', qty: 2, articleNo: '546229-30' },
      { description: 'Rectangular ring', qty: 2, articleNo: '546229-07' },
      { description: 'Nipple', qty: 1, articleNo: '1764373-02' },
      { description: 'Non-return valve', qty: 1, articleNo: '1764588-01' },
      { description: 'Outlet piece', qty: 1, articleNo: '1764775-80' },
    ],
  },
  {
    item: '4',
    title: 'System manual',
    parts: [
      { description: 'System manual', qty: 1, articleNo: '59999580' },
    ],
  },
]
