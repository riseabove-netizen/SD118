// Deckhand Duties SOP — Guests On Board
// Source: RISE_ABOVE_DECKIE-DUTIES.pdf (uploaded 2026-07-04)

export interface DeckhandSection {
  id: string
  title: string
  description: string
  tone: 'blue' | 'red' | 'orange' | 'amber'
  items: string[]
  /**
   * Optional group labels overlaid on the flat items array.
   * Each entry marks the item index where a new group header should appear.
   * Item indices continue to be the source of truth for progress and storage.
   */
  groups?: { startIndex: number; label: string }[]
}

export const DECKHAND_DUTIES_SECTIONS: DeckhandSection[] = [
  {
    id: 'morning',
    title: 'Morning Duties',
    description: 'Start-of-day checks and cleaning',
    tone: 'amber',
    items: [
      'Turn off exterior lights according to sunrise.',
      'Check fresh water tank levels and report to Captain or Mate.',
      'Clean windows and stainless steel using water/vinegar or alcohol as required.',
      'Vacuum flybridge, upper deck forward and main deck.',
      'Remove covers from upper and main deck areas.',
      'Vacuum sofas and cushions.',
      'Clean oil spots with vinegar; if needed use Simple Green and scrub pad, then apply Semco.',
      'Clean scuppers.',
      'Rinse and dry the passerelle/transit door area and swim platform.',
    ],
  },
  {
    id: 'toys-beach-club',
    title: 'Toys & Beach Club Preparation',
    description: 'Guest water activities and toy handling',
    tone: 'blue',
    items: [
      'Prepare all toys after morning duties according to Owner/Captain requirements.',
      'Prepare beach club with towels, sunscreen and water.',
      'Minimum two crew members for launching tender or jet ski.',
      'Obtain permission from Captain or Mate before using tender controls.',
      'Remain with guests during all water activities and never lose sight of them.',
      'Use binoculars if necessary.',
      'Jet ski: carry yellow waterproof VHF (Channel 69) and two bottles of water.',
      'Tender must always be ready for guest transportation ashore with towels and water.',
    ],
  },
  {
    id: 'afternoon',
    title: 'Afternoon Duties',
    description: 'Midday cleaning and standby',
    tone: 'orange',
    items: [
      'Remain on standby for Owner and guests.',
      'After breakfast, clean and vacuum deck floors.',
      'Clean tables with alcohol.',
      'Remove fingerprints from stainless steel and windows.',
      'Carry a microfiber cloth at all times.',
    ],
  },
  {
    id: 'after-toys',
    title: 'After Guests Use the Toys',
    description: 'Post-use cleaning and maintenance',
    tone: 'blue',
    items: [
      'Rinse and flush all toys if required.',
      'Apply T-9 to tender and jet skis when necessary.',
      'Keep the garage clean and maintain clear access.',
    ],
  },
  {
    id: 'evening',
    title: 'Evening Duties',
    description: 'End-of-day uniform, lights, and standby',
    tone: 'amber',
    items: [
      'Change into evening uniform before sunset.',
      'Turn on all exterior lights.',
      'Check flybridge, upper deck and main deck areas.',
      'Remove fingerprints if necessary.',
      'Remain on standby for guests.',
    ],
  },
  {
    id: 'beach-setup',
    title: 'Beach Setup',
    description: 'Beach picnic ashore — gear & F&B checklist',
    tone: 'blue',
    groups: [
      { startIndex: 0,  label: 'Beach area' },
      { startIndex: 10, label: 'Food and drinks' },
    ],
    items: [
      // Beach area (0–9)
      'Chairs',
      'Awning',
      'Sand mat',
      'Tables',
      'Cooler filled with ice',
      'Towels',
      'Sunscreen',
      'Dry bags',
      'Tower speaker and extra battery',
      'Trash bag',
      // Food and drinks (10–18)
      'Sodas',
      'Alcohol',
      'Cups',
      'Plates',
      'Napkins',
      'Disposable silverware',
      'Food',
      'Snacks',
      'Dessert',
    ],
  },
  {
    id: 'general-notes',
    title: 'General Notes',
    description: 'Standing orders and priorities',
    tone: 'red',
    items: [
      'Remain on standby in the bridge monitoring CCTV or in the crew mess.',
      'Never stay in the galley unless required.',
      'Inform the Captain or Mate immediately of any close vessel or unusual situation.',
      'Guest safety and service are always the priority.',
    ],
  },
]

export function getDeckhandSection(id: string): DeckhandSection | undefined {
  return DECKHAND_DUTIES_SECTIONS.find(s => s.id === id)
}
