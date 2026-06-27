// Trip schedule data

export type TripEvent = {
  time?: string
  title: string
  /** Optional URL — when set, the title renders as a hyperlink. Default: Google Maps search for the title. */
  link?: string
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

// Convenience builder for Google Maps search links
export function mapsLink(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
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
      // ---------------- Day 1 ----------------
      {
        date: 'Saturday · June 27',
        isoDate: '2026-06-27',
        title: 'Arrival in Mallorca',
        events: [
          { time: '13:50', title: 'Palma Airport', link: mapsLink('Palma de Mallorca Airport') },
          { title: 'Club de Mar, Palma', link: mapsLink('Club de Mar Mallorca, Palma') },
          { title: 'Yacht check-in and welcome aboard' },
          {
            time: '20:00',
            title: 'Dinner at Cap Rocat',
            link: mapsLink('Cap Rocat Mallorca'),
            details: ['Exclusive fortress setting with stunning views'],
            highlight: true,
          },
          {
            title: 'After-dinner recommendation: Bar Abaco',
            link: mapsLink('Bar Abaco Palma de Mallorca'),
            details: ['Iconic cocktail bar in Palma'],
          },
        ],
        overnight: 'Berthed at Club de Mar, Palma',
      },

      // ---------------- Day 2 ----------------
      {
        date: 'Sunday · June 28',
        isoDate: '2026-06-28',
        title: 'Crossing to Formentera',
        events: [
          { title: 'Early morning departure from Palma' },
          { title: 'Approx. 7-hour cruise to Formentera' },
          {
            time: '13:30',
            title: 'Lunch at Chezz Gerdi Formentera',
            link: mapsLink('Chezz Gerdi Formentera'),
            details: ['Beachside lunch and a relaxed day drinking'],
            highlight: true,
          },
          { title: 'Chilled dinner on board with sunset' },
        ],
        overnight: 'Anchored in Formentera',
      },

      // ---------------- Day 3 ----------------
      {
        date: 'Monday · June 29',
        isoDate: '2026-06-29',
        title: 'Ibiza — Arrival & John Summit',
        events: [
          { title: 'Morning: short cruise (approx. 1 hour) to Ibiza' },
          { title: 'Docked in the Old Port or anchored nearby', link: mapsLink('Ibiza Old Port marina') },
          {
            time: '23:30',
            title: 'John Summit VIP Experience',
            link: mapsLink('Ushuaia Ibiza Beach Hotel'),
            details: ['Tickets starting at 23:30'],
            highlight: true,
          },
        ],
        overnight: 'Ibiza',
      },

      // ---------------- Day 4 ----------------
      {
        date: 'Tuesday · June 30',
        isoDate: '2026-06-30',
        title: 'Ibiza — Beach Club Day',
        events: [
          { title: 'Morning at leisure: beaches, swimming & tender excursions' },
          {
            time: '13:30',
            title: 'Lunch at El Chiringuito Beach Club',
            link: mapsLink('El Chiringuito Ibiza Es Cavallet'),
            details: ["One of Ibiza's most beautiful beach clubs"],
            highlight: true,
          },
          { title: 'Evening on board or ashore in Ibiza' },
        ],
        overnight: 'Ibiza',
      },

      // ---------------- Day 5 ----------------
      {
        date: 'Wednesday · July 1',
        isoDate: '2026-07-01',
        title: 'Back to Mallorca (West Coast)',
        events: [
          { time: '04:00', title: 'Early departure from Ibiza' },
          {
            time: '13:00',
            title: 'Lunch at Gran Folies',
            link: mapsLink('Gran Folies Camp de Mar Mallorca'),
            details: [
              'Near Camp de Mar — beautiful cliffside location',
              'Restaurant runs a tender service that will pick up the guests; yacht name already provided',
            ],
            highlight: true,
          },
          { title: 'Early evening berthing at Club de Vela Andratx', link: mapsLink('Club de Vela Puerto de Andratx') },
        ],
        overnight: 'Club de Vela, Andratx',
      },

      // ---------------- Day 6 ----------------
      {
        date: 'Thursday · July 2',
        isoDate: '2026-07-02',
        title: 'Hiking Day in Andratx',
        events: [
          {
            title: 'Morning hike — Option 1 (easier): Andratx → Sant Elm',
            link: mapsLink('Andratx to Sant Elm trail'),
            details: ['Approx. 6 km'],
          },
          {
            title: 'Morning hike — Option 2 (challenging): Andratx → La Trapa → Sant Elm',
            link: mapsLink('La Trapa Sant Elm Mallorca'),
            details: ['Approx. 13 km'],
          },
          { title: 'Yacht relocates and anchors in Sant Elm during the hike', link: mapsLink('Sant Elm Mallorca anchorage') },
        ],
        overnight: 'Anchored in Sant Elm',
      },

      // ---------------- Day 7 ----------------
      {
        date: 'Friday · July 3',
        isoDate: '2026-07-03',
        title: 'Towards Deià & Sóller',
        subtitle: 'Scenic cruise along the northwest coast',
        events: [
          { title: 'Swimming stop at Sa Foradada', link: mapsLink('Sa Foradada Mallorca') },
          { title: 'Breakfast and lunch on board' },
          { title: 'Afternoon: anchor near Cala Deià', link: mapsLink('Cala Deia Mallorca') },
          { title: 'Tender ashore, then taxi to Deià village', link: mapsLink('Deia Mallorca village') },
          {
            time: '20:00',
            title: 'Dinner at Sa Pedrissa',
            link: mapsLink('Sa Pedrissa Deia Mallorca'),
            details: ['Hilltop restaurant near Deià with panoramic views'],
            highlight: true,
          },
        ],
        overnight: 'Anchored near Deià',
      },

      // ---------------- Day 8 ----------------
      {
        date: 'Saturday · July 4',
        isoDate: '2026-07-04',
        title: 'Cruise to Menorca',
        events: [
          { title: 'Morning departure past Cap Formentor', link: mapsLink('Cap Formentor Mallorca') },
          { title: 'Approx. 4–5 hour cruise to Menorca' },
          {
            time: '18:30–20:00',
            title: "Cova d'en Xoroi — Terrace Box Side",
            link: mapsLink("Cova d'en Xoroi Menorca"),
            details: ['Sunset cliffside cave bar on the south coast'],
            highlight: true,
          },
        ],
        overnight: 'Menorca',
      },

      // ---------------- Day 9 ----------------
      {
        date: 'Sunday · July 5',
        isoDate: '2026-07-05',
        title: 'Menorca — Beach Day',
        events: [
          { title: 'Day exploring Menorca: beaches & coves' },
          { title: 'Lunch on board or ashore' },
        ],
        overnight: 'Menorca',
      },

      // ---------------- Day 10 ----------------
      {
        date: 'Monday · July 6',
        isoDate: '2026-07-06',
        title: 'Return to Mallorca',
        events: [
          {
            title: 'Cruise back with a beach stop',
            details: ["Options: Cala d'Or or Es Trenc"],
            link: mapsLink('Es Trenc beach Mallorca'),
          },
          { title: 'Relaxed final evening on Mallorca' },
        ],
        overnight: 'Mallorca',
      },

      // ---------------- Day 11 ----------------
      {
        date: 'Tuesday · July 7',
        isoDate: '2026-07-07',
        title: 'Departure',
        events: [
          { title: 'Morning return to Club de Mar in Palma', link: mapsLink('Club de Mar Mallorca, Palma') },
          {
            title: 'Disembarkation and transfer to Palma Airport',
            link: mapsLink('Palma de Mallorca Airport'),
            details: ['Flight time still to be confirmed'],
          },
        ],
      },
    ],
  },
]

export function findTripById(id: string): Trip | undefined {
  return TRIPS.find(t => t.id === id)
}

/**
 * Fetch a trip — returns the server override (if any) merged on top of the baked-in trip.
 * Falls back to the baked-in trip if no override exists or the request fails.
 */
export async function loadTrip(id: string): Promise<Trip | undefined> {
  const baseline = findTripById(id)
  try {
    const resp = await fetch(`/api/trips?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (resp.ok) {
      const data = (await resp.json()) as { trip: Trip | null }
      if (data?.trip) return data.trip
    }
  } catch {
    // ignore — fall back to baseline
  }
  return baseline
}

/** Persist a trip override to the backend. */
export async function saveTrip(trip: Trip, user?: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const resp = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trip.id, trip, user: user || 'crew' }),
    })
    if (!resp.ok) {
      const text = await resp.text()
      return { ok: false, detail: text }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'Network error' }
  }
}
