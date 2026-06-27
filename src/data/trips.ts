// Trip schedule data

export type TripEvent = {
  time?: string
  title: string
  details?: string[]
  highlight?: boolean
}

export type TripDay = {
  date: string // human-friendly, e.g. "Friday · June 27"
  isoDate: string // YYYY-MM-DD for sorting
  title: string
  subtitle?: string
  events: TripEvent[]
  overnight?: string
}

export type Trip = {
  id: string
  name: string
  subtitle: string
  startDate: string // YYYY-MM-DD
  endDate: string
  hero: { icon: string; gradient: string } // tailwind gradient classes
  days: TripDay[]
}

export const TRIPS: Trip[] = [
  {
    id: 'june-honeymoon-2026',
    name: 'June Honeymoon Trip',
    subtitle: 'Mallorca · Formentera · Ibiza · Menorca',
    startDate: '2026-06-27',
    endDate: '2026-07-07',
    hero: { icon: '💍', gradient: 'from-rose-900 via-red-800 to-amber-700' },
    days: [
      {
        date: 'Saturday · June 27',
        isoDate: '2026-06-27',
        title: 'Arrival in Mallorca',
        events: [
          { time: '13:50', title: 'Arrival at Palma Airport' },
          { title: 'Transfer to Club de Mar in Palma' },
          { title: 'Yacht check-in and welcome aboard' },
          {
            time: '20:00',
            title: 'Dinner at Cap Rocat',
            details: ['Exclusive fortress setting with stunning views'],
            highlight: true,
          },
          {
            title: 'After-dinner recommendation',
            details: ['Cocktails at the iconic Bar Abaco in Palma'],
          },
        ],
        overnight: 'Berthed at Club de Mar, Palma',
      },
      {
        date: 'Sunday · June 28',
        isoDate: '2026-06-28',
        title: 'Crossing to Formentera',
        events: [
          { title: 'Early morning departure from Palma' },
          { title: 'Approx. 7-hour cruise to Formentera' },
          {
            time: '13:30',
            title: 'Lunch at Chezzgardi',
            details: ['Direct to Chezzgardi on arrival for lunch and a relaxed day drinking'],
            highlight: true,
          },
          { title: 'Chilled dinner on board with sunset' },
        ],
        overnight: 'Anchored in Formentera',
      },
      {
        date: 'Monday · June 29 — Wednesday · July 1',
        isoDate: '2026-06-29',
        title: 'Ibiza',
        subtitle: 'Two full days of beaches, restaurants & famous nightlife',
        events: [
          { title: 'Morning: short cruise (approx. 1 hour) to Ibiza' },
          { title: 'Docked in the Old Port or anchored nearby' },
          {
            time: 'Jun 29 · 23:30',
            title: 'John Summit VIP Experience',
            details: ['Tickets starting at 23:30'],
            highlight: true,
          },
          {
            time: 'Jun 30 · 13:30',
            title: 'Lunch at El Chiringuito Beach Club',
            details: ["One of Ibiza's most beautiful beach clubs"],
            highlight: true,
          },
        ],
        overnight: 'June 29 – July 1 in Ibiza',
      },
      {
        date: 'Wednesday · July 1',
        isoDate: '2026-07-01',
        title: 'Back to Mallorca (West Coast)',
        events: [
          { time: '04:00', title: 'Early departure from Ibiza' },
          {
            time: '13:00',
            title: 'Lunch stop at Gran Folies',
            details: [
              'Near Camp de Mar — beautiful cliffside location',
              'Restaurant runs a tender service that will pick up the guests; yacht name already provided',
            ],
            highlight: true,
          },
          { title: 'Early evening berthing at Club de Vela in Andratx' },
        ],
        overnight: 'July 1 – 2 at Club de Vela, Andratx',
      },
      {
        date: 'Thursday · July 2',
        isoDate: '2026-07-02',
        title: 'Hiking Day in Andratx',
        events: [
          {
            title: 'Morning hike — Option 1 (easier)',
            details: ['Andratx → Sant Elm (approx. 6 km)'],
          },
          {
            title: 'Morning hike — Option 2 (challenging)',
            details: ['Andratx → La Trapa → Sant Elm (approx. 13 km)'],
          },
          { title: 'Yacht relocates and anchors in Sant Elm during the hike' },
        ],
        overnight: 'Anchored in Sant Elm',
      },
      {
        date: 'Friday · July 3',
        isoDate: '2026-07-03',
        title: 'Towards Deià & Sóller',
        subtitle: 'Scenic cruise along the northwest coast',
        events: [
          { title: 'Swimming stop at Sa Foradada' },
          { title: 'Breakfast and lunch on board' },
          { title: 'Afternoon: anchor near Cala Deià' },
          { title: 'Tender ashore, then taxi to Deià' },
          {
            time: '20:00',
            title: 'Dinner at Sa Pedrissa',
            details: ['Recommended dinner spot near Deià'],
            highlight: true,
          },
        ],
        overnight: 'Anchored near Deià',
      },
      {
        date: 'Saturday · July 4 — Sunday · July 5',
        isoDate: '2026-07-04',
        title: 'Menorca',
        subtitle: '1.5 days to explore beaches and the relaxed atmosphere',
        events: [
          { title: 'Morning departure past Cap Formentor to Menorca (approx. 4–5 hours)' },
          {
            time: 'Jul 4 · 18:30–20:00',
            title: "Cova d'en Xoroi — Terrace Box Side",
            details: ['Sunset cliffside cave bar on the south coast'],
            highlight: true,
          },
        ],
        overnight: 'July 4 – 5 in Menorca',
      },
      {
        date: 'Sunday · July 5 — Monday · July 6',
        isoDate: '2026-07-05',
        title: 'Return to Mallorca',
        events: [
          {
            title: 'Cruise back with a beach stop',
            details: ["Options: Cala d'Or or Es Trenc"],
          },
          { title: 'Relaxed final day on Mallorca' },
        ],
      },
      {
        date: 'Tuesday · July 7',
        isoDate: '2026-07-07',
        title: 'Departure',
        events: [
          { title: 'Morning return to Club de Mar in Palma' },
          { title: 'Disembarkation and transfer to Palma Airport', details: ['Flight time still to be confirmed'] },
        ],
      },
    ],
  },
]

export function findTripById(id: string): Trip | undefined {
  return TRIPS.find(t => t.id === id)
}
