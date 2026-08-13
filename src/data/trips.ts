// Trip schedule data

export type TripEvent = {
  time?: string
  title: string
  /** Optional URL — when set, the title renders as a hyperlink. Default: Google Maps search for the title. */
  link?: string
  details?: string[]
  highlight?: boolean
  /** Optional location image rendered as a small thumbnail next to the event (use satelliteImage helper or any URL). */
  locationImage?: string
}

export type TripDay = {
  date: string // human-friendly, e.g. "Friday · June 27"
  isoDate: string // YYYY-MM-DD for sorting
  title: string
  subtitle?: string
  events: TripEvent[]
  overnight?: string
  /** Optional satellite/map image rendered above the events (e.g., for crossing legs). */
  imageUrl?: string
  /** Optional caption rendered under the image. */
  imageCaption?: string
  /** Optional dock/marina information rendered as a top band on the day card. */
  dock?: {
    marina?: string // e.g. "Marina di Valletta"
    /** Hyperlink to marina (defaults to Google Maps search of marina name). */
    marinaLink?: string
    /** VHF radio channel (e.g., "Ch 09", "Ch 71"). */
    radioChannel?: string
    /** Expected arrival time at dock (e.g., "05:30" or "~5:30 AM"). */
    eta?: string
    /** Expected departure time from dock (e.g., "21:00" or "~9 PM"). */
    etd?: string
    /** Optional notes (slip, berth, port agent, customs, etc.). */
    notes?: string
  }
  /** Optional leg summary rendered as a dark band under the day (mirrors PDF "LEG · NIGHT PASSAGE" style). */
  leg?: {
    label?: string // e.g. "Leg 5 · Night Passage"
    route?: string // e.g. "Sardinia → Ponza, Pontine Islands"
    sub?: string // e.g. "Depart ~10 PM Aug 17 · Arrive ~5 PM Aug 18"
    miles?: number | string // statute miles
    duration?: string // e.g. "19h 35m"
    knots?: number | string // default 12
  }
}

export type GuestEntry = {
  name: string
  tentative?: boolean // shown as dashed border / “maybe”
  note?: string // e.g. “9th birthday Aug 13”
}

export type Trip = {
  id: string
  name: string
  subtitle: string
  startDate: string // YYYY-MM-DD
  endDate: string
  hero: { icon: string; gradient: string } // tailwind gradient classes
  days: TripDay[]
  /** Free-text legacy guest summary, used when guestList is empty. */
  guests?: string
  /** Structured guest list — powers count + chips on title cards. */
  guestList?: GuestEntry[]
}

// Convenience builder for Google Maps search links
export function mapsLink(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/**
 * Build an Esri World Imagery satellite snapshot URL for a bounding box.
 * No API key required. Lon/lat in WGS84 decimal degrees.
 */
type SatelliteBbox = { west: number; south: number; east: number; north: number } | string
type SatelliteSize = { w: number; h: number } | string

export function satelliteImage(
  bbox: SatelliteBbox,
  size: SatelliteSize = { w: 1000, h: 500 }
): string {
  const bboxStr =
    typeof bbox === 'string'
      ? bbox
      : `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
  const sizeStr = typeof size === 'string' ? size : `${size.w},${size.h}`
  const params = new URLSearchParams({
    bbox: bboxStr,
    bboxSR: '4326',
    imageSR: '4326',
    size: sizeStr,
    format: 'jpg',
    f: 'image',
  })
  return `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?${params.toString()}`
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
        title: "Back to Mallorca — Dock Port d'Andratx",
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
          {
            time: '19:00',
            title: "Dock at Port d'Andratx",
            link: mapsLink('Club de Vela Puerto de Andratx'),
            details: ['Overnight berthing at Club de Vela'],
            highlight: true,
          },
        ],
        overnight: "Docked at Port d'Andratx",
      },

      // ---------------- Day 6 ----------------
      {
        date: 'Thursday · July 2',
        isoDate: '2026-07-02',
        title: 'Guests Explore Deià & Sóller',
        subtitle: 'Guests off the boat by car; lunch at Sa Pedrita',
        events: [
          {
            time: '09:00',
            title: 'Guests depart by car to explore Deià & Sóller',
            link: mapsLink('Deia Soller Mallorca'),
            details: ['Full morning driving the northwest coast'],
            highlight: true,
          },
          {
            title: 'Explore Deià village',
            link: mapsLink('Deia Mallorca village'),
          },
          {
            title: 'Continue to Sóller',
            link: mapsLink('Soller Mallorca'),
          },
          {
            time: '14:00',
            title: 'Lunch at Sa Pedrita',
            link: mapsLink('Sa Pedrita Mallorca'),
            highlight: true,
          },
          { title: "Return to yacht in Port d'Andratx in the afternoon" },
        ],
        overnight: "Docked at Port d'Andratx",
      },

      // ---------------- Day 7 ----------------
      {
        date: 'Friday · July 3',
        isoDate: '2026-07-03',
        title: 'Day with Annabel & Yannick',
        subtitle: "Morning hike, lunch, and dinner in Port d'Andratx",
        events: [
          {
            time: '08:00',
            title: 'Morning hike with Annabel',
            link: mapsLink('Andratx hiking trails'),
            details: ['Approx. 3 hours'],
            highlight: true,
          },
          {
            time: '12:30',
            title: 'Lunch with Annabel',
            highlight: true,
          },
          {
            time: '20:00',
            title: "Dinner with Annabel & Yannick — Port d'Andratx",
            link: mapsLink("Port d'Andratx Mallorca restaurants"),
            details: ['Venue TBD'],
            highlight: true,
          },
        ],
        overnight: "Docked at Port d'Andratx",
      },

      // ---------------- Day 8 ----------------
      {
        date: 'Saturday · July 4',
        isoDate: '2026-07-04',
        title: 'TBD — Weather Dependent',
        subtitle: 'Plans to be determined based on weather',
        events: [
          { title: 'Plans to be determined based on weather conditions' },
        ],
      },

      // ---------------- Day 9 ----------------
      {
        date: 'Sunday · July 5',
        isoDate: '2026-07-05',
        title: 'TBD — Weather Dependent',
        subtitle: 'Plans to be determined based on weather',
        events: [
          { title: 'Plans to be determined based on weather conditions' },
        ],
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
  // =================================================================
  // PRE-GOZO — GRAND MEDITERRANEAN VOYAGE (Aug 4 – Sep 7, 2026)
  // Chapters 1–8: Balearics → Menorca → Corsica → Sardinia → Ponza
  //              → Naples → Aeolian → Catania → Malta
  // =================================================================
  {
    id: 'balearics-2026',
    name: 'CANCELLED — Balearic Islands',
    subtitle: 'Original plan (cancelled) · Palma · Formentera · Ibiza · Aug 4–9',
    startDate: '2026-08-04',
    endDate: '2026-08-09',
    hero: { icon: '🏝️', gradient: 'from-purple-900 via-fuchsia-800 to-rose-700' },
    days: [
      {
        date: 'Tuesday · Aug 4',
        isoDate: '2026-08-04',
        title: 'Palma de Mallorca — Embarkation',
        subtitle: 'Mallorca · Embarkation · Night Departure',
        imageUrl: satelliteImage('2.59,39.55,2.69,39.61', '640,320'),
        imageCaption: 'Palma de Mallorca — Marina Port de Mallorca, Gothic Cathedral over the harbour',
        dock: {
          marina: 'Marina Port de Mallorca',
          marinaLink: mapsLink('Marina Port de Mallorca'),
          radioChannel: 'Ch 09',
          eta: 'Embark afternoon',
          etd: '~22:00',
          notes: 'Embarkation day. Provision before departure. Night departure to Formentera (~80 nm).',
        },
        events: [
          { title: 'Board at Marina Port de Mallorca', time: '14:00', link: mapsLink('Marina Port de Mallorca'), highlight: true },
          { title: 'Welcome cocktails on sundeck — Gothic Cathedral glow', time: '19:00' },
          { title: 'Bar Abaco — baroque palace cocktails', time: '20:00', link: mapsLink('Bar Abaco Palma'), details: ['Arrive 8 PM sharp'] },
          { title: 'Dinner ashore — Zaranda (Hotel Es Príncep)', time: '21:00', link: mapsLink('Zaranda Palma'), details: ['1 Michelin Star'] },
          { title: 'Depart for Formentera — Leg 1 night departure', time: '22:00', details: ['~80 nm · 6h 40m at 12 kn'], highlight: true },
        ],
        leg: {
          label: 'LEG 1 · NIGHT DEPARTURE',
          route: 'Palma de Mallorca → Formentera',
          sub: 'Depart ~10 PM Aug 4 · Arrive ~5 AM Aug 5',
          miles: '92',
          duration: '6h 40m',
          knots: '12',
        },
      },
      {
        date: 'Wednesday · Aug 5',
        isoDate: '2026-08-05',
        title: 'Formentera — Ses Illetes',
        subtitle: 'Formentera · Arrive 5 AM · Caribbean-Quality Waters',
        imageUrl: satelliteImage('1.40,38.72,1.50,38.79', '640,320'),
        imageCaption: 'Ses Illetes — translucent turquoise, white sand',
        overnight: 'At anchor · Ses Illetes',
        events: [
          { title: 'Arrive Ses Illetes anchorage', time: '05:00', link: mapsLink('Ses Illetes Formentera'), highlight: true },
          { title: 'Swim · snorkel · paddleboard off the swim platform', details: ['Caribbean-quality water', 'Complete privacy at anchor'] },
          { title: 'Lunch on deck' },
          { title: 'Dinner on deck under the stars', time: '20:30', details: ['Chilled rosé'] },
        ],
      },
      {
        date: 'Thursday · Aug 6',
        isoDate: '2026-08-06',
        title: 'Ibiza — Cala Comte',
        subtitle: 'Ibiza West Coast · Legendary Sunset',
        imageUrl: satelliteImage('1.20,38.95,1.27,39.00', '640,320'),
        imageCaption: 'Cala Comte — multi-level turquoise, sunset stage',
        overnight: 'At anchor · Cala Comte',
        events: [
          { title: 'Cruise to Cala Comte', time: '09:00', link: mapsLink('Cala Comte Ibiza'), details: ['Day hop · 15 nm · 1h 15m'] },
          { title: 'Long afternoon swim — iconic multi-level turquoise', highlight: true },
          { title: 'Stay for the legendary Cala Comte sunset', time: '20:30' },
          { title: 'Dinner at Nassau Beach Club', time: '21:30', link: mapsLink('Nassau Beach Club Ibiza') },
          { title: 'Ushuaïa Ibiza headliner night', time: '23:30', link: mapsLink('Ushuaia Ibiza'), details: ['VIP tables booked ahead'] },
          { title: 'Etxeko Ibiza (alt) — Basque tasting at Bless Hotel', link: mapsLink('Etxeko Ibiza Bless Hotel'), details: ['Michelin Star'] },
          { title: 'Es Boldado (alt) — cliffside seafood, Es Vedrà views', link: mapsLink('Es Boldado restaurant Ibiza') },
        ],
        leg: {
          label: 'LEG 2 · DAY HOP',
          route: 'Formentera → Ibiza (Cala Comte)',
          sub: 'Morning Aug 6 · Arrive ~10 AM',
          miles: '17',
          duration: '1h 15m',
          knots: '12',
        },
      },
      {
        date: 'Saturday · Aug 8',
        isoDate: '2026-08-08',
        title: 'Ibiza Town — Dalt Vila',
        subtitle: 'Ibiza · UNESCO World Heritage Old Town',
        imageUrl: satelliteImage('1.42,38.89,1.46,38.93', '640,320'),
        imageCaption: 'Dalt Vila — UNESCO walled city above Ibiza harbour',
        dock: {
          marina: 'Marina Botafoch · Ibiza',
          marinaLink: mapsLink('Marina Botafoch Ibiza'),
          radioChannel: 'Ch 09',
          eta: 'Morning',
          etd: 'Night',
          notes: 'Dock in marina to walk into Dalt Vila old town.',
        },
        events: [
          { title: 'Dock at Marina Botafoch · enter Dalt Vila', time: '10:00', link: mapsLink('Dalt Vila Ibiza'), highlight: true },
          { title: 'Boutique shopping in the old town' },
          { title: 'Paella lunch at the port', time: '13:30' },
          { title: 'Afternoon ramparts & Cathedral' },
          { title: 'Nikki Beach sunset drinks', time: '20:00', link: mapsLink('Nikki Beach Ibiza') },
          { title: 'Dinner in cobbled old town lanes', time: '22:00' },
        ],
      },
      {
        date: 'Sunday · Aug 9',
        isoDate: '2026-08-09',
        title: 'Ibiza — Las Salinas & Night Departure',
        subtitle: 'Ibiza · Final Day · Depart ~10 PM for Menorca',
        imageUrl: satelliteImage('1.36,38.83,1.43,38.88', '640,320'),
        imageCaption: 'Las Salinas — long beach flanked by salt-flat nature reserve',
        events: [
          { title: 'Las Salinas farewell swim', time: '11:00', link: mapsLink('Playa Las Salinas Ibiza'), highlight: true },
          { title: 'Beach club lunch' },
          { title: 'Sundowner on the transom as the island glows gold', time: '20:00' },
          { title: 'Depart ~10 PM for Menorca — Leg 3A night hop', time: '22:00', details: ['~90 nm · 7h 30m at 12 kn', 'Arrive Ciutadella at dawn'], highlight: true },
        ],
        leg: {
          label: 'LEG 3A · NIGHT HOP',
          route: 'Ibiza → Ciutadella, Menorca',
          sub: 'Depart ~10 PM Aug 9 · Arrive ~5:30 AM Aug 10',
          miles: '104',
          duration: '7h 30m',
          knots: '12',
        },
      },
    ],
  },
  {
    id: 'menorca-corsica-2026',
    name: 'CANCELLED — Menorca & Corsica',
    subtitle: 'Ciutadella · Port Mahon · Bonifacio · Lavezzi · Aug 10–12',
    startDate: '2026-08-10',
    endDate: '2026-08-12',
    hero: { icon: '🏰', gradient: 'from-sky-900 via-blue-800 to-indigo-700' },
    days: [
      {
        date: 'Monday · Aug 10',
        isoDate: '2026-08-10',
        title: 'Menorca — Ciutadella, Cala Macarella & Port Mahon',
        subtitle: 'Menorca · Arrive 5:30 AM · Full Day · Depart 10 PM for Corsica',
        imageUrl: satelliteImage('3.81,40.00,3.88,40.04', '640,320'),
        imageCaption: 'Ciutadella — fjord-like Balearic harbour at dawn',
        dock: {
          marina: 'Port de Maó · Mahon',
          marinaLink: mapsLink('Port de Mao Menorca'),
          radioChannel: 'Ch 09',
          eta: '~05:30',
          etd: '~22:00',
          notes: 'Arrive Ciutadella at dawn, cruise south to Cala Macarella & Cala en Turqueta, dock for dinner at Port Mahon.',
        },
        events: [
          { title: 'Arrive Ciutadella — fjord-like harbour', time: '05:30', link: mapsLink('Ciutadella Menorca'), highlight: true },
          { title: 'Morning in baroque old town' },
          { title: 'Sail south to Cala Macarella — twin emerald coves', time: '11:00', link: mapsLink('Cala Macarella Menorca'), locationImage: satelliteImage('3.91,39.94,3.96,39.98', '320,160') },
          { title: 'Cala en Turqueta — horseshoe of turquoise', time: '14:30', link: mapsLink('Cala en Turqueta Menorca') },
          { title: 'Dock at Port Mahon · dinner at Jagaro', time: '20:30', link: mapsLink('Jagaro Mahon Menorca'), details: ['Bistronomic seafood', 'Port Mahon waterfront'] },
          { title: 'MON Restaurant (alt) — Michelin-trained chef, Ciutadella', link: mapsLink('MON Restaurant Ciutadella') },
          { title: 'Depart Port Mahon for Corsica — Leg 3B longest leg', time: '22:00', details: ['~220 nm · 18h 20m at 12 kn'], highlight: true },
        ],
        leg: {
          label: 'LEG 3B · LONGEST LEG',
          route: 'Port Mahon, Menorca → Bonifacio, Corsica',
          sub: 'Depart ~10 PM Aug 10 · Arrive ~4:30 PM Aug 11',
          miles: '253',
          duration: '18h 20m',
          knots: '12',
        },
      },
      {
        date: 'Tuesday · Aug 11',
        isoDate: '2026-08-11',
        title: 'Bonifacio — Old Town & Sea Caves',
        subtitle: 'Corsica · Arrive ~4:30 PM · 70-Metre Limestone Cliffs',
        imageUrl: satelliteImage('9.13,41.37,9.20,41.42', '640,320'),
        imageCaption: 'Bonifacio — citadel above the fjord-like harbour',
        dock: {
          marina: 'Port de Bonifacio',
          marinaLink: mapsLink('Port de Bonifacio Corsica'),
          radioChannel: 'Ch 09',
          eta: '~16:30',
          etd: 'Day in port',
          notes: 'Inner harbour berthing under the citadel cliffs. Coordinate with capitainerie before approach.',
        },
        events: [
          { title: 'Arrive Bonifacio — fjord harbour, 70m cliffs', time: '16:30', link: mapsLink('Bonifacio Corsica'), highlight: true },
          { title: 'Citadel & old town walk' },
          { title: 'Sea cave tender tour', time: '18:00' },
          { title: 'Corsican charcuterie & Pietra beer' },
          { title: 'Dinner at La Caravelle — harbour terrace', time: '21:00', link: mapsLink('La Caravelle Bonifacio'), details: ['Best risotto in France'] },
          { title: 'L’A Cheda (alt) — Corsican fine dining', link: mapsLink('LA Cheda Bonifacio') },
        ],
      },
      {
        date: 'Wednesday · Aug 12',
        isoDate: '2026-08-12',
        title: 'Lavezzi Islands Marine Reserve',
        subtitle: 'Corsica–Sardinia Strait · Protected Marine Reserve · Depart ~9 PM',
        imageUrl: satelliteImage('9.22,41.32,9.30,41.40', '640,320'),
        imageCaption: 'Lavezzi Islands — granite boulders, marine reserve',
        events: [
          { title: 'Day cruise to Lavezzi Islands marine reserve', time: '09:30', link: mapsLink('Iles Lavezzi marine reserve'), highlight: true },
          { title: 'Snorkeling · granite boulder swim', details: ['Extraordinary water clarity', 'Complete privacy'] },
          { title: 'Return to Bonifacio for farewell dinner', time: '20:00' },
          { title: 'Depart ~9 PM for Porto Cervo — Leg 4 night hop', time: '21:00', details: ['~30 nm · 2h 30m at 12 kn'], highlight: true },
        ],
        leg: {
          label: 'LEG 4 · NIGHT HOP',
          route: 'Bonifacio, Corsica → Porto Cervo, Sardinia',
          sub: 'Depart ~9 PM Aug 12 · Arrive ~11:30 PM Aug 12',
          miles: '35',
          duration: '2h 30m',
          knots: '12',
        },
      },
    ],
  },

  // =================================================================
  // NEW LEG 1 — Crew delivery to Alghero (Aug 9–11, crew only)
  // =================================================================
  {
    id: 'crew-alghero-2026',
    name: 'Crew Delivery · Alghero',
    subtitle: 'Crew only · Cruise to Alghero · Dock until guests arrive · Aug 9–11',
    startDate: '2026-08-09',
    endDate: '2026-08-11',
    hero: { icon: '⚓', gradient: 'from-slate-900 via-slate-800 to-slate-700' },
    guests: 'Crew only',
    guestList: [],
    days: [
      {
        date: 'Sunday · Aug 9',
        isoDate: '2026-08-09',
        title: 'Depart for Alghero — Crew Delivery',
        subtitle: 'Crew only · Sea passage to NW Sardinia',
        events: [
          { title: 'Final provisioning & pre-departure checks', time: '08:00' },
          { title: 'Depart for Alghero, Sardinia', time: '10:00', highlight: true },
          { title: 'Watch rotations underway', details: ['See Watch Duties'] },
        ],
        leg: {
          label: 'DELIVERY LEG',
          route: 'Departure port → Alghero, Sardinia',
          sub: 'Depart Aug 9 morning · Arrive Aug 10',
          knots: '12',
        },
      },
      {
        date: 'Monday · Aug 10',
        isoDate: '2026-08-10',
        title: 'Arrive Alghero — Dock',
        subtitle: 'Marina di Alghero · Dock until guests arrive',
        imageUrl: satelliteImage('8.28,40.53,8.36,40.59', '640,320'),
        imageCaption: 'Alghero — coral-coloured bastions, Catalan heritage',
        dock: {
          marina: 'Marina di Alghero',
          marinaLink: mapsLink('Marina di Alghero Sardinia'),
          radioChannel: 'Ch 09',
          eta: 'Aug 10 (arrival day)',
          etd: '~evening Aug 11',
          notes: 'Dockage confirmed until guest arrival Aug 11 afternoon.',
        },
        events: [
          { title: 'Arrive Marina di Alghero', highlight: true },
          { title: 'Refuel · fresh water · pump-outs' },
          { title: 'Deep clean interior & exterior — charter-ready standard' },
          { title: 'Provision for guest arrival' },
          { title: 'Crew rest & meal ashore' },
        ],
      },
      {
        date: 'Tuesday · Aug 11',
        isoDate: '2026-08-11',
        title: 'Alghero — Final Prep · Guests Arrive PM',
        subtitle: 'Marina di Alghero · Guest embarkation afternoon',
        dock: {
          marina: 'Marina di Alghero',
          marinaLink: mapsLink('Marina di Alghero Sardinia'),
          radioChannel: 'Ch 09',
          eta: 'Docked',
          etd: 'Depart Aug 12 AM for Bonifacio',
          notes: 'Guests embark afternoon Aug 11. Overnight at dock.',
        },
        events: [
          { title: 'Fresh flowers · guest cabins final touches', time: '08:00' },
          { title: 'Provisioning finalised', time: '10:00' },
          { title: 'Crew brief & guest welcome walkthrough', time: '14:00' },
          { title: 'Enrico, Antoniette, Maria, husband & Martina arrive Alghero', time: 'PM', highlight: true, details: ['Guest embarkation'] },
          { title: 'Welcome cocktails on sundeck', time: '19:00' },
          { title: 'Welcome dinner ashore — Il Pavone (old-town seafront)', time: '21:00', link: mapsLink('Il Pavone Alghero') },
          { title: 'Andreini (alt) — regional Sardinian, excellent wine', link: mapsLink('Andreini Alghero') },
          { title: 'Overnight at Marina di Alghero' },
        ],
      },
    ],
  },

  // =================================================================
  // LEG 2 — Alghero → Bonifacio → Sardinia (Aug 12–17)
  // Location plans preserved from prior Sardinia chapter, just reordered
  // to match the new stops and dates.
  // =================================================================
  {
    id: 'sardinia-2026',
    name: 'Sardinia · Alghero → Cala Luna',
    subtitle: 'Bonifacio · Maddalena · Porto Cervo · Cala di Volpe · Costa Smeralda · Cala Luna · Aug 12–17',
    startDate: '2026-08-12',
    endDate: '2026-08-17',
    hero: { icon: '🇮🇹', gradient: 'from-emerald-900 via-green-800 to-teal-700' },
    guests: 'Enrico & Antoniette · Maria, husband & Martina (9th birthday Aug 13)',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Maria' },
      { name: "Maria's husband" },
      { name: 'Martina', note: '9th birthday Aug 13' },
    ],
    days: [
      {
        date: 'Wednesday · Aug 12',
        isoDate: '2026-08-12',
        title: 'Alghero → Bonifacio — Dock Overnight',
        subtitle: 'Depart Alghero AM · Cross to Corsica · Dock Port de Bonifacio 15:00–17:00 for the night',
        imageUrl: satelliteImage('9.14,41.36,9.20,41.42', '640,320'),
        imageCaption: 'Bonifacio — dramatic chalk-cliff citadel on southern Corsica',
        overnight: 'Docked · Port de Bonifacio',
        dock: {
          marina: 'Port de Bonifacio',
          marinaLink: mapsLink('Port de Bonifacio Corsica'),
          radioChannel: 'Ch 9',
          eta: '15:00–17:00',
          etd: 'Aug 13 AM',
          notes: 'Book berth in advance — Bonifacio fills up fast in August. Fjord approach; call harbour on Ch 9 before entering.',
        },
        events: [
          { title: 'Depart Marina di Alghero for Bonifacio', time: '08:00', highlight: true },
          { title: 'Arrive Bonifacio approaches', time: '~14:30' },
          { title: 'Dock at Port de Bonifacio (arrival window 15:00–17:00)', time: '15:00–17:00', link: mapsLink('Port de Bonifacio Corsica'), highlight: true, details: ['Overnight in the marina'] },
          { title: 'Walk up to the medieval upper town from the dock' },
          { title: 'Sunset drinks along the quay' },
          { title: 'Dinner ashore — La Caravelle or L’A Cheda', time: '21:00', link: mapsLink('La Caravelle Bonifacio') },
        ],
        leg: {
          label: 'COASTAL LEG',
          route: 'Alghero → Bonifacio',
          sub: 'Depart Aug 12 AM · Dock 15:00–17:00 · Overnight in marina',
          knots: '12',
        },
      },
      {
        date: 'Thursday · Aug 13',
        isoDate: '2026-08-13',
        title: 'La Maddalena Archipelago — Anchor',
        subtitle: 'Northern Sardinia · National Park · 60+ Islands · Martina turns 9',
        imageUrl: satelliteImage('9.34,41.18,9.50,41.32', '640,320'),
        imageCaption: 'La Maddalena National Park — pink sand, world-class clarity',
        overnight: 'At anchor · Maddalena archipelago',
        events: [
          { title: 'Cruise to La Maddalena archipelago', time: '09:00', link: mapsLink('La Maddalena National Park Sardinia'), highlight: true },
          { title: 'Anchor off Spargi or Budelli pink-sand beach' },
          { title: 'Snorkel · kayak · paddleboard', details: ['Some of the world\'s clearest water'] },
          { title: 'Martina’s 9th birthday celebration onboard', time: '18:00', highlight: true },
          { title: 'Sunset anchor dinner' },
        ],
      },
      {
        date: 'Friday · Aug 14',
        isoDate: '2026-08-14',
        title: 'Cove near Porto Cervo → Porto Cervo Dock',
        subtitle: 'Morning cove anchor · YCCS marina overnight',
        imageUrl: satelliteImage('9.50,41.10,9.58,41.16', '640,320'),
        imageCaption: 'Porto Cervo — Aga Khan’s legendary Costa Smeralda',
        dock: {
          marina: 'Marina di Porto Cervo (YCCS)',
          marinaLink: mapsLink('Marina di Porto Cervo YCCS'),
          radioChannel: 'Ch 09',
          eta: '15:00–16:00 Aug 14',
          etd: 'Morning Aug 15',
          notes: 'YCCS marina — the most glamorous in the Mediterranean. Confirm berth & port agent for August.',
        },
        events: [
          { title: 'Lift anchor from Maddalena', time: '08:00', highlight: true },
          { title: 'Cruise south toward Porto Cervo' },
          { title: 'Anchor in a cove near Porto Cervo — swim / tender / lunch aboard', link: mapsLink('coves near Porto Cervo Sardinia') },
          { title: 'Dock at Marina di Porto Cervo (YCCS) for the night', time: '15:00', highlight: true },
          { title: 'Stroll the boutique-lined piazzetta' },
          { title: 'Dinner at ConFusion — Chef Italo Bassi', time: '21:00', link: mapsLink('ConFusion Porto Cervo'), details: ['1 Michelin Star · 6 consecutive years'] },
          { title: 'La Pergola (alt) — Hotel Cala di Volpe', link: mapsLink('La Pergola Cala di Volpe') },
        ],
      },
      {
        date: 'Saturday · Aug 15',
        isoDate: '2026-08-15',
        title: 'Cove Anchor → Cala di Volpe Mooring · Ferragosto',
        subtitle: 'Morning cove anchor · Cala di Volpe mooring for the night · Italy’s biggest summer celebration',
        imageUrl: satelliteImage('9.55,41.09,9.62,41.14', '640,320'),
        imageCaption: 'Cala di Volpe — Costa Smeralda’s most photographed bay',
        overnight: 'Mooring ball · Cala di Volpe',
        events: [
          { title: 'Leave Porto Cervo in the morning', time: '09:00', highlight: true },
          { title: 'Anchor in a cove — swim, tender, paddleboard', link: mapsLink('coves Costa Smeralda Sardinia') },
          { title: 'Provision fully — everything closes on the 15th', details: ['Critical: confirm with stewardess before noon'] },
          { title: 'Move to Cala di Volpe — pick up mooring ball for the night', link: mapsLink('Cala di Volpe Sardinia'), highlight: true },
          { title: 'Champagne dinner on deck', time: '20:30' },
          { title: 'Ferragosto fireworks from the sundeck', time: '23:00', highlight: true, details: ['Big holiday — fireworks light up the Sardinian coast'] },
        ],
      },
      {
        date: 'Sunday · Aug 16',
        isoDate: '2026-08-16',
        title: 'Costa Smeralda — Anchor',
        subtitle: 'Emerald coast · Anchor day · Swim, tender, beach picks',
        imageUrl: satelliteImage('9.45,41.05,9.60,41.15', '640,320'),
        imageCaption: 'Costa Smeralda — emerald water, granite coves',
        overnight: 'At anchor · Costa Smeralda',
        events: [
          { title: 'Move off mooring — explore Costa Smeralda coves', time: '09:00', highlight: true },
          { title: 'Anchor off a chosen cove — Spiaggia del Principe / Liscia Ruja / Romazzino', link: mapsLink('Spiaggia del Principe Costa Smeralda') },
          { title: 'Beach picnic ashore by tender' },
          { title: 'Snorkel · kayak · paddleboard' },
          { title: 'Sunset cocktails on deck' },
          { title: 'Anchor dinner aboard — casual Sardinian night' },
        ],
      },
      {
        date: 'Monday · Aug 17',
        isoDate: '2026-08-17',
        title: 'Cala Luna — Anchor · Depart Evening for Ponza',
        subtitle: 'East Sardinia · Final anchor · Depart ~10 PM night passage to Ponza',
        imageUrl: satelliteImage('9.60,40.20,9.67,40.25', '640,320'),
        imageCaption: 'Cala Luna — limestone arch, accessible only by sea',
        events: [
          { title: 'Cruise to Cala Luna — accessible only by sea', time: '10:00', link: mapsLink('Cala Luna Sardinia'), highlight: true },
          { title: 'Long final Sardinian swim — limestone arch anchorage', details: ['Vivid turquoise · absolute silence'] },
          { title: 'Farewell anchor dinner aboard', time: '20:00' },
          { title: 'Depart ~10 PM for Ponza — night passage', time: '22:00', details: ['~235 nm · 19h 35m at 12 kn'], highlight: true },
        ],
        leg: {
          label: 'NIGHT PASSAGE',
          route: 'Cala Luna, Sardinia → Ponza, Pontine Islands',
          sub: 'Depart ~10 PM Aug 17 · Arrive ~5 PM Aug 18',
          miles: '235',
          duration: '19h 35m',
          knots: '12',
        },
      },
    ],
  },
  {
    id: 'ponza-2026',
    name: 'Ponza · Leg 4',
    subtitle: 'Italy’s Secret Island · Chiaia di Luna · Grotte di Pilato · Aug 18–19',
    startDate: '2026-08-18',
    endDate: '2026-08-19',
    hero: { icon: '🌋', gradient: 'from-amber-900 via-orange-800 to-yellow-700' },
    days: [
      {
        date: 'Tuesday · Aug 18',
        isoDate: '2026-08-18',
        title: 'Ponza — Chiaia di Luna & Cala Feola',
        subtitle: 'Pontine Islands · Arrive ~5 PM · Italy’s Best-Kept Secret',
        imageUrl: satelliteImage('12.93,40.88,13.02,40.93', '640,320'),
        imageCaption: 'Ponza — crescent volcanic island, pastel harbour',
        overnight: 'At anchor · Chiaia di Luna',
        events: [
          { title: 'Arrive Ponza — pastel harbour after night passage', time: '17:00', link: mapsLink('Ponza Italy'), highlight: true },
          { title: 'Anchor off Chiaia di Luna beach', time: '18:00', link: mapsLink('Chiaia di Luna Ponza'), details: ['Beneath towering volcanic cliffs'], locationImage: satelliteImage('12.94,40.89,12.99,40.92', '320,160') },
          { title: 'Sunset cocktails from the deck — golden hour' },
          { title: 'Dinner at Acqua Pazza — colourful harbour', time: '21:00', link: mapsLink('Acqua Pazza Ponza'), details: ['1 Michelin Star · 20+ years'] },
          { title: 'Il Tramonto (alt) — finest waterfront on Ponza', link: mapsLink('Il Tramonto Ponza') },
        ],
      },
      {
        date: 'Wednesday · Aug 19',
        isoDate: '2026-08-19',
        title: 'Ponza — Rock Pools & Grotte di Pilato',
        subtitle: 'Pontine Islands · Full Day · Evening Departure',
        imageUrl: satelliteImage('12.94,40.92,12.99,40.95', '640,320'),
        imageCaption: 'Cala Feola — natural rock pools carved into volcanic stone',
        events: [
          { title: 'Cala Feola — natural swimming pools', time: '10:00', link: mapsLink('Cala Feola Ponza'), highlight: true },
          { title: 'Grotte di Pilato tender tour', time: '14:00', link: mapsLink('Grotte di Pilato Ponza'), details: ['Tiberius’s Roman moray eel farm', 'Ethereal turquoise light'], locationImage: satelliteImage('12.97,40.88,13.02,40.92', '320,160') },
          { title: 'Snorkel the caves', time: '15:30' },
          { title: 'Depart ~9 PM for Naples — Leg 6 night hop', time: '21:00', details: ['~75 nm · 6h 15m at 12 kn'], highlight: true },
        ],
        leg: {
          label: 'LEG 6 · NIGHT HOP',
          route: 'Ponza → Naples (Mergellina)',
          sub: 'Depart ~9 PM Aug 19 · Arrive ~3 AM Aug 20',
          miles: '86',
          duration: '6h 15m',
          knots: '12',
        },
      },
    ],
  },
  {
    id: 'naples-family-2026',
    name: 'Naples · Family Chapter',
    subtitle: 'Naples · Daniel & Marco onboard · Big family dock party · Aug 20–21',
    startDate: '2026-08-20',
    endDate: '2026-08-21',
    hero: { icon: '🍕', gradient: 'from-red-900 via-rose-800 to-amber-700' },
    guests: 'Enrico, Antoniette, Daniel & Marco onboard · big family party at the dock (evening of Aug 20 or 21 — date to confirm)',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Daniel', note: 'onboard' },
      { name: 'Marco', note: 'onboard' },
    ],
    days: [
      {
        date: 'Thursday · Aug 20',
        isoDate: '2026-08-20',
        title: 'Naples — Arrive Mergellina',
        subtitle: 'Campania · UNESCO historic centre · Family dock (tentative party night)',
        imageUrl: satelliteImage('14.20,40.81,14.30,40.87', '640,320'),
        imageCaption: 'Naples — Spaccanapoli, Vesuvius across the bay',
        dock: {
          marina: 'Porto di Mergellina · Napoli',
          marinaLink: mapsLink('Porto di Mergellina Napoli'),
          radioChannel: 'Ch 09',
          eta: '~03:00 Aug 20',
          etd: 'Overnight to Aug 22',
          notes: 'Overnight arrival ~3 AM Aug 20. Daniel & Marco onboard. Big family dock party tentatively this evening (or Aug 21 — to confirm).',
        },
        events: [
          { title: 'Wake aboard at Mergellina', time: '09:00', link: mapsLink('Mergellina Napoli'), highlight: true },
          { title: 'Spaccanapoli walk · Naples Sotterranea', time: '10:30', link: mapsLink('Napoli Sotterranea') },
          { title: 'Cathedral of San Gennaro', time: '13:30' },
          { title: 'Di Matteo pilgrimage — pizza margherita', time: '14:30', link: mapsLink('Di Matteo pizzeria Naples'), details: ['World’s finest pizza margherita'] },
          { title: 'Provisioning for remaining voyage' },
          { title: 'Big family party at the dock — Mergellina (Aug 20 OR Aug 21 — confirm)', time: '20:00', link: mapsLink('Porto di Mergellina Napoli'), details: ['Family gathering aboard and dockside', 'Music, dinner, celebration through the evening', 'Party is night of Aug 20 or Aug 21 — to be confirmed'], highlight: true },
          { title: 'Terrazza Calabritto (alt) — Vesuvius views rooftop', link: mapsLink('Terrazza Calabritto Naples'), details: ['Fine dining · Chiaia'] },
          { title: 'La Bersagliera (alt) — since 1919, Santa Lucia waterfront', link: mapsLink('La Bersagliera Naples') },
        ],
      },
      {
        date: 'Friday · Aug 21',
        isoDate: '2026-08-21',
        title: 'Naples · Pompeii & Vesuvius — Family Day',
        subtitle: 'Campania · Ancient world · Alternate party night',
        imageUrl: satelliteImage('14.46,40.74,14.52,40.77', '640,320'),
        imageCaption: 'Pompeii — frozen in 79 AD, Vesuvius overhead',
        events: [
          { title: 'Pompeii excursion', time: '09:00', link: mapsLink('Pompeii archaeological site'), highlight: true, locationImage: satelliteImage('14.46,40.74,14.52,40.77', '320,160') },
          { title: 'Vesuvius crater rim hike', time: '14:00', link: mapsLink('Mount Vesuvius crater'), details: ['Sweeping Bay of Naples views'], locationImage: satelliteImage('14.40,40.79,14.46,40.84', '320,160') },
          { title: 'Big family party at the dock — Mergellina (Aug 20 OR Aug 21 — confirm)', time: '20:00', link: mapsLink('Porto di Mergellina Napoli'), details: ['Alternate party night — confirm with family'], highlight: true },
          { title: 'Farewell family dinner aboard — Daniel & Marco last night', time: '20:30' },
        ],
      },
    ],
  },
  {
    id: 'naples-friends-2026',
    name: 'Naples → Aeolians · Friends Chapter',
    subtitle: '4 couples embark Naples · Capri · Positano · Stromboli · Aeolians · Catania · Aug 22–28',
    startDate: '2026-08-22',
    endDate: '2026-08-28',
    hero: { icon: '🌋', gradient: 'from-rose-900 via-purple-800 to-fuchsia-700' },
    guests: 'New chapter — 4 couples embark in Naples: Carlo & Denise, Charlie & Cecile, Vinny & Morissa, Stacy & husband',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Carlo', note: 'couple · embark Naples Aug 22' },
      { name: 'Denise', note: 'couple · embark Naples Aug 22' },
      { name: 'Charlie', note: 'couple · embark Naples Aug 22' },
      { name: 'Cecile', note: 'couple · embark Naples Aug 22' },
      { name: 'Vinny', note: 'couple · embark Naples Aug 22' },
      { name: 'Morissa', note: 'couple · embark Naples Aug 22' },
      { name: 'Stacy', note: 'couple · embark Naples Aug 22' },
      { name: "Stacy’s husband", note: 'couple · embark Naples Aug 22' },
    ],
    days: [
      {
        date: 'Saturday · Aug 22',
        isoDate: '2026-08-22',
        title: 'Naples — Welcome the Friends',
        subtitle: 'Mergellina · 4 couples embark · First evening aboard',
        imageUrl: satelliteImage('14.20,40.81,14.30,40.87', '640,320'),
        imageCaption: 'Naples — Mergellina harbour, Vesuvius across the bay',
        dock: {
          marina: 'Porto di Mergellina · Napoli',
          marinaLink: mapsLink('Porto di Mergellina Napoli'),
          radioChannel: 'Ch 09',
          eta: 'Docked from Aug 20',
          etd: 'Overnight to Capri',
          notes: 'Carlo & Denise, Charlie & Cecile, Vinny & Morissa, Stacy & husband embark today.',
        },
        events: [
          { title: 'Cabin turnover & fresh flowers', time: '08:00' },
          { title: 'Final provisioning for the friends leg' },
          { title: 'Charlie & Cecile, Vinny & Morissa, Stacy & husband, Carlo & Denise arrive', time: '15:00', highlight: true, details: ['Full welcome walkthrough · champagne on the sundeck'] },
          { title: 'Welcome cocktails on sundeck', time: '19:00' },
          { title: 'Welcome dinner aboard — Bay of Naples backdrop', time: '20:30', highlight: true },
          { title: 'Terrazza Calabritto (alt ashore) — Vesuvius rooftop', link: mapsLink('Terrazza Calabritto Naples') },
        ],
      },
      {
        date: 'Sunday · Aug 23',
        isoDate: '2026-08-23',
        title: 'Naples → Capri — Set Sail',
        subtitle: 'Short hop · Anchor Marina Piccola · Ease the friends into the trip',
        events: [
          { title: 'Depart Mergellina for Capri', time: '10:00', highlight: true },
          { title: 'Anchor Marina Piccola — Faraglioni views' },
          { title: 'Afternoon swim off the Faraglioni rocks', link: mapsLink('Faraglioni rocks Capri') },
          { title: 'Aperitivo on the sundeck', time: '18:30' },
          { title: 'Dinner aboard at anchor', time: '20:30' },
        ],
      },
      {
        date: 'Monday · Aug 24',
        isoDate: '2026-08-24',
        title: 'Capri — Blue Grotto at Dawn',
        subtitle: 'Gulf of Naples · Full Day · Island of Dreams',
        imageUrl: satelliteImage('14.20,40.54,14.27,40.57', '640,320'),
        imageCaption: 'Capri — Faraglioni rocks, the Piazzetta',
        overnight: 'At anchor · Marina Piccola, Capri',
        events: [
          { title: 'Tender to Blue Grotto at dawn — before tourist boats', time: '06:00', link: mapsLink('Blue Grotto Capri'), details: ['Bioluminescent silver-blue light'], highlight: true, locationImage: satelliteImage('14.20,40.55,14.22,40.56', '320,160') },
          { title: 'Anacapri boutiques', time: '10:30' },
          { title: 'Lunch at Da Paolino under 100 lemon trees', time: '13:30', link: mapsLink('Da Paolino Capri'), details: ['Most romantic restaurant in Capri'] },
          { title: 'Swim off the Faraglioni rocks', time: '16:00', link: mapsLink('Faraglioni rocks Capri'), locationImage: satelliteImage('14.24,40.54,14.26,40.56', '320,160') },
          { title: 'Sunset dinner at Villa Verde — the Piazzetta', time: '21:00', link: mapsLink('Villa Verde Capri'), details: ['Piazzetta’s most coveted table'] },
        ],
      },
      {
        date: 'Tuesday · Aug 25',
        isoDate: '2026-08-25',
        title: 'Positano — Full Day & Night Departure',
        subtitle: 'Amalfi Coast · Positano · Depart ~10 PM',
        imageUrl: satelliteImage('14.46,40.62,14.50,40.65', '640,320'),
        imageCaption: 'Positano — pastel cascade above turquoise water',
        events: [
          { title: 'Sail Capri → Positano, anchor off the village', time: '09:00', link: mapsLink('Positano Amalfi Coast'), highlight: true },
          { title: 'Swim in turquoise water below the houses' },
          { title: 'Boutique & lane wander' },
          { title: 'La Serra Michelin lunch — Le Agavi Hotel', time: '13:30', link: mapsLink('La Serra Le Agavi Positano'), details: ['1 Michelin Star · floor-to-ceiling coast views'] },
          { title: 'Rossellinis (alt) — Palazzo Avino, Ravello clifftop', link: mapsLink('Rossellinis Palazzo Avino Ravello') },
          { title: 'Sunset limoncello on the sundeck', time: '20:00' },
          { title: 'Depart ~10 PM for Aeolian Islands — Leg 7', time: '22:00', details: ['~155 nm · 12h 55m at 12 kn', 'Arrive Stromboli ~11 AM Aug 26'], highlight: true },
        ],
        leg: {
          label: 'LEG 7 · NIGHT PASSAGE',
          route: 'Naples / Amalfi → Stromboli, Aeolian Islands',
          sub: 'Depart ~10 PM Aug 25 · Arrive ~11 AM Aug 26',
          miles: '178',
          duration: '12h 55m',
          knots: '12',
        },
      },
      {
        date: 'Wednesday · Aug 26',
        isoDate: '2026-08-26',
        title: 'Stromboli — Lighthouse of the Mediterranean',
        subtitle: 'Aeolian Islands · Active Volcano · Arrive ~11 AM',
        imageUrl: satelliteImage('15.18,38.77,15.25,38.83', '640,320'),
        imageCaption: 'Stromboli — perfect cone erupting every 15 minutes',
        overnight: 'At anchor · Stromboli',
        events: [
          { title: 'Arrive Stromboli — eruption every 15 minutes', time: '11:00', link: mapsLink('Stromboli volcano'), highlight: true },
          { title: 'Anchor offshore' },
          { title: 'Guided crater trek — book via magmatrek.it', time: '17:00', link: 'https://www.magmatrek.it', details: ['Guided only', 'Returns near midnight'] },
          { title: 'Lava watch from deck with champagne', time: '23:30', highlight: true },
        ],
      },
      {
        date: 'Thursday · Aug 27',
        isoDate: '2026-08-27',
        title: 'Panarea · Lipari · Salina · Vulcano',
        subtitle: 'Aeolian Islands · Full Day Island Hopping · Depart evening for Catania',
        imageUrl: satelliteImage('15.04,38.61,15.11,38.66', '640,320'),
        imageCaption: 'Panarea · Lipari · Salina · Vulcano — UNESCO archipelago',
        events: [
          { title: 'Morning espresso on Panarea — car-free glamour', time: '09:00', link: mapsLink('Panarea Aeolian'), highlight: true, locationImage: satelliteImage('15.04,38.61,15.11,38.66', '320,160') },
          { title: 'Lipari castle & Filippino lunch', time: '13:00', link: mapsLink('Filippino Lipari'), details: ['Family-run since 1910', 'Best swordfish in the Aeolians'], locationImage: satelliteImage('14.93,38.45,15.00,38.52', '320,160') },
          { title: 'Maccotta (alt) — fresh seafood, Lipari old town', link: mapsLink('Maccotta Lipari') },
          { title: 'Malvasia at sunset on Salina', time: '18:30', link: mapsLink('Salina Aeolian Islands'), locationImage: satelliteImage('14.81,38.55,14.88,38.61', '320,160') },
          { title: 'Vulcano — sulphurous mud baths & fumarole snorkel', time: '20:00', link: mapsLink('Vulcano Aeolian Islands'), locationImage: satelliteImage('14.95,38.37,15.02,38.43', '320,160') },
          { title: 'Depart ~10 PM for Catania — Leg 8 night passage', time: '22:00', details: ['~85 nm · 7h 5m at 12 kn'], highlight: true },
        ],
        leg: {
          label: 'LEG 8 · NIGHT PASSAGE',
          route: 'Vulcano → Catania, Sicily',
          sub: 'Depart ~10 PM Aug 27 · Arrive ~5 AM Aug 28',
          miles: '98',
          duration: '7h 5m',
          knots: '12',
        },
      },
      {
        date: 'Friday · Aug 28',
        isoDate: '2026-08-28',
        title: 'Catania — Baroque Lava City',
        subtitle: 'Sicily · Arrive ~5 AM · Depart ~9 PM for Malta',
        imageUrl: satelliteImage('15.07,37.48,15.13,37.53', '640,320'),
        imageCaption: 'Catania — black lava stone baroque, Etna overhead',
        dock: {
          marina: 'Porto di Catania',
          marinaLink: mapsLink('Porto di Catania Sicilia'),
          radioChannel: 'Ch 09',
          eta: '~05:00',
          etd: '~21:00',
          notes: 'Commercial port. Confirm yacht berth and customs prior to arrival.',
        },
        events: [
          { title: 'Sleep aboard after overnight arrival', time: '05:00', highlight: true },
          { title: 'La Pescheria fish market', time: '10:00', link: mapsLink('La Pescheria Catania'), locationImage: satelliteImage('15.07,37.49,15.11,37.51', '320,160') },
          { title: 'Elephant fountain · Piazza del Duomo', time: '12:00', link: mapsLink('Piazza del Duomo Catania') },
          { title: 'Etna views overhead', locationImage: satelliteImage('14.95,37.71,15.05,37.79', '320,160') },
          { title: 'Sapio dinner — 1 Michelin Star', time: '20:00', link: mapsLink('Sapio Catania'), details: ['Volcanic soil ingredients · best in Catania'] },
          { title: 'Osteria Antica Marina (alt) — inside La Pescheria', link: mapsLink('Osteria Antica Marina Catania') },
          { title: 'Depart ~9 PM for Malta — Leg 9 night passage', time: '21:00', details: ['~100 nm · 8h 20m at 12 kn'], highlight: true },
        ],
        leg: {
          label: 'LEG 9 · NIGHT PASSAGE',
          route: 'Catania, Sicily → Valletta, Malta',
          sub: 'Depart ~9 PM Aug 28 · Arrive ~5:30 AM Aug 29',
          miles: '115',
          duration: '8h 20m',
          knots: '12',
        },
      },
    ],
  },
  {
    id: 'malta-2026',
    name: 'Malta — Brianna’s Wedding',
    subtitle: 'La Valletta marina dockage · Brianna & Matthew’s wedding · Blue Lagoon expedition · Aug 28–Sep 8',
    startDate: '2026-08-28',
    endDate: '2026-09-08',
    hero: { icon: '💒', gradient: 'from-red-900 via-rose-800 to-stone-700' },
    guests: 'Wedding chapter — Brianna & Matthew’s wedding in Malta · dockage at La Valletta marina Aug 28 – Sep 8 · Blue Lagoon expedition Sep 3 (≈30 guests)',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Brianna', note: 'bride' },
      { name: 'Matthew', note: 'groom' },
    ],
    days: [
      {
        date: 'Friday · Aug 28',
        isoDate: '2026-08-28',
        title: 'Catania → Malta — Night Passage',
        subtitle: 'Depart Catania ~21:00 · Overnight crossing to Grand Harbour',
        events: [
          { title: 'Depart Porto di Catania at ~21:00 — handoff from friends chapter', time: '21:00', highlight: true, details: ['See Friends chapter Aug 28 for daytime Catania plan'] },
          { title: 'Night watches underway', details: ['Standard sea watches · arrive Grand Harbour dawn'] },
        ],
        leg: {
          label: 'NIGHT PASSAGE',
          route: 'Catania, Sicily → Valletta, Malta',
          sub: 'Depart ~9 PM Aug 28 · Arrive ~5:30 AM Aug 29',
          miles: '115',
          duration: '8h 20m',
          knots: '12',
        },
      },
      {
        date: 'Saturday · Aug 29',
        isoDate: '2026-08-29',
        title: 'Valletta — Arrive at Dawn · Grand Harbour',
        subtitle: 'Malta · Marina di Valletta · UNESCO World Heritage Capital',
        imageUrl: satelliteImage('14.49,35.88,14.55,35.92', '640,320'),
        imageCaption: 'Grand Harbour dawn — baroque fortifications glow gold',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          radioChannel: 'Ch 13',
          eta: '~05:30 Aug 29',
          etd: '~07:00 Sep 8',
          notes: 'Full-chapter dockage at La Valletta marina (Aug 28 arrival evening → Sep 8 departure). Confirm berth allocation with VTS Grand Harbour on Ch 13. Wedding party access & shore-power confirmed.',
        },
        events: [
          { title: 'Grand Harbour dawn arrival — one of the great Med sights', time: '05:30', link: mapsLink('Grand Harbour Valletta'), highlight: true },
          { title: 'Dock at Marina di Valletta · sleep aboard' },
          { title: 'Three Cities water taxi', time: '14:00', link: mapsLink('Three Cities Vittoriosa Malta'), locationImage: satelliteImage('14.51,35.88,14.55,35.90', '320,160') },
          { title: 'Palace of the Grand Masters', time: '16:00', link: mapsLink('Grandmasters Palace Valletta') },
          { title: 'St John’s Co-Cathedral — Caravaggio', time: '17:30', link: mapsLink('St John’s Co-Cathedral Valletta') },
          { title: 'Under Grain — 1 Michelin Star, Rosselli AX Privilege', time: '20:30', link: mapsLink('Under Grain Valletta'), details: ['Seasonal tasting'] },
          { title: 'ION Harbour (alt) — Grand Harbour panorama terrace', link: mapsLink('ION Harbour Valletta') },
        ],
      },
      {
        date: 'Sunday · Aug 30',
        isoDate: '2026-08-30',
        title: 'Valletta — Three Cities & Old Town',
        subtitle: 'Malta · UNESCO World Heritage',
        events: [
          { title: 'Birgu · Senglea · Cospicua by water taxi', time: '10:00', link: mapsLink('Birgu Vittoriosa Malta'), highlight: true },
          { title: 'Palace of the Grand Masters — second visit', time: '14:00' },
          { title: 'St John’s Co-Cathedral — Caravaggio masterpieces', time: '15:30' },
          { title: 'Dinner at Under Grain — Michelin', time: '20:30', link: mapsLink('Under Grain Valletta') },
        ],
      },
      {
        date: 'Monday · Aug 31',
        isoDate: '2026-08-31',
        title: 'Ancient Temples & Mdina',
        subtitle: 'Malta · 5,000-year-old history',
        imageUrl: satelliteImage('14.39,35.88,14.44,35.91', '640,320'),
        imageCaption: 'Mdina — the Silent City, medieval hilltop',
        events: [
          { title: 'Ħaġar Qim & Mnajdra megalithic temples', time: '09:30', link: mapsLink('Hagar Qim Mnajdra Malta'), details: ['5,000 years old', 'Older than Stonehenge and the pyramids'], highlight: true, locationImage: satelliteImage('14.42,35.81,14.46,35.84', '320,160') },
          { title: 'Mdina — the Silent City, hilltop views', time: '14:00', link: mapsLink('Mdina Silent City Malta'), locationImage: satelliteImage('14.39,35.88,14.44,35.91', '320,160') },
          { title: 'De Mondion — 1 Michelin Star · Palazzo Xara', time: '20:30', link: mapsLink('De Mondion Mdina'), details: ['Mdina hilltop views'] },
          { title: 'Noni (alt) — contemporary Maltese tasting', link: mapsLink('Noni Valletta') },
        ],
      },
      {
        date: 'Tuesday · Sep 1',
        isoDate: '2026-09-01',
        title: 'Comino — Blue Lagoon',
        subtitle: 'Malta · Anchor Day · Turquoise Cove',
        imageUrl: satelliteImage('14.30,36.00,14.37,36.04', '640,320'),
        imageCaption: 'Blue Lagoon — impossibly clear turquoise between Comino & Cominotto',
        overnight: 'Return to Marina di Valletta',
        events: [
          { title: 'Early-morning Blue Lagoon anchor — before day-trippers', time: '07:00', link: mapsLink('Blue Lagoon Comino Malta'), highlight: true },
          { title: 'Snorkel · swim · paddleboard the crystal shallows' },
          { title: 'Return to Marina di Valletta', time: '18:00' },
          { title: 'Cocktails at Over Grain rooftop bar', time: '21:00', link: mapsLink('Over Grain Valletta') },
        ],
      },
      {
        date: 'Wednesday · Sep 2',
        isoDate: '2026-09-02',
        title: 'WWII Heritage & War Rooms',
        subtitle: 'Malta · George Cross History',
        events: [
          { title: 'Lascaris War Rooms — WWII underground HQ', time: '10:00', link: mapsLink('Lascaris War Rooms Valletta'), highlight: true },
          { title: 'Malta at War Museum — George Cross story', time: '13:30' },
          { title: 'ION Harbour dinner — panoramic terrace', time: '20:30', link: mapsLink('ION Harbour Valletta'), details: ['Possibly the finest view in Malta'] },
        ],
      },
      {
        date: 'Thursday · Sep 3',
        isoDate: '2026-09-03',
        title: 'Blue Lagoon Expedition — 30 Guests',
        subtitle: 'Comino · Blue Lagoon day charter · ≈30 guests aboard',
        imageUrl: satelliteImage('14.30,36.00,14.37,36.04', '640,320'),
        imageCaption: 'Blue Lagoon, Comino — turquoise between Comino & Cominotto',
        overnight: 'Return to Marina di Valletta',
        events: [
          { title: 'Guest muster & briefing — lifejackets, tender ops, headcount', time: '08:00', highlight: true, details: ['≈30 guests aboard for the day', 'Extra staff on deck · water toys prepped'] },
          { title: 'Depart Marina di Valletta for Blue Lagoon', time: '09:00' },
          { title: 'Anchor Blue Lagoon — turquoise shallows between Comino & Cominotto', time: '10:30', link: mapsLink('Blue Lagoon Comino Malta'), highlight: true },
          { title: 'Swim, snorkel, paddleboards, tender ops all day' },
          { title: 'Buffet lunch on the aft deck', time: '13:00' },
          { title: 'Return to Marina di Valletta', time: '17:30' },
          { title: 'Guest disembark · crew reset for evening', time: '18:30' },
          { title: 'Alchemy cocktails — old city (crew/guests optional)', time: '21:00', link: mapsLink('Alchemy Valletta') },
        ],
      },
      {
        date: 'Friday · Sep 4',
        isoDate: '2026-09-04',
        title: 'Culture & Fine Dining',
        subtitle: 'Malta · Arts & Gastronomy',
        events: [
          { title: 'MUZA — National Museum of Art at Auberge d\'Italie', time: '11:00', link: mapsLink('MUZA Valletta') },
          { title: 'Manoel Theatre performance — 1731', time: '19:30', link: mapsLink('Manoel Theatre Valletta'), details: ['One of Europe’s oldest working theatres'], highlight: true },
          { title: 'Trabuxu medieval wine cellar — pre-theatre', time: '18:30', link: mapsLink('Trabuxu wine bar Valletta') },
          { title: 'Noni — contemporary Maltese tasting', time: '22:00', link: mapsLink('Noni Valletta') },
        ],
      },
      {
        date: 'Saturday · Sep 5',
        isoDate: '2026-09-05',
        title: 'St Julian’s & Sliema Waterfront',
        subtitle: 'Malta · Leisure Day',
        imageUrl: satelliteImage('14.49,35.91,14.51,35.92', '640,320'),
        imageCaption: 'Balluta Bay · Sliema waterfront promenade',
        events: [
          { title: 'Balluta Bay swim', time: '11:00', link: mapsLink('Balluta Bay St Julians'), highlight: true, locationImage: satelliteImage('14.49,35.91,14.51,35.92', '320,160') },
          { title: 'Sliema waterfront promenade', time: '14:00', link: mapsLink('Sliema waterfront Malta'), locationImage: satelliteImage('14.49,35.90,14.52,35.92', '320,160') },
          { title: 'Hugo’s Terrace rooftop cocktails', time: '19:30', link: mapsLink('Hugo’s Terrace St Julians') },
          { title: 'Barracuda dinner — Balluta Bay waterfront', time: '21:00', link: mapsLink('Barracuda Balluta Bay'), details: ['Malta classic · fresh fish'] },
        ],
      },
      {
        date: 'Sunday · Sep 6',
        isoDate: '2026-09-06',
        title: 'Wedding Party Recovery Day',
        subtitle: 'Malta · Dockage day · Rest before farewell',
        events: [
          { title: 'Rest & spa day aboard', time: '10:00', highlight: true },
          { title: 'Last souvenirs in the city', time: '15:00' },
          { title: 'Palazzo Parisio rooftop — sunset drinks', time: '19:30', link: mapsLink('Palazzo Parisio Valletta') },
          { title: 'Bahia dinner — Valletta waterfront', time: '21:00', link: mapsLink('Bahia restaurant Valletta'), details: ['Grand Harbour views'] },
        ],
      },
      {
        date: 'Monday · Sep 7',
        isoDate: '2026-09-07',
        title: 'Malta Reset — Guest Turnover Prep',
        subtitle: 'La Valletta marina · Prepare cabins for post-wedding chapter',
        events: [
          { title: 'Provisioning for the Adriatic voyage', time: '09:00' },
          { title: 'Cabin turnover, laundry, deep clean', time: '10:00' },
          { title: 'Fuel & fresh water top-up' },
          { title: 'Post-wedding guests arrive: Daniel & Laura, Marco & Deanna', time: 'PM', highlight: true, details: ['Enrico & Antoniette + Brianna & Matthew stay aboard'] },
          { title: 'Welcome dinner aboard — new chapter kickoff', time: '20:30' },
        ],
      },
      {
        date: 'Tuesday · Sep 8',
        isoDate: '2026-09-08',
        title: 'Farewell Malta — Depart for Gozo',
        subtitle: 'La Valletta marina → Mgarr, Gozo · Short morning hop',
        events: [
          { title: 'Final departure checks', time: '07:00' },
          { title: 'Depart Marina di Valletta for Gozo', time: '08:00', highlight: true },
          { title: 'Arrive Mgarr Harbour, Gozo', time: '~09:30' },
        ],
        leg: {
          label: 'DAY HOP',
          route: 'Valletta → Mgarr Harbour, Gozo',
          sub: 'Morning Sep 8 · Arrive ~9:30 AM',
          miles: '17',
          duration: '1h 15m',
          knots: '12',
        },
      },
    ],
  },
  // =================================================================
  // CHAPTER NINE — GOZO (Sep 7–9, 2026)
  // =================================================================
  {
    id: 'gozo-2026',
    name: 'Gozo — Malta\u2019s Wild Sister',
    subtitle: 'Mgarr Harbour · Xlendi Bay · Inland Sea · Ggantija · Sep 8–10',
    startDate: '2026-09-08',
    endDate: '2026-09-10',
    hero: { icon: '\ud83c\udfdd\ufe0f', gradient: 'from-fuchsia-950 via-purple-900 to-rose-900' },
    guests: 'Post-wedding chapter — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Daniel' },
      { name: 'Laura' },
      { name: 'Marco' },
      { name: 'Deanna' },
      { name: 'Brianna' },
      { name: 'Matthew' },
    ],
    days: [
      {
        date: 'Tuesday · September 8',
        isoDate: '2026-09-08',
        title: 'Arrive Gozo — Xlendi Bay & Inland Sea',
        subtitle: 'Day 35 · Arrive Mgarr · Greener, quieter, more rugged than Malta',
        imageUrl: satelliteImage({ west: 14.18, south: 36.00, east: 14.36, north: 36.10 }, { w: 1000, h: 450 }),
        imageCaption: 'Gozo — northern Maltese archipelago',
        dock: {
          marina: 'Mgarr Harbour, Gozo',
          marinaLink: mapsLink('Mgarr Harbour Gozo Malta'),
          radioChannel: 'Ch 09',
          eta: '~9:30 AM Sep 7',
          etd: '~9 PM Sep 9',
          notes: 'Short hop from Valletta — clear customs with Mgarr harbourmaster',
        },
        events: [
          { time: '09:30', title: 'Arrive Mgarr Harbour, Gozo', link: mapsLink('Mgarr Harbour Gozo'), highlight: true },
          { title: 'Inland Sea swim — lagoon connected to open sea by a cave', link: mapsLink('Inland Sea Gozo Dwejra') },
          { title: 'Xlendi Bay cliffs — dramatic turquoise swimming', link: mapsLink('Xlendi Bay Gozo') },
          { title: 'Tender exploration of west coast sea caves' },
          {
            time: '20:30',
            title: 'Dinner at Ta\u2019 Rikardu, Victoria',
            link: mapsLink('Ta Rikardu Victoria Gozo'),
            details: ['Traditional Gozitan · Handmade cheese & local wine'],
            highlight: true,
          },
          { title: 'Alternative: Il-Kartell, Marsalforn Bay', link: mapsLink('Il-Kartell Marsalforn Gozo') },
        ],
        overnight: 'Mgarr Harbour, Gozo',
      },
      {
        date: 'Wednesday · September 9',
        isoDate: '2026-09-09',
        title: 'Ggantija Temples & Ramla Bay',
        subtitle: 'Day 36 · Ancient wonders & red sand beach',
        events: [
          { title: 'Morning: Ggantija megalithic temples — 5,500 years old', link: mapsLink('Ggantija Temples Gozo'), highlight: true, details: ['Among the world\u2019s oldest free-standing structures', 'Older than Stonehenge by 1,000 years'] },
          { title: 'Ramla Bay — terracotta-red sand & crystal-clear water', link: mapsLink('Ramla Bay Gozo') },
          { time: '18:00', title: 'Victoria Citadel sunset', link: mapsLink('Cittadella Victoria Gozo') },
          { time: '20:30', title: 'Dinner aboard or return to Ta\u2019 Rikardu' },
        ],
        overnight: 'Mgarr Harbour, Gozo',
      },
      {
        date: 'Thursday · September 10',
        isoDate: '2026-09-10',
        title: 'Gozo Farewell · Night Departure for Sicily',
        subtitle: 'Day 37 · Final morning swim · Depart ~9 PM',
        events: [
          { title: 'Final morning swim from anchor in Gozo\u2019s clear waters' },
          { title: 'Lazy harbourside lunch in Mgarr' },
          { title: 'Tender exploration of north coast coves' },
          { time: '21:00', title: 'Depart Mgarr for Syracuse, Sicily — night passage', highlight: true },
        ],
        overnight: 'Underway \u2192 Syracuse',
        leg: {
          label: 'Leg 11 · Night Departure',
          route: 'Gozo \u2192 Syracuse, Sicily',
          sub: 'Depart ~9 PM Sep 10 · Arrive ~4 AM Sep 11',
          miles: 69, // 60 nm × 1.15078
          duration: '5h 0m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER TEN — SICILY & AEOLIANS REVISITED (Sep 10–15)
  // =================================================================
  {
    id: 'sicily-aeolians-revisited-2026',
    name: 'Sicily & Aeolians Revisited',
    subtitle: 'Syracuse · Lipari · Salina · Filicudi · Alicudi · Panarea · Taormina',
    startDate: '2026-09-10',
    endDate: '2026-09-15',
    hero: { icon: '\ud83c\udfdb\ufe0f', gradient: 'from-slate-900 via-zinc-800 to-amber-900' },
    guests: 'Post-wedding voyage — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Daniel' }, { name: 'Laura' },
      { name: 'Marco' }, { name: 'Deanna' },
      { name: 'Brianna' }, { name: 'Matthew' },
    ],

    days: [
      {
        date: 'Thursday · September 10',
        isoDate: '2026-09-10',
        title: 'Syracuse — Greek Theatre & Ortigia Island',
        subtitle: 'Day 38 · Arrive 4 AM · Ancient capital of the Greek world',
        imageUrl: satelliteImage({ west: 15.20, south: 37.00, east: 15.35, north: 37.10 }, { w: 1000, h: 450 }),
        imageCaption: 'Syracuse & Ortigia Island, Sicily',
        dock: {
          marina: 'Marina di Siracusa (Ortigia)',
          marinaLink: mapsLink('Marina di Siracusa Ortigia'),
          radioChannel: 'Ch 09',
          eta: '~4 AM Sep 10',
          etd: '~10 PM Sep 10',
        },
        events: [
          { time: '04:00', title: 'Arrive Syracuse — sleep aboard', link: mapsLink('Marina di Siracusa Ortigia') },
          { title: 'Greek Theatre (5th century BC)', link: mapsLink('Teatro Greco Siracusa'), highlight: true, details: ['Still used for summer performances'] },
          { title: 'Temple of Apollo, Ortigia', link: mapsLink('Temple of Apollo Ortigia') },
          { title: 'Swim at Fountain of Arethusa cove', link: mapsLink('Fonte Aretusa Ortigia') },
          { time: '20:30', title: 'Dinner at Don Camillo (historic vaulted cellar)', link: mapsLink('Don Camillo Ortigia'), highlight: true },
          { title: 'Alternative: Zafferano Bistrot', link: mapsLink('Zafferano Bistrot Syracuse') },
          { time: '22:00', title: 'Depart Syracuse for Aeolian Islands' },
        ],
        overnight: 'Underway \u2192 Aeolians',
      },
      {
        date: 'Friday · September 11',
        isoDate: '2026-09-11',
        title: 'Aeolians Revisited — Lipari & Vulcano',
        subtitle: 'Day 39 · Day 1 of 3 · Arrive ~9 AM',
        events: [
          { time: '09:00', title: 'Anchor at Lipari main town', link: mapsLink('Lipari Aeolian Islands') },
          { title: 'Hilltop castle and archaeological museum', link: mapsLink('Castello di Lipari') },
          { title: 'Obsidian & pumice quarry views' },
          { title: 'Long harbour lunch' },
          { title: 'Afternoon swim at Vulcano black sand beach', link: mapsLink('Vulcano black sand beach') },
          { title: 'Second soak in sulphur mud baths', link: mapsLink('Vulcano mud baths') },
        ],
        overnight: 'Anchored \u2014 Aeolians',
      },
      {
        date: 'Saturday · September 12',
        isoDate: '2026-09-12',
        title: 'Salina & Filicudi — Untouched Western Isles',
        subtitle: 'Day 40 · Day 2 of 3 · Capers, Malvasia & sea caves',
        events: [
          { title: 'Salina — Il Postino filming location', link: mapsLink('Salina Aeolian Islands') },
          { title: 'Caper & Malvasia wine tasting', link: mapsLink('A Cannata Salina'), highlight: true },
          { title: 'Continue to remote Filicudi (no cars, no crowds)', link: mapsLink('Filicudi Aeolian Islands') },
          { title: 'Faraglione di Canna sea stack' },
          { title: 'Swim at Grotta del Bue Marino sea cave', link: mapsLink('Grotta del Bue Marino Filicudi') },
          { time: '20:30', title: 'Dinner at La Sirena, Filicudi', link: mapsLink('La Sirena Filicudi') },
        ],
        overnight: 'Anchored \u2014 Filicudi',
      },
      {
        date: 'Sunday · September 13',
        isoDate: '2026-09-13',
        title: 'Alicudi & Panarea — Final Aeolian Day',
        subtitle: 'Day 41 · Day 3 of 3 · Depart ~9 PM for Taormina',
        events: [
          { title: 'Alicudi — the remotest, wildest Aeolian (no roads)', link: mapsLink('Alicudi Aeolian Islands'), highlight: true },
          { title: 'Final swim in the clearest water of the archipelago' },
          { title: 'Sail to glamorous Panarea', link: mapsLink('Panarea Aeolian Islands') },
          { time: '19:00', title: 'Sunset aperitivo in whitewashed lanes of Panarea' },
          { time: '21:00', title: 'Depart Panarea for Taormina — night hop', highlight: true },
        ],
        overnight: 'Underway \u2192 Taormina',
      },
      {
        date: 'Monday · September 14',
        isoDate: '2026-09-14',
        title: 'Taormina & Catania — Sicily Farewell',
        subtitle: 'Day 42 · Arrive overnight · Full day · Depart evening Sep 15',
        imageUrl: satelliteImage({ west: 15.20, south: 37.65, east: 15.35, north: 37.90 }, { w: 1000, h: 500 }),
        imageCaption: 'Taormina & Etna, Sicily',
        events: [
          { title: 'Arrive Taormina cliffside anchorage — Etna backdrop', link: mapsLink('Taormina Sicily anchorage') },
          { title: 'Morning: 3rd-century Greek Theatre with Etna backdrop', link: mapsLink('Teatro Antico di Taormina'), highlight: true },
          { title: 'Swim at Isola Bella nature reserve', link: mapsLink('Isola Bella Taormina') },
          { title: 'Afternoon sail to Catania', link: mapsLink('Catania Marina Sicily') },
          { time: '20:30', title: 'Final Sicilian dinner — Otto Geleng (1 Michelin, Belmond Taormina)', link: mapsLink('Otto Geleng Taormina'), highlight: true, details: ['8 tables with Etna views'] },
          { title: 'Alternative: Sapio (1 Michelin, Catania)', link: mapsLink('Sapio Catania') },
          { title: 'Alternative: Osteria Antica Marina, Catania', link: mapsLink('Osteria Antica Marina Catania') },
        ],
        overnight: 'Catania',
        dock: {
          marina: 'Catania Marina',
          marinaLink: mapsLink('Catania Marina Sicily'),
          radioChannel: 'Ch 12',
          eta: '~3 PM Sep 14',
          etd: '~9 PM Sep 15',
        },
      },
      {
        date: 'Tuesday · September 15',
        isoDate: '2026-09-15',
        title: 'Catania → Crotone Crossing',
        subtitle: 'Day 42b · Depart ~9 PM for Calabria',
        events: [
          { title: 'Day at leisure in Catania ahead of crossing' },
          { time: '21:00', title: 'Depart Catania for Crotone, Calabria', highlight: true },
        ],
        overnight: 'Underway \u2192 Crotone',
        leg: {
          label: 'Leg 16 · Night Passage',
          route: 'Catania, Sicily \u2192 Crotone, Calabria',
          sub: 'Depart ~9 PM Sep 15 · Arrive ~9:30 AM Sep 16',
          miles: 173, // 150 nm × 1.15078
          duration: '12h 30m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER ELEVEN — CROTONE, CALABRIA (Sep 16)
  // =================================================================
  {
    id: 'crotone-calabria-2026',
    name: 'Crotone, Calabria',
    subtitle: 'Breaking the Ionian crossing · Pythagoras\u2019 ancient Kroton',
    startDate: '2026-09-16',
    endDate: '2026-09-16',
    hero: { icon: '\ud83c\udff0', gradient: 'from-red-950 via-red-900 to-amber-800' },
    guests: 'Post-wedding voyage — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Daniel' }, { name: 'Laura' },
      { name: 'Marco' }, { name: 'Deanna' },
      { name: 'Brianna' }, { name: 'Matthew' },
    ],

    days: [
      {
        date: 'Wednesday · September 16',
        isoDate: '2026-09-16',
        title: 'Crotone — Greek Colony on the Ionian',
        subtitle: 'Day 43 · Arrive ~9:30 AM · Full day · Depart ~9 PM for Corfu',
        imageUrl: satelliteImage({ west: 17.05, south: 39.00, east: 17.20, north: 39.15 }, { w: 1000, h: 450 }),
        imageCaption: 'Crotone, Calabria \u2014 Ionian coast',
        dock: {
          marina: 'Porto Vecchio di Crotone',
          marinaLink: mapsLink('Porto Vecchio Crotone'),
          radioChannel: 'Ch 09',
          eta: '~9:30 AM Sep 16',
          etd: '~9 PM Sep 16',
          notes: 'Quiet harbour — call ahead for berth assignment',
        },
        events: [
          { time: '09:30', title: 'Arrive Crotone — dock at Porto Vecchio', link: mapsLink('Porto Vecchio Crotone'), highlight: true },
          { title: 'Ancient Kroton — Pythagoras\u2019 school of mathematics (710 BC)' },
          { title: 'Castello di Carlo V overlooking the harbour', link: mapsLink('Castello di Carlo V Crotone') },
          { title: 'Archaeological museum — exceptional Greek bronzes', link: mapsLink('Museo Archeologico Nazionale Crotone') },
          { title: 'Swim at Capo Colonne — lone surviving column of the Temple of Hera', link: mapsLink('Capo Colonne Crotone'), highlight: true },
          { time: '20:00', title: 'Dinner at Da Ercole (Calabrian seafood & nduja)', link: mapsLink('Da Ercole Crotone'), highlight: true },
          { title: 'Alternative: Casa Rocca (historic centre)', link: mapsLink('Casa Rocca Crotone') },
          { time: '21:00', title: 'Depart Crotone for Corfu, Greece — night passage' },
        ],
        overnight: 'Underway \u2192 Corfu',
        leg: {
          label: 'Leg 17 · Night Passage',
          route: 'Crotone, Calabria \u2192 Corfu, Greece',
          sub: 'Depart ~9 PM Sep 16 · Arrive ~7:50 AM Sep 17',
          miles: 150, // 130 nm × 1.15078
          duration: '10h 50m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER TWELVE — CORFU (Sep 17)
  // =================================================================
  {
    id: 'corfu-2026',
    name: 'Corfu — Gateway to the Adriatic',
    subtitle: 'Old Fortress · Achilleion · Paleokastritsa',
    startDate: '2026-09-17',
    endDate: '2026-09-17',
    hero: { icon: '\ud83c\uddec\ud83c\uddf7', gradient: 'from-blue-950 via-sky-900 to-emerald-800' },
    guests: 'Post-wedding voyage — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Daniel' }, { name: 'Laura' },
      { name: 'Marco' }, { name: 'Deanna' },
      { name: 'Brianna' }, { name: 'Matthew' },
    ],

    days: [
      {
        date: 'Thursday · September 17',
        isoDate: '2026-09-17',
        title: 'Corfu Town & the Old Fortress',
        subtitle: 'Day 44 · Arrive ~7:50 AM · Full day · Depart evening for Albania',
        imageUrl: satelliteImage({ west: 19.85, south: 39.55, east: 20.05, north: 39.70 }, { w: 1000, h: 450 }),
        imageCaption: 'Corfu Town, Greece',
        dock: {
          marina: 'Marina Gouvia, Corfu',
          marinaLink: mapsLink('Marina Gouvia Corfu'),
          radioChannel: 'Ch 69',
          eta: '~7:50 AM Sep 17',
          etd: '~7 PM Sep 17',
          notes: 'Schengen exit — clear customs before Albania',
        },
        events: [
          { time: '07:50', title: 'Arrive Corfu — Marina Gouvia', link: mapsLink('Marina Gouvia Corfu'), highlight: true },
          { title: 'Venetian-built Old Fortress', link: mapsLink('Old Fortress Corfu'), highlight: true },
          { title: 'UNESCO Old Town \u2014 Venetian/French/British layers', link: mapsLink('Corfu Old Town UNESCO') },
          { title: 'Liston promenade & cafés', link: mapsLink('Liston Corfu') },
          { title: 'Achilleion Palace', link: mapsLink('Achilleion Palace Corfu') },
          { title: 'Swim at Paleokastritsa\u2019s turquoise coves', link: mapsLink('Paleokastritsa Corfu') },
          { time: '19:00', title: 'Dinner at Venetian Well', link: mapsLink('Venetian Well Corfu'), highlight: true, details: ['Romantic courtyard dining'] },
          { title: 'Alternative: To Tavernaki Tou Kapou', link: mapsLink('To Tavernaki Tou Kapou Corfu') },
          { time: '19:30', title: 'Depart Corfu for Saranda, Albania' },
        ],
        overnight: 'Underway \u2192 Saranda',
        leg: {
          label: 'Leg 18 · Short Hop',
          route: 'Corfu, Greece \u2192 Saranda, Albania',
          sub: 'Depart evening Sep 17 · Arrive ~2 AM Sep 18',
          miles: 29, // 25 nm × 1.15078
          duration: '2h 5m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER THIRTEEN — ALBANIAN RIVIERA (Sep 18–19)
  // =================================================================
  {
    id: 'albania-2026',
    name: 'Albanian Riviera',
    subtitle: 'Saranda · Ksamil Islands · Butrint UNESCO',
    startDate: '2026-09-18',
    endDate: '2026-09-19',
    hero: { icon: '\ud83c\udde6\ud83c\uddf1', gradient: 'from-red-950 via-rose-900 to-orange-800' },
    guests: 'Post-wedding voyage — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Daniel' }, { name: 'Laura' },
      { name: 'Marco' }, { name: 'Deanna' },
      { name: 'Brianna' }, { name: 'Matthew' },
    ],

    days: [
      {
        date: 'Friday · September 18',
        isoDate: '2026-09-18',
        title: 'Saranda & Ksamil Islands',
        subtitle: 'Day 45 · Arrive ~2 AM · Europe\u2019s undiscovered gem',
        imageUrl: satelliteImage({ west: 19.95, south: 39.75, east: 20.15, north: 39.95 }, { w: 1000, h: 450 }),
        imageCaption: 'Ksamil & Saranda, Albanian Riviera',
        dock: {
          marina: 'Port of Saranda',
          marinaLink: mapsLink('Port of Saranda Albania'),
          radioChannel: 'Ch 16',
          eta: '~2 AM Sep 18',
          etd: '~8 PM Sep 19',
          notes: 'Albanian customs/immigration on arrival — passports ready, allow 1 hour',
        },
        events: [
          { time: '02:00', title: 'Arrive Saranda — port clearance', link: mapsLink('Port of Saranda Albania'), highlight: true },
          { title: 'Ksamil Islands \u2014 four small islands, white sand, turquoise water', link: mapsLink('Ksamil Islands Albania'), highlight: true },
          { title: 'Anchor off Ksamil and swim in extraordinary clarity' },
          { time: '13:30', title: 'Lunch ashore — fresh Albanian seafood' },
          { time: '20:00', title: 'Dinner at Guvat Restaurant', link: mapsLink('Guvat Restaurant Saranda'), highlight: true, details: ['Top-rated in Saranda · Grilled sea bream · Ionian views'] },
          { title: 'Alternative: Limani Restaurant', link: mapsLink('Limani Restaurant Saranda') },
        ],
        overnight: 'Saranda',
      },
      {
        date: 'Saturday · September 19',
        isoDate: '2026-09-19',
        title: 'Butrint UNESCO & Riviera Coves',
        subtitle: 'Day 46 · Ancient ruins & secluded anchorages · Depart ~8 PM',
        events: [
          { time: '09:00', title: 'Morning excursion to Butrint UNESCO', link: mapsLink('Butrint National Park Albania'), highlight: true, details: ['Greek, Roman, Byzantine and Venetian layers in jungle lakeside setting'] },
          { title: 'Afternoon: anchor in a secluded cove between Himara & Dhermi', link: mapsLink('Dhermi Albania') },
          { title: 'Private swim in iridescent blue water' },
          { time: '20:00', title: 'Depart Saranda for Porto Montenegro, Tivat', highlight: true },
        ],
        overnight: 'Underway \u2192 Porto Montenegro',
        leg: {
          label: 'Leg 18b · Night Passage',
          route: 'Saranda, Albania \u2192 Porto Montenegro, Tivat',
          sub: 'Depart ~8 PM Sep 19 · Arrive ~4 AM Sep 20',
          miles: 115, // 100 nm × 1.15078
          duration: '8h 20m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER FOURTEEN — MONTENEGRO, BAY OF KOTOR (Sep 20–22)
  // =================================================================
  {
    id: 'montenegro-2026',
    name: 'Montenegro — Bay of Kotor',
    subtitle: 'Porto Montenegro · Kotor UNESCO · Perast',
    startDate: '2026-09-20',
    endDate: '2026-09-22',
    hero: { icon: '\ud83c\udf0a', gradient: 'from-amber-900 via-stone-800 to-slate-900' },
    guests: 'Post-wedding voyage — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Daniel' }, { name: 'Laura' },
      { name: 'Marco' }, { name: 'Deanna' },
      { name: 'Brianna' }, { name: 'Matthew' },
    ],

    days: [
      {
        date: 'Sunday · September 20',
        isoDate: '2026-09-20',
        title: 'Porto Montenegro & Bay of Kotor',
        subtitle: 'Day 47 · Arrive ~4 AM · Fjord of the South',
        imageUrl: satelliteImage({ west: 18.55, south: 42.40, east: 18.90, north: 42.55 }, { w: 1000, h: 450 }),
        imageCaption: 'Bay of Kotor, Montenegro',
        dock: {
          marina: 'Porto Montenegro, Tivat',
          marinaLink: mapsLink('Porto Montenegro Marina Tivat'),
          radioChannel: 'Ch 71',
          eta: '~4 AM Sep 20',
          etd: 'Morning Sep 22',
          notes: 'Superyacht marina · Montenegrin customs clearance on arrival',
        },
        events: [
          { time: '04:00', title: 'Arrive & dock Porto Montenegro, Tivat', link: mapsLink('Porto Montenegro Marina Tivat'), highlight: true },
          { title: 'Kotor UNESCO old town (15 min by tender)', link: mapsLink('Kotor Old Town Montenegro') },
          { title: 'Mountain fjord views from deck at golden hour' },
          { time: '20:00', title: 'Dinner at Galion', link: mapsLink('Galion Restaurant Kotor'), highlight: true, details: ['Waterfront terrace · Most precise seafood on the Adriatic'] },
          { title: 'Alternative: Bastion (fortress walls, 5-course tasting)', link: mapsLink('Bastion Restaurant Perast') },
        ],
        overnight: 'Porto Montenegro',
      },
      {
        date: 'Monday · September 21',
        isoDate: '2026-09-21',
        title: 'Kotor, Perast & Our Lady of the Rocks',
        subtitle: 'Day 48 · Medieval city & island churches',
        events: [
          { title: 'Walk the 4.5km medieval walls to Fort St John, Kotor', link: mapsLink('Fort St John Kotor'), highlight: true },
          { title: 'Tender to Perast — perfectly preserved baroque town', link: mapsLink('Perast Montenegro') },
          { title: 'Our Lady of the Rocks island church', link: mapsLink('Our Lady of the Rocks Perast'), highlight: true, details: ['Man-made island of sunken ships over centuries'] },
          { time: '20:00', title: 'Dinner aboard or return to Galion' },
        ],
        overnight: 'Porto Montenegro',
      },
      {
        date: 'Tuesday · September 22',
        isoDate: '2026-09-22',
        title: 'Porto Montenegro → Dubrovnik',
        subtitle: 'Day 48b · Morning departure · Arrive ~1 PM',
        events: [
          { time: '09:00', title: 'Depart Porto Montenegro for Dubrovnik' },
          { time: '13:00', title: 'Arrive Dubrovnik — ACI Marina', highlight: true },
        ],
        overnight: 'ACI Marina Dubrovnik',
        leg: {
          label: 'Leg 19 · Day Hop',
          route: 'Porto Montenegro \u2192 Dubrovnik, Croatia',
          sub: 'Morning Sep 22 · Arrive ~1 PM',
          miles: 52, // 45 nm × 1.15078
          duration: '3h 45m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER FIFTEEN — DUBROVNIK (Sep 22–24)
  // =================================================================
  {
    id: 'dubrovnik-2026',
    name: 'Dubrovnik — Pearl of the Adriatic',
    subtitle: 'UNESCO City Walls · Lokrum · Elaphiti · Pelješac wine',
    startDate: '2026-09-22',
    endDate: '2026-09-24',
    hero: { icon: '\ud83c\udff0', gradient: 'from-sky-950 via-blue-900 to-amber-700' },
    guests: 'Post-wedding voyage — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Daniel' }, { name: 'Laura' },
      { name: 'Marco' }, { name: 'Deanna' },
      { name: 'Brianna' }, { name: 'Matthew' },
    ],

    days: [
      {
        date: 'Tuesday · September 22',
        isoDate: '2026-09-22',
        title: 'Dubrovnik — Arrival & City Walls',
        subtitle: 'Day 49 · UNESCO World Heritage · Arrive afternoon',
        imageUrl: satelliteImage({ west: 18.05, south: 42.60, east: 18.20, north: 42.70 }, { w: 1000, h: 450 }),
        imageCaption: 'Dubrovnik Old Town, Croatia',
        dock: {
          marina: 'ACI Marina Dubrovnik',
          marinaLink: mapsLink('ACI Marina Dubrovnik'),
          radioChannel: 'Ch 17',
          eta: '~1 PM Sep 22',
          etd: 'Morning Sep 25',
          notes: 'Croatia is EU/Schengen \u2014 re-entering Schengen zone',
        },
        events: [
          { time: '13:00', title: 'Dock at ACI Marina Dubrovnik', link: mapsLink('ACI Marina Dubrovnik'), highlight: true },
          { title: 'Walk the complete 2km circuit of the city walls', link: mapsLink('Dubrovnik City Walls'), highlight: true, details: ['Finest intact medieval fortifications anywhere'] },
          { title: 'Sunset paints the terracotta rooftops gold' },
          { time: '20:30', title: 'Dinner at Restaurant 360 (city wall bastion)', link: mapsLink('Restaurant 360 Dubrovnik'), highlight: true, details: ['Most dramatic setting · Views directly over the Adriatic'] },
          { title: 'Alternative: Nautika (terrace above the Adriatic)', link: mapsLink('Nautika Restaurant Dubrovnik') },
        ],
        overnight: 'ACI Marina Dubrovnik',
      },
      {
        date: 'Wednesday · September 23',
        isoDate: '2026-09-23',
        title: 'Lokrum Island & Elaphiti Islands',
        subtitle: 'Day 50 · Day cruise & swimming',
        events: [
          { title: 'Morning tender to Lokrum Island nature reserve', link: mapsLink('Lokrum Island Dubrovnik'), details: ['Peacocks · Botanical garden · Clear swimming coves'] },
          { title: 'Afternoon cruise to the Elaphiti Islands', link: mapsLink('Elaphiti Islands Croatia'), highlight: true, details: ['Secluded swimming in deserted turquoise coves'] },
          { time: '19:00', title: 'Cocktails on deck watching the old city lights' },
          { time: '20:30', title: 'Dinner at Nautika', link: mapsLink('Nautika Restaurant Dubrovnik'), highlight: true },
        ],
        overnight: 'ACI Marina Dubrovnik',
      },
      {
        date: 'Thursday · September 24',
        isoDate: '2026-09-24',
        title: 'Old City & Pelješac Wine',
        subtitle: 'Day 51 · Culture & wine',
        events: [
          { title: 'Rector\u2019s Palace, Dominican monastery, Stradun', link: mapsLink('Rector\u2019s Palace Dubrovnik') },
          { title: 'Private car to Pelješac Peninsula', link: mapsLink('Peljesac Peninsula Croatia') },
          { title: 'Dingač cliff vineyard wine tasting', link: mapsLink('Dingac vineyards Peljesac'), highlight: true, details: ['One of Croatia\u2019s greatest red wines · Sheer cliff vineyards facing the sea'] },
          { time: '20:30', title: 'Final Dubrovnik dinner at Proto (est. 1886)', link: mapsLink('Proto Restaurant Dubrovnik'), highlight: true },
        ],
        overnight: 'ACI Marina Dubrovnik',
      },
    ],
  },

  // =================================================================
  // CHAPTER SIXTEEN — HVAR & SPLIT (Sep 25–30)
  // =================================================================
  {
    id: 'hvar-split-2026',
    name: 'Hvar & Split — The Dalmatian Crown',
    subtitle: 'Pakleni · Palmižana · Stari Grad · Diocletian\u2019s Palace · Final Leg',
    startDate: '2026-09-25',
    endDate: '2026-09-30',
    hero: { icon: '\ud83c\udf47', gradient: 'from-blue-950 via-indigo-900 to-rose-800' },
    guests: 'Post-wedding voyage — Enrico & Antoniette, Daniel & Laura, Marco & Deanna, Brianna & Matthew',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Daniel' }, { name: 'Laura' },
      { name: 'Marco' }, { name: 'Deanna' },
      { name: 'Brianna' }, { name: 'Matthew' },
    ],

    days: [
      {
        date: 'Friday · September 25',
        isoDate: '2026-09-25',
        title: 'Hvar — Arrival & Pakleni Islands',
        subtitle: 'Day 52 · Arrive afternoon · Lavender island',
        imageUrl: satelliteImage({ west: 16.40, south: 43.10, east: 16.80, north: 43.25 }, { w: 1000, h: 450 }),
        imageCaption: 'Hvar & Pakleni Islands, Croatia',
        dock: {
          marina: 'ACI Marina Palmižana / Hvar Town Harbour',
          marinaLink: mapsLink('ACI Marina Palmizana Hvar'),
          radioChannel: 'Ch 17',
          eta: '~2 PM Sep 25',
          etd: 'Morning Sep 28',
          notes: 'Anchor off Pakleni Islands or moor in Hvar town \u2014 weather dependent',
        },
        events: [
          { time: '09:00', title: 'Depart Dubrovnik for Hvar', link: mapsLink('ACI Marina Dubrovnik') },
          { time: '14:00', title: 'Arrive Hvar \u2014 anchor off Pakleni Islands', link: mapsLink('Pakleni Islands Hvar'), highlight: true },
          { title: 'Long swim in gin-clear turquoise water' },
          { time: '19:00', title: 'Cocktails at Hula Hula Beach Bar (legendary Hvar sunset)', link: mapsLink('Hula Hula Beach Bar Hvar'), highlight: true },
          { time: '21:00', title: 'Dinner at Gariful on the harbour', link: mapsLink('Gariful Restaurant Hvar'), highlight: true },
          { title: 'Alternative: Mediterraneo Dine & Wine', link: mapsLink('Mediterraneo Hvar') },
          { title: 'Alternative: San Marco (Palace Elisabeth Hotel)', link: mapsLink('San Marco Hvar Palace Elisabeth') },
        ],
        overnight: 'Hvar / Pakleni',
        leg: {
          label: 'Leg 20 · Day Sail',
          route: 'Dubrovnik \u2192 Hvar Island',
          sub: 'Morning Sep 25 · Arrive ~2 PM',
          miles: 69, // 60 nm × 1.15078
          duration: '5h 0m',
          knots: 12,
        },
      },
      {
        date: 'Saturday · September 26',
        isoDate: '2026-09-26',
        title: 'Palmižana Lagoon & Hvar Old Town',
        subtitle: 'Day 53 · Full day Hvar',
        events: [
          { title: 'Anchor in Palmižana\u2019s turquoise lagoon', link: mapsLink('Palmizana Lagoon Hvar'), highlight: true, details: ['Water so clear you can count the stones on the bottom'] },
          { time: '13:30', title: 'Lunch at Meneghello, Palmižana', link: mapsLink('Meneghello Palmizana Hvar'), highlight: true, details: ['Legendary island restaurant under the pines'] },
          { title: 'Afternoon in Hvar old town \u2014 Renaissance Loggia', link: mapsLink('Renaissance Loggia Hvar') },
          { title: 'Medieval Fortica fortress', link: mapsLink('Fortica Fortress Hvar') },
        ],
        overnight: 'Hvar / Pakleni',
      },
      {
        date: 'Sunday · September 27',
        isoDate: '2026-09-27',
        title: 'Stari Grad & Milna Cove',
        subtitle: 'Day 54 · Ancient city & final Hvar evening',
        events: [
          { title: 'Sail to Stari Grad \u2014 oldest city in Croatia (384 BC)', link: mapsLink('Stari Grad Hvar'), highlight: true, details: ['UNESCO-listed agricultural plain unchanged since antiquity'] },
          { title: 'Swim at Milna cove \u2014 perfect turquoise horseshoe', link: mapsLink('Milna Cove Hvar') },
          { time: '19:00', title: 'Champagne on deck for last sunset before Split', highlight: true },
        ],
        overnight: 'Hvar / Stari Grad',
      },
      {
        date: 'Monday · September 28',
        isoDate: '2026-09-28',
        title: 'Hvar → Split Crossing Day',
        subtitle: 'Day 54b · Final cruising leg of the voyage',
        events: [
          { title: 'Final morning anchorage swim' },
          { title: 'Afternoon at leisure aboard before Split crossing' },
        ],
        overnight: 'Hvar',
      },
      {
        date: 'Tuesday · September 29',
        isoDate: '2026-09-29',
        title: 'Split — Arrival & Diocletian\u2019s Palace',
        subtitle: 'Day 55 · Arrive ~10 AM',
        imageUrl: satelliteImage({ west: 16.40, south: 43.45, east: 16.55, north: 43.55 }, { w: 1000, h: 450 }),
        imageCaption: 'Split & Diocletian\u2019s Palace, Croatia',
        dock: {
          marina: 'ACI Marina Split',
          marinaLink: mapsLink('ACI Marina Split'),
          radioChannel: 'Ch 17',
          eta: '~10 AM Sep 29',
          etd: 'Morning Sep 30 (final disembarkation)',
        },
        events: [
          { time: '09:00', title: 'Depart Hvar for Split' },
          { time: '10:00', title: 'Arrive ACI Marina Split', link: mapsLink('ACI Marina Split'), highlight: true },
          { title: 'Diocletian\u2019s Palace (4th century Roman)', link: mapsLink('Diocletian\u2019s Palace Split'), highlight: true, details: ['Unique in the world \u2014 living city inside imperial walls for 1,700 years'] },
          { title: 'Peristyle & Cathedral of Saint Domnius', link: mapsLink('Cathedral of Saint Domnius Split') },
          { time: '20:30', title: 'Dinner at Sperun inside the old town walls', link: mapsLink('Sperun Restaurant Split'), highlight: true },
          { title: 'Alternative: Kadena (400+ wines)', link: mapsLink('Kadena Restaurant Split') },
          { title: 'Alternative: ZOI (Riva promenade, Diocletian views)', link: mapsLink('ZOI Restaurant Split') },
        ],
        overnight: 'ACI Marina Split',
        leg: {
          label: 'Leg 21 · Final Leg',
          route: 'Hvar \u2192 Split',
          sub: 'Morning Sep 29 · Arrive ~10 AM',
          miles: 29, // 25 nm × 1.15078
          duration: '2h 5m',
          knots: 12,
        },
      },
      {
        date: 'Wednesday · September 30',
        isoDate: '2026-09-30',
        title: 'Bacvice, Brač & Farewell — Journey\u2019s End',
        subtitle: 'Day 56 · 56 days · ~2,270 nm · 17 legs complete',
        events: [
          { time: '08:00', title: 'Final morning swim at Bacvice (Picigin game beach)', link: mapsLink('Bacvice Beach Split') },
          { title: 'Half-day cruise to Brač island \u2014 anchor off Zlatni Rat', link: mapsLink('Zlatni Rat Brac'), highlight: true, details: ['The Golden Cape \u2014 one of Croatia\u2019s most spectacular beaches'] },
          { title: 'Last walk through the marble-flagged Peristyle' },
          { title: 'Espresso at Gradska Kavana inside the palace walls', link: mapsLink('Gradska Kavana Split') },
          { time: '19:00', title: 'Champagne toast on deck', highlight: true },
          { time: '20:30', title: 'Farewell dinner at Dvor rooftop', link: mapsLink('Dvor Restaurant Split'), highlight: true },
          { title: 'Disembarkation in the morning' },
        ],
        overnight: 'ACI Marina Split',
      },
    ],
  },
]

export function findTripById(id: string): Trip | undefined {
  return TRIPS.find(t => t.id === id)
}

/**
 * Fetch a trip — returns the server override merged on top of the baked-in trip.
 *
 * Merge policy (bug fix 2026-08): earlier versions returned the server
 * snapshot verbatim, which meant that once a user had ever saved a trip,
 * later seed changes (renames, added days, corrected times, new locations)
 * were permanently masked by the stale snapshot — exactly the "my edits
 * disappeared" symptom we saw with the Naples chapter split.
 *
 * The seed is now source of truth for structure. The server override only
 * contributes the fields users actually author on trip cards: `guests` and
 * `guestList`. All other fields (name/subtitle/dates/hero/days/events/
 * locations) flow through from the current seed, so future seed edits are
 * visible immediately and cannot be silently overwritten by an old row.
 * (Per-day free-text notes live in a separate `Notes` sheet keyed by
 * tripId+date; they are unaffected by seed changes.)
 */
export async function loadTrip(id: string): Promise<Trip | undefined> {
  const baseline = findTripById(id)
  try {
    const resp = await fetch(`/api/trips?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (resp.ok) {
      const data = (await resp.json()) as { trip: Trip | null }
      const override = data?.trip
      if (override && baseline) return mergeTripOverride(baseline, override)
      // If we have no baseline (unknown id) but the server has a snapshot, use it.
      if (override && !baseline) return override
    }
  } catch {
    // ignore — fall back to baseline
  }
  return baseline
}

/**
 * Merge a saved override onto a seed baseline. Only user-authored fields
 * are copied from the override so seed changes remain visible.
 */
function mergeTripOverride(baseline: Trip, override: Partial<Trip>): Trip {
  const merged: Trip = { ...baseline }
  if (override.guests !== undefined) merged.guests = override.guests
  if (override.guestList !== undefined) merged.guestList = override.guestList
  return merged
}

/**
 * Persist a trip override to the backend.
 *
 * We only send the user-authored fields (`guests`, `guestList`) so we don't
 * bake the current seed into the override row. The load path is
 * override-on-top-of-seed, so preserving the full snapshot buys us nothing
 * and would only re-introduce the "stale snapshot masks seed changes" bug
 * that we just fixed in `loadTrip`.
 */
export async function saveTrip(trip: Trip, user?: string): Promise<{ ok: boolean; detail?: string }> {
  const overrideOnly: Partial<Trip> & { id: string } = {
    id: trip.id,
    guests: trip.guests,
    guestList: trip.guestList,
  }
  try {
    const resp = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trip.id, trip: overrideOnly, user: user || 'crew' }),
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
