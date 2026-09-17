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
    name: 'Sardinia → Ponza',
    subtitle: 'Bonifacio · Maddalena · Poltu Quatu · Cala di Volpe · Cala Luna · Palmarola · Ponza · Ventotene · Aug 12–19',
    startDate: '2026-08-12',
    endDate: '2026-08-19',
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
        title: 'Cove near Poltu Quatu → Poltu Quatu Dock',
        subtitle: 'Morning cove anchor · Marina di Poltu Quatu overnight',
        imageUrl: satelliteImage('9.48,41.13,9.55,41.18', '640,320'),
        imageCaption: 'Poltu Quatu — hidden Costa Smeralda inlet between granite cliffs',
        dock: {
          marina: 'Marina di Poltu Quatu',
          marinaLink: mapsLink('Marina di Poltu Quatu'),
          radioChannel: 'Ch 09',
          eta: '15:00–16:00 Aug 14',
          etd: 'Morning Aug 15',
          notes: 'Poltu Quatu — tucked granite-cliff marina between Baja Sardinia and Porto Cervo. Confirm berth & port agent.',
        },
        events: [
          { title: 'Lift anchor from Maddalena', time: '08:00', highlight: true },
          { title: 'Cruise south toward Poltu Quatu' },
          { title: 'Anchor in a cove near Poltu Quatu — swim / tender / lunch aboard', link: mapsLink('coves near Poltu Quatu Sardinia') },
          { title: 'Dock at Marina di Poltu Quatu for the night', time: '15:00', highlight: true },
          { title: 'Stroll the piazzetta — boutiques, cafes, waterfront bars' },
          { title: 'Dinner at ConFusion — Chef Italo Bassi (short tender / taxi to Porto Cervo)', time: '21:00', link: mapsLink('ConFusion Porto Cervo'), details: ['1 Michelin Star · 6 consecutive years'] },
          { title: 'La Pergola (alt) — Hotel Cala di Volpe', link: mapsLink('La Pergola Cala di Volpe') },
        ],
      },
      {
        date: 'Saturday · Aug 15',
        isoDate: '2026-08-15',
        title: 'Cala di Volpe Mooring · Beach Picnic · Ferragosto',
        subtitle: 'Pick up mooring 14:00 · Beach setup + picnic · Italy’s biggest summer celebration',
        imageUrl: satelliteImage('9.55,41.09,9.62,41.14', '640,320'),
        imageCaption: 'Cala di Volpe — Costa Smeralda’s most photographed bay',
        overnight: 'Mooring ball · Cala di Volpe',
        events: [
          { title: 'Leave Poltu Quatu in the morning', time: '09:00', highlight: true },
          { title: 'Pick up mooring ball at Cala di Volpe', time: '14:00', link: mapsLink('Cala di Volpe Sardinia'), highlight: true },
          { title: 'Beach setup ashore — tender in with umbrellas, loungers, spread', time: '14:30', details: ['Deck crew ashore with beach kit before guests'] },
          { title: 'Beach picnic on Cala di Volpe sand', time: '15:00', highlight: true },
          { title: 'Swim, tender, paddleboard through the afternoon' },
          { title: 'Provision fully — everything closes on the 15th', details: ['Critical: confirm with stewardess before noon'] },
          { title: 'Champagne dinner on deck', time: '20:30' },
          { title: 'Ferragosto fireworks from the sundeck', time: '23:00', highlight: true, details: ['Big holiday — fireworks light up the Sardinian coast'] },
        ],
      },
      {
        date: 'Sunday · Aug 16',
        isoDate: '2026-08-16',
        title: 'Cala Luna → Overnight crossing to Palmarola',
        subtitle: 'Afternoon at Cala Luna · Evening departure · Overnight passage to the Pontines',
        imageUrl: satelliteImage('9.55,40.28,9.68,40.34', '640,320'),
        imageCaption: 'Cala Luna — limestone arch, accessible only by sea',
        overnight: 'Underway · overnight crossing Sardinia → Palmarola (~180 nm)',
        events: [
          { title: 'Anchor off Cala Luna — afternoon swim & tender', time: '14:00', link: mapsLink('Cala Luna Sardegna'), highlight: true, details: ['Iconic Golfo di Orosei cove · limestone cliffs & sea caves', 'Tender to Grotta del Bue Marino (guided) if time allows'], locationImage: satelliteImage('9.61,40.29,9.65,40.32', '320,160') },
          { title: 'Weigh anchor · depart Cala Luna for Spiaggia delle Grottelle', time: '18:30', highlight: true, details: ['Overnight crossing to the Pontines', '~180 nm · ~15h at 12 kn — ETA Palmarola AM Aug 17'] },
        ],
        leg: {
          label: 'LEG · NIGHT CROSSING',
          route: 'Cala Luna (Sardinia) → Spiaggia delle Grottelle (Palmarola)',
          sub: 'Depart ~18:30 Aug 16 · arrive ~09:30 Aug 17',
          miles: '180',
          duration: '15h',
          knots: '12',
        },
      },
      {
        date: 'Monday · Aug 17',
        isoDate: '2026-08-17',
        title: 'Palmarola morning · Chiaia di Luna afternoon · Ponza dinner',
        subtitle: 'Tender expedition at Grottelle · afternoon swim at Chiaia di Luna · cliffside dinner in Ponza',
        imageUrl: satelliteImage('12.83,40.88,13.02,40.96', '640,320'),
        imageCaption: 'Palmarola islet + Ponza — Pontine archipelago',
        overnight: 'At anchor · Ponza bay (Cala Feola / Frontone area, wind-dependent)',
        events: [
          { title: 'Arrive Spiaggia delle Grottelle — Palmarola', time: '09:30', link: mapsLink('Spiaggia delle Grottelle Palmarola'), highlight: true, details: ['Wild uninhabited islet · dramatic tufa cliffs', 'Anchor off the west side'], locationImage: satelliteImage('12.83,40.92,12.89,40.96', '320,160') },
          { title: 'Tender expedition — sea caves, arches & tufo pinnacles', time: '10:30', details: ['Cathedral rock · cave circuit · snorkel stops', 'Full morning ashore / on the tender'] },
          { title: 'Lunch on board · last swim off Grottelle', time: '12:30' },
          { title: 'Weigh anchor · short hop to Chiaia di Luna (Ponza)', time: '13:30', details: ['~5 nm across to the west side of Ponza'] },
          { title: 'Anchor off Chiaia di Luna · swim & afternoon relax', time: '14:15', link: mapsLink('Chiaia di Luna Ponza'), highlight: true, details: ['Crescent tufa cliff — Ponza’s signature beach', 'Anchor bow-out; watch swell and any rockfall closure'], locationImage: satelliteImage('12.94,40.89,12.98,40.92', '320,160') },
          { title: 'Guests get ready for dinner · boat repositions to Ponza port bay', time: '17:30', details: ['Slow cruise round the south coast to Ponza harbour side', 'Re-anchor / stern-to as available'] },
          { title: 'Launch tender · dinner ashore on the cliffside', time: '19:00', link: mapsLink('Ponza cliffside restaurant'), highlight: true, details: ['Options: Acqua Pazza · Oresteria · Il Tramonto (Le Forna sunset)', 'Confirm reservation & tender pickup time before dinner'] },
        ],
        leg: {
          label: 'LEG · PALMAROLA → PONZA',
          route: 'Grottelle → Chiaia di Luna → Ponza bay',
          sub: 'Palmarola AM · Chiaia di Luna PM · Ponza dinner',
          miles: '10',
          duration: '1h + repositions',
          knots: '10',
        },
      },
      {
        date: 'Tuesday · Aug 18',
        isoDate: '2026-08-18',
        title: 'Arco Naturale · Cala Feola · (evening) Ventotene',
        subtitle: 'Early morning coast tour · lunch expedition at Cala Feola · evening crossing to Ventotene weather-permitting',
        imageUrl: satelliteImage('12.94,40.87,13.05,40.94', '640,320'),
        imageCaption: 'Ponza coastline · Arco Naturale + Cala Feola',
        overnight: 'Ventotene (evening arrival) OR Ponza NW anchorage · captain’s call at 17:00 briefing',
        events: [
          { title: 'Weigh anchor · move to Arco Naturale di Ponza', time: '08:00', link: mapsLink('Arco Naturale Ponza'), highlight: true, details: ['Short reposition · anchor off the arch', 'Swim, tender in close, admire the coastline'], locationImage: satelliteImage('12.98,40.88,13.03,40.91', '320,160') },
          { title: 'Swim stop · coastline tour by tender', time: '08:45', details: ['Coastal drift · sea caves · photo stops', 'Water toys off the swim platform'] },
          { title: 'Move to Cala Feola · lunch expedition', time: '12:00', link: mapsLink('Cala Feola Ponza'), highlight: true, details: ['Ponza NW · natural pools (Piscine Naturali) walking distance', 'Beach lunch ashore or on board — crew call'], locationImage: satelliteImage('12.93,40.92,12.97,40.94', '320,160') },
          { title: 'Afternoon swim & relax · Cala Feola / Piscine Naturali', time: '14:30' },
          { title: 'Captain’s decision brief — Ventotene tonight or tomorrow AM', time: '17:00', highlight: true, details: ['GO tonight: depart 18:00, ~22 nm · ETA Ventotene ~20:30, anchor for the night', 'HOLD: stay off NW Ponza tonight, cross Aug 19 AM instead', 'Wind/sea call — Meltemi echo & swell into Ventotene bay'] },
          { title: 'Evening departure to Ventotene (if GO)', time: '18:00', details: ['~22 nm at 10 kn · ETA ~20:30 Isola di Ventotene', 'Anchor in main bay or Cala Nave depending on wind'] },
        ],
        leg: {
          label: 'LEG · PONZA → VENTOTENE (conditional)',
          route: 'Arco Naturale → Cala Feola → Ventotene',
          sub: 'Coast tour AM · Cala Feola lunch · evening crossing if weather holds',
          miles: '22',
          duration: '2h30',
          knots: '10',
        },
      },
      {
        date: 'Wednesday · Aug 19',
        isoDate: '2026-08-19',
        title: 'Ponza → Naples → Ischia · Family Boards',
        subtitle: 'Depart Ponza 04:30 · Dock Molo Luise ~10:30 · Nonna, Daniel, Marco & cousins aboard by 12:30 · Cruise to Ischia, anchor & swim, dock evening',
        imageUrl: satelliteImage('13.90,40.65,14.30,40.90', '640,320'),
        imageCaption: 'Ponza → Naples (Molo Luise) → Ischia',
        overnight: 'Docked · Ischia (Casamicciola or Forio · confirm with agent)',
        dock: {
          marina: 'Marina Molo Luise · Mergellina, Napoli (midday) → Ischia (overnight)',
          marinaLink: mapsLink('Marina Molo Luise Mergellina Napoli'),
          radioChannel: 'Ch 09',
          eta: '~10:30 Aug 19 (Molo Luise)',
          etd: '~13:00 Aug 19 (bound for Ischia)',
          notes: 'Nonna, Daniel, Marco and the cousins all board by 12:30 at Molo Luise. Cruise to Ischia in the afternoon; anchor & swim, then dock Ischia for the night.',
        },
        events: [
          { title: 'Depart Ponza — Arco Naturale anchorage', time: '04:30', highlight: true, details: ['Direct to Naples — skipping Ventotene', '~75 nm · ~6h at 12 kn'] },
          { title: 'Arrive Naples · dock Marina Molo Luise (Mergellina)', time: '10:30', link: mapsLink('Marina Molo Luise Mergellina Napoli'), highlight: true, details: ['Stern-to as arranged with agent', 'Passerelle rigged · hose-down after long passage'], locationImage: satelliteImage('14.22,40.82,14.25,40.84', '320,160') },
          { title: 'Nonna, Daniel, Marco & cousins aboard by 12:30', time: '12:30', highlight: true, details: ['Nonna (Enrico’s mom) — aboard through Aug 24', 'Daniel & Marco', 'A couple of cousins joining for the day', 'Welcome + orientation aboard'] },
          { title: 'Light lunch aboard before departure', time: '12:45' },
          { title: 'Weigh lines · cruise to Ischia', time: '13:30', highlight: true, details: ['~18 nm · ~2h at 12 kn', 'Ischia route: past Procida into the bay south of Ischia'] },
          { title: 'Arrive Ischia · anchor & swim', time: '15:30', link: mapsLink('Ischia Italy'), highlight: true, details: ['Anchor south side (Sant’Angelo / Cartaromana) — captain’s pick on wind', 'Swim platform out · toys optional', 'Tender ready for shore excursions'], locationImage: satelliteImage('13.87,40.68,13.98,40.75', '320,160') },
          { title: 'Weigh anchor · move to Ischia berth', time: '18:30', details: ['Confirm with agent: Casamicciola or Forio', 'Short hop to marina before sunset'] },
          { title: 'Dock at Ischia for the night', time: '19:00', link: mapsLink('Porto di Casamicciola Ischia'), highlight: true, details: ['Stern-to · passerelle rigged', 'Cousins disembark ashore or before departure (per plan)'] },
          { title: 'Dinner aboard · family evening in Ischia', time: '20:30' },
        ],
        leg: {
          label: 'LEG · PONZA → NAPLES → ISCHIA',
          route: 'Ponza (Arco Naturale) → Marina Molo Luise → Ischia',
          sub: 'Depart 04:30 · Naples 10:30 · Weigh lines 13:30 · Ischia ~15:30',
          miles: '93',
          duration: '~8h underway',
          knots: '12',
        },
      },
    ],
  },
  {
    id: 'naples-family-2026',
    name: 'Naples · Family Chapter',
    subtitle: 'Nonna aboard · Daniel & Marco · Danny & Effie · Big dock party · Aug 19–23',
    startDate: '2026-08-19',
    endDate: '2026-08-23',
    hero: { icon: '🍕', gradient: 'from-red-900 via-rose-800 to-amber-700' },
    guests: 'Nonna, Daniel, Marco & cousins aboard Aug 19 · Danny & Effie board 14:00 Aug 20 · Big dock party Aug 21',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Nonna', note: 'Enrico’s mom · aboard Aug 19–24' },
      { name: 'Daniel', note: 'aboard Aug 19 (Molo Luise)' },
      { name: 'Marco', note: 'aboard Aug 19 (Molo Luise)' },
      { name: 'Cousins', note: 'day guests Aug 19–20 · disembark Aug 20 in Naples' },
      { name: 'Danny', note: 'arrives ~14:00 Aug 20' },
      { name: 'Effie', note: 'arrives ~14:00 Aug 20' },
    ],
    days: [
      {
        date: 'Wednesday · Aug 19',
        isoDate: '2026-08-19',
        title: 'Ponza → Naples → Ischia · Family Boards',
        subtitle: 'Depart Ponza 04:30 · Dock Molo Luise ~10:30 · Nonna, Daniel, Marco & cousins aboard by 12:30 · Cruise to Ischia, anchor & swim, dock evening',
        imageUrl: satelliteImage('13.90,40.65,14.30,40.90', '640,320'),
        imageCaption: 'Ponza → Naples (Molo Luise) → Ischia',
        overnight: 'Docked · Ischia (Casamicciola or Forio · confirm with agent)',
        dock: {
          marina: 'Marina Molo Luise · Mergellina, Napoli (midday) → Ischia (overnight)',
          marinaLink: mapsLink('Marina Molo Luise Mergellina Napoli'),
          radioChannel: 'Ch 09',
          eta: '~10:30 Aug 19 (Molo Luise)',
          etd: '~13:30 Aug 19 (bound for Ischia)',
          notes: 'Nonna, Daniel, Marco and the cousins all board by 12:30 at Molo Luise. Cruise to Ischia in the afternoon; anchor & swim, then dock Ischia for the night.',
        },
        events: [
          { title: 'Depart Ponza — Arco Naturale anchorage', time: '04:30', highlight: true, details: ['Direct to Naples — skipping Ventotene', '~75 nm · ~6h at 12 kn'] },
          { title: 'Arrive Naples · dock Marina Molo Luise (Mergellina)', time: '10:30', link: mapsLink('Marina Molo Luise Mergellina Napoli'), highlight: true, details: ['Stern-to as arranged with agent', 'Passerelle rigged · hose-down after long passage'] },
          { title: 'Nonna, Daniel, Marco & cousins aboard by 12:30', time: '12:30', highlight: true, details: ['Nonna (Enrico’s mom) — aboard through Aug 24', 'Daniel & Marco', 'A couple of cousins joining for the day', 'Welcome + orientation aboard'] },
          { title: 'Light lunch aboard before departure', time: '12:45' },
          { title: 'Weigh lines · cruise to Ischia', time: '13:30', highlight: true, details: ['~18 nm · ~2h at 12 kn', 'Ischia route: past Procida into the bay south of Ischia'] },
          { title: 'Arrive Ischia · anchor & swim', time: '15:30', link: mapsLink('Ischia Italy'), highlight: true, details: ['Anchor south side (Sant’Angelo / Cartaromana) — captain’s pick on wind', 'Swim platform out · toys optional', 'Tender ready for shore excursions'] },
          { title: 'Weigh anchor · move to Ischia berth', time: '18:30', details: ['Confirm with agent: Casamicciola or Forio', 'Short hop to marina before sunset'] },
          { title: 'Dock at Ischia for the night', time: '19:00', link: mapsLink('Porto di Casamicciola Ischia'), highlight: true, details: ['Stern-to · passerelle rigged'] },
          { title: 'Dinner aboard · family evening in Ischia', time: '20:30' },
        ],
        leg: {
          label: 'LEG · PONZA → NAPLES → ISCHIA',
          route: 'Ponza (Arco Naturale) → Marina Molo Luise → Ischia',
          sub: 'Depart 04:30 · Naples 10:30 · Weigh lines 13:30 · Ischia ~15:30',
          miles: '93',
          duration: '~8h underway',
          knots: '12',
        },
      },
      {
        date: 'Thursday · Aug 20',
        isoDate: '2026-08-20',
        title: 'Ischia Swim → Naples · Danny & Effie Aboard · Harbour Tour',
        subtitle: 'Leave Ischia dock 10:00 · Anchor & swim (1h) · Depart 12:00 for Naples · Dock Molo Luise 13:30 · Danny & Effie board 14:00 · Harbour tour · Back at dock 18:00',
        imageUrl: satelliteImage('13.85,40.68,14.30,40.87', '640,320'),
        imageCaption: 'Ischia (swim) → Marina Molo Luise, Mergellina',
        overnight: 'Docked · Mergellina',
        dock: {
          marina: 'Marina Molo Luise · Mergellina, Napoli',
          marinaLink: mapsLink('Marina Molo Luise Mergellina Napoli'),
          radioChannel: 'Ch 09',
          eta: '13:30 Aug 20',
          etd: '~15:00 Aug 20 (harbour tour with Danny & Effie · back 18:00)',
          notes: 'Danny & Effie board 14:00. Harbour tour departs shortly after with guests aboard; back at Molo Luise by 18:00.',
        },
        events: [
          { title: 'Leave Ischia dock · short hop to anchorage', time: '10:00', highlight: true, details: ['Stations, hose down, secure passerelle', 'Head to sheltered spot around Ischia — captain’s call on wind'] },
          { title: 'Anchor off Ischia · swim & small setup', time: '10:30', highlight: true, details: ['~1 hour on the hook', 'Swim platform out · light snacks · small toy setup', 'Anchor watch on deck'] },
          { title: 'Weigh anchor · depart for Naples', time: '12:00', highlight: true, details: ['~18 nm · ~1.5h at 12 kn', 'Underway lunch for crew'] },
          { title: 'Arrive Naples · dock Marina Molo Luise', time: '13:30', link: mapsLink('Marina Molo Luise Mergellina Napoli'), highlight: true, details: ['Stern-to as before', 'Passerelle rigged for guest arrival'] },
          { title: 'Danny & Effie arrive · board', time: '14:00', highlight: true, details: ['Welcome + safety orientation aboard', 'Bags to cabins · light refreshments'] },
          { title: 'Slip lines · harbour tour with Danny & Effie', time: '15:00', highlight: true, details: ['Bay of Naples loop — Castel dell’Ovo, Posillipo, Nisida', 'Photo passes with Vesuvius panorama', 'Guests on flybridge / aft deck as preferred'] },
          { title: 'Return to Molo Luise · re-dock', time: '18:00', link: mapsLink('Marina Molo Luise Mergellina Napoli'), highlight: true, details: ['Stern-to Mergellina', 'Passerelle down, guests welcome to stay aboard or explore ashore'] },
          { title: 'Dinner aboard / ashore — captain’s call with guests', time: '20:00' },
        ],
        leg: {
          label: 'LEG · ISCHIA (SWIM) → NAPLES',
          route: 'Ischia dock → Ischia anchorage (swim) → Marina Molo Luise, Mergellina',
          sub: 'Depart dock 10:00 · Anchor 10:30 · Depart 12:00 · Arrive 13:30',
          miles: '20',
          duration: '~2h underway',
          knots: '12',
        },
      },
      {
        date: 'Friday · Aug 21',
        isoDate: '2026-08-21',
        title: 'Naples · Fuel Truck · Party Prep · Big Night',
        subtitle: 'Fuel bunkering AM · Whole-day party prep · Big family dock party at Mergellina',
        imageUrl: satelliteImage('14.20,40.81,14.30,40.87', '640,320'),
        imageCaption: 'Mergellina — party night on the dock',
        overnight: 'Docked · Mergellina',
        events: [
          { title: 'Fuel truck alongside — bunker fuel', time: '08:00', highlight: true, details: ['Coordinate with port agent · confirm quantity night before'] },
          { title: 'Deck rinse-down after fuelling', time: '10:30' },
          { title: 'Party prep — whole-day setup', highlight: true, details: ['Rigging, lighting, sound', 'Bar setup on the dock', 'Menu & catering final walkthrough with stewardess'] },
          { title: 'Crew brief · service positions', time: '17:30', details: ['Deck: gangway welcome + passerelle safety', 'Interior: bar service, canapés circulation, guest cabins locked', 'ETO: music, lighting scenes, aircon low & steady'] },
          { title: '🎉 Dock party · guests arrive', time: '18:30', link: mapsLink('Porto di Mergellina Napoli'), highlight: true, details: ['Guest welcome at gangway · cocktails on aft deck', 'Passerelle attended throughout · guest count tracked', 'Nonna hosting alongside Enrico & Antoniette'] },
          { title: 'Canapés & dinner service', time: '20:00', details: ['Rolling canapés · seated / buffet per Enrico’s plan', 'Wine pairings with chief stew'] },
          { title: 'Party continues · late night wind-down', time: '23:00', details: ['Music tapered · guests off by 01:00 (dock quiet hours)', 'Deck watch — no over-service; safe departures'] },
        ],
      },
      {
        date: 'Saturday · Aug 22',
        isoDate: '2026-08-22',
        title: 'Naples — Cleanup Day',
        subtitle: 'Reset the boat after the party · Restock · Quiet evening aboard',
        imageUrl: satelliteImage('14.20,40.81,14.30,40.87', '640,320'),
        imageCaption: 'Mergellina — recovery & restock',
        overnight: 'Docked · Mergellina',
        events: [
          { title: 'Full boat cleanup after last night’s party', time: '08:00', highlight: true },
          { title: 'Laundry, linens turnover, deck reset' },
          { title: 'Restock — provisions, bar, ice' },
          { title: 'Crew rest window in the afternoon' },
          { title: 'Quiet dinner aboard with family', time: '20:00' },
        ],
      },
      {
        date: 'Sunday · Aug 23',
        isoDate: '2026-08-23',
        title: 'Naples → Capri — Cousins Day Cruise',
        subtitle: 'Cousins aboard 10–11am · Depart 10:30–11 · Capri anchor, swim & tenders · Back at Mergellina 18:00–19:00 · Dinner ashore',
        imageUrl: satelliteImage('14.15,40.55,14.35,40.75', '640,320'),
        imageCaption: 'Bay of Naples → Capri day loop',
        overnight: 'Docked · Mergellina',
        events: [
          { title: 'Slow family morning aboard · pre-departure checks', time: '09:00' },
          { title: 'Cousins arrive at Marina Molo Luise (Mergellina)', time: '10:00–11:00', highlight: true },
          { title: 'Slip lines when cousins are aboard · depart Mergellina for Capri', time: '10:30–11:00', highlight: true },
          { title: 'Cruise to Capri (~2 hours)' },
          { title: 'Anchor off Capri (Marina Piccola / Faraglioni) · swim · tender rides', highlight: true, details: ['Faraglioni photo loop by tender', 'Swim off the swim platform', 'Grotta Verde or Grotta Bianca weather-permitting'] },
          { title: 'Light lunch on deck · afternoon at anchor' },
          { title: 'Weigh anchor · return cruise to Naples', time: '16:30' },
          { title: 'Dock at Marina Molo Luise (Mergellina)', time: '18:00–19:00', highlight: true },
          { title: 'Dinner ashore in Naples', time: '20:30', highlight: true },
        ],
      },
    ],
  },
  {
    id: 'naples-friends-2026',
    name: 'Naples → Aeolians · Friends Chapter',
    subtitle: '4 couples embark Naples · Ischia · Capri · Furore Fjord · Stromboli · Aeolians · Taormina · Aug 24–28',
    startDate: '2026-08-24',
    endDate: '2026-08-28',
    hero: { icon: '🌋', gradient: 'from-rose-900 via-purple-800 to-fuchsia-700' },
    guests: '4 couples embark Naples AM Aug 24 (family departs same morning): Carlo & Denise, Vinny & Morissa, Stacy & husband, Charlie & Cecile · Rick (Enrico) & Antoniette stay aboard · all four couples disembark Catania before Malta crossing',
    guestList: [
      { name: 'Rick (Enrico)' },
      { name: 'Antoniette' },
      { name: 'Carlo', note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
      { name: 'Denise', note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
      { name: 'Vinny', note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
      { name: 'Morissa', note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
      { name: 'Stacy', note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
      { name: "Stacy’s husband", note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
      { name: 'Charlie', note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
      { name: 'Cecile', note: 'couple · embark Naples AM Aug 24 · disembark Catania' },
    ],
    days: [
      {
        date: 'Monday · Aug 24',
        isoDate: '2026-08-24',
        title: 'Naples → Ischia → Capri',
        subtitle: 'Handover morning · Noon departure for Ischia · Guest’s choice: sea caves or thermal baths · Overnight dock in Capri',
        imageUrl: satelliteImage('13.85,40.55,14.30,40.85', '640,320'),
        imageCaption: 'Bay of Naples → Ischia → Capri',
        dock: {
          marina: 'Marina Grande · Capri',
          marinaLink: mapsLink('Marina Grande Capri'),
          radioChannel: 'Ch 09',
          eta: '~18:00',
          etd: 'Aug 25 AM',
          notes: 'Family disembarks Naples this morning; the four couples embark AM at Mergellina. Depart by noon for Ischia (1h30). Guests pick swim-by-the-caves or the thermal baths, then we push on to Capri, docking around 18:00 for dinner ashore. Rick (Enrico) & Antoniette stay aboard.',
        },
        events: [
          { title: 'Family disembark — Nonna, Danny, Effie, Daniel & Marco', time: '08:00', highlight: true },
          { title: 'Deep-clean cabin turnover · fresh flowers · final provisioning', time: '08:30' },
          { title: 'Guests arrive at Mergellina — welcome walkthrough & champagne on the sundeck', time: '10:30', highlight: true },
          { title: 'Slip lines Mergellina, cruise to Ischia (~1h30)', time: '12:00', highlight: true },
          { title: 'Ischia — Guest’s choice for the afternoon', time: '13:30', highlight: true, details: ['Option 1 — Swim by the sea caves, tender expedition through the grottoes', 'Option 2 — Tender ashore for the thermal baths and a relaxed soak'], locationImage: satelliteImage('13.86,40.71,13.97,40.76', '320,160') },
          { title: 'Weigh anchor — depart Ischia for Capri (~1h45)', time: '16:00' },
          { title: 'Dock at Marina Grande, Capri — step ashore', time: '18:00', highlight: true, link: mapsLink('Marina Grande Capri') },
          { title: 'Welcome dinner ashore in Capri', time: '20:00', highlight: true },
        ],
      },
      {
        date: 'Tuesday · Aug 25',
        isoDate: '2026-08-25',
        title: 'Capri → Furore Fjord → Overnight Crossing to Stromboli',
        subtitle: 'Capri swim & tender expedition · Furore Fjord cliff dive · 11h overnight passage south',
        imageUrl: satelliteImage('14.20,40.54,14.62,40.65', '640,320'),
        imageCaption: 'Capri → Amalfi Coast → Furore Fjord',
        overnight: 'Underway · overnight crossing to Stromboli (~11h)',
        events: [
          { title: 'Slip lines Marina Grande — morning cruise around Capri', time: '09:00', highlight: true },
          { title: 'Swim stop · tender expedition to the sea caves and the Natural Arch', link: mapsLink('Arco Naturale Capri'), locationImage: satelliteImage('14.25,40.54,14.27,40.56', '320,160') },
          { title: 'Weigh anchor — depart for the Amalfi Coast', time: '12:30' },
          { title: 'Anchor at Fiordo di Furore (~1h30)', time: '14:00', highlight: true, link: mapsLink('Fiordo di Furore Amalfi'), details: ['Swim off the swim platform', 'Tender to shore for the tiny pebble beach', 'Cliff dive off the fjord bridge for the courageous'], locationImage: satelliteImage('14.54,40.61,14.56,40.62', '320,160') },
          { title: 'Sunset aperitivo at anchor · dinner aboard underway', time: '19:30' },
          { title: 'Slip lines — overnight passage to Stromboli (~11h)', time: '21:00', highlight: true, details: ['Watch schedule set for the crossing'] },
        ],
        leg: {
          label: 'LEG 7 · NIGHT PASSAGE',
          route: 'Furore Fjord → Stromboli, Aeolian Islands',
          sub: 'Depart ~21:00 Aug 25 · Arrive ~08:00 Aug 26',
          miles: '135',
          duration: '~11h',
          knots: '12',
        },
      },
      {
        date: 'Wednesday · Aug 26',
        isoDate: '2026-08-26',
        title: 'Sunset Move to Stromboli → Overnight at Scoglio Brigantino, Panarea',
        subtitle: 'Reposition to Stromboli after sunset · evening eruption watch · 1h cruise to Panarea at 22:00–23:00 · anchor at Scoglio Brigantino for the night',
        imageUrl: satelliteImage('14.90,38.40,15.30,38.85', '640,320'),
        imageCaption: 'Aeolian Islands — Stromboli eruption watch → Scoglio Brigantino, Panarea',
        overnight: 'At anchor · Scoglio Brigantino, Panarea',
        events: [
          { title: 'Slip lines — reposition to Stromboli after sunset', time: '19:30', highlight: true, link: mapsLink('Stromboli volcano'), details: ['Timed to arrive off Sciara del Fuoco for the evening eruption show'] },
          { title: 'Stromboli eruption watch from the water', time: '20:30', highlight: true, link: mapsLink('Sciara del Fuoco Stromboli'), details: ['Eruptions roughly every 20–30 minutes', 'Best viewing from the NW side of the island — lights down on deck'], locationImage: 'https://static01.nyt.com/images/2021/03/18/autossell/00SCI-STROMBOLI-clip1/00SCI-STROMBOLI-clip1-jumbo.jpg' },
          { title: 'Weigh anchor — cruise to Panarea (~1h)', time: '22:30', highlight: true, details: ['Departure window 22:00–23:00'] },
          { title: 'Anchor for the night at Scoglio Brigantino', time: '23:45', highlight: true, link: mapsLink('Scoglio Brigantino Panarea'), details: ['Sheltered anchorage on the east side of Panarea'], locationImage: 'https://d3fphkxyf5o5bm.cloudfront.net/image-resize/format=webp,w=720/QwRY54Li1HMwD7oNfqZ770HoDE2uZuAP81o9QgsG1F' },
        ],
      },
      {
        date: 'Thursday · Aug 27',
        isoDate: '2026-08-27',
        title: 'Cala Junco Beach → Vulcano Mud Baths & Thermal Waters → Dinner at Orsa Maggiore',
        subtitle: 'Morning swim at Cala Junco · reposition to Vulcano mud baths · beach setup ashore · dinner at Orsa Maggiore · dock Marina di Vulcano for the night',
        imageUrl: satelliteImage('14.90,38.35,15.15,38.65', '640,320'),
        imageCaption: 'Panarea (Cala Junco) → Vulcano (Fanghi + Marina di Vulcano)',
        overnight: 'Alongside · Marina di Vulcano',
        dock: {
          marina: 'Marina di Vulcano',
          marinaLink: mapsLink('Marina di Vulcano Porto di Levante'),
          radioChannel: 'Ch 09',
          eta: '~17:00',
        },
        events: [
          { title: 'Breakfast served aboard', time: '09:00', highlight: true },
          { title: 'Shore expedition to Cala Junco Beach — swim, float', time: '10:30', highlight: true, link: mapsLink('Cala Junco Panarea'), details: ['Tender ashore', 'Snorkelling on the south wall of the cove'], locationImage: 'https://www.theworldofsicily.com/wp-content/uploads/2018/06/Cala-Junco-Panarea-1-930x620.jpg' },
          { title: 'Weigh anchor — reposition to Vulcano mud baths (~1h15)', time: '12:30', highlight: true, link: mapsLink('Terme di Vulcano fanghi'), details: ['Either dock (right next to the mud baths) or anchor outside and tender in', 'Mud baths and thermal-water sea entry are right next to each other'] },
          { title: 'Lunch served underway', time: '12:45', highlight: true },
          { title: 'Vulcano — Fanghi & thermal waters ashore', time: '13:45', highlight: true, link: mapsLink('Terme di Vulcano fanghi'), details: ['Beach setup ashore: chairs, waters, snacks', 'Sulphur mud pool + adjacent hot-spring sea swim', 'Flip-flops on · silver jewellery stays aboard (sulphur tarnishes it)'], locationImage: 'https://traveladdicts.net/wp-content/uploads/2018/04/Vulcano-Island-Mud-Baths-Laghetto-di-Fanghi-9.jpg' },
          { title: 'Back aboard — shower and get ready for city exploration and dinner', time: '18:00', highlight: true },
          { title: 'Dock at Marina di Vulcano for the night', time: '19:00', highlight: true, link: mapsLink('Marina di Vulcano Porto di Levante') },
          { title: 'Dinner reservations at Hotel Orsa Maggiore', time: '20:30', highlight: true, link: mapsLink('Hotel Orsa Maggiore Vulcano'), details: ['Terrace dining above Porto di Ponente'] },
        ],
      },
      {
        date: 'Friday · Aug 28',
        isoDate: '2026-08-28',
        title: 'Vulcano → Piscina di Venere → 6h Cruise → Taormina (guests off) → Malta Crossing',
        subtitle: 'Early departure from Marina di Vulcano · swim & cave morning at Piscina di Venere · 6h transit to Taormina · guests off to villa · vessel prepares for the Malta crossing',
        imageUrl: satelliteImage('14.20,35.60,15.75,38.65', '640,320'),
        imageCaption: 'Vulcano → Piscina di Venere (Capo Milazzo) → Taormina → overnight crossing to Malta',
        overnight: 'Underway · overnight crossing to Malta (~11h)',
        events: [
          { title: 'Depart the dock — Marina di Vulcano', time: '07:00', highlight: true, link: mapsLink('Marina di Vulcano Porto di Levante') },
          { title: 'Anchor by Piscina di Venere, Capo Milazzo', time: '08:15', highlight: true, link: mapsLink('Piscina di Venere Capo Milazzo'), details: ['Quick coffee, then straight into action', 'Swim holes, natural pools and cave exploration', 'Grotta del Cavallo by tender'], locationImage: 'https://travelmademedoit.com/wp-content/uploads/2023/04/DJI_0177-1024x683.jpg' },
          { title: 'Weigh anchor — 6h cruise to Taormina · showers and clean up underway', time: '10:30', highlight: true },
          { title: 'Brunch served underway', time: '11:00', highlight: true },
          { title: 'Arrive Isola Bella, Taormina — drop anchor', time: '16:30', highlight: true, link: mapsLink('Isola Bella Taormina'), details: ['Arrival window 16:30–17:00', 'Tender guests ashore to pick up cars and meet Billy in the villa'], locationImage: 'https://www.sicilia.info/en/wp-content/uploads/sites/196/taormina-isola-bella-hd.jpg' },
          { title: 'Vessel departs for Malta (~11h crossing)', time: '20:00', highlight: true, details: ['Depart evening of Aug 28 or morning of Aug 29 — TBC with Captain'] },
        ],
      },
    ],
  },
  {
    id: 'malta-2026',
    name: 'Malta — Brianna’s Wedding',
    subtitle: 'Catania → Valletta crossing · Marina di Valletta dockage · Blue Lagoon family day · 40-guest pre-wedding cocktail cruise · Wedding & after-party · Aug 28 – Sep 8',
    startDate: '2026-08-28',
    endDate: '2026-09-08',
    hero: { icon: '💒', gradient: 'from-red-900 via-rose-800 to-stone-700' },
    guests: 'Wedding chapter — Brianna & Matthew’s wedding in Malta · 8 guests aboard · dockage at Marina di Valletta Aug 29 – Sep 8 · Blue Lagoon family day Sep 2 · 40-guest pre-wedding cocktail cruise Sep 3',
    guestList: [
      { name: 'Brianna', note: 'bride · boards Aug 29' },
      { name: 'Matthew', note: 'groom · boards Aug 29' },
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Marco' },
      { name: 'Deanna' },
      { name: 'Daniel' },
      { name: 'Laura' },
    ],
    days: [
      {
        date: 'Friday · Aug 28',
        isoDate: '2026-08-28',
        title: 'Catania → Malta — Afternoon Departure',
        subtitle: 'Depart Catania afternoon · Overnight crossing to Grand Harbour · Weather TBC (possible delay to evening)',
        events: [
          { title: 'Depart Porto di Catania — afternoon slip', time: '15:00', highlight: true, link: mapsLink('Porto di Catania'), details: ['Weather brief before departure — possible delay to the evening if conditions dictate', 'Guests off in Taormina earlier the same day (see Friends chapter Aug 28)'] },
          { title: 'Night watches underway', details: ['Standard sea watches', 'Arrive Grand Harbour, Valletta the following morning'] },
        ],
        overnight: 'Underway · crossing to Malta',
        leg: {
          label: 'NIGHT PASSAGE',
          route: 'Catania, Sicily → Valletta, Malta',
          sub: 'Depart afternoon Aug 28 · Arrive morning Aug 29 (weather TBC)',
          miles: '115',
          duration: '~11h',
          knots: '12',
        },
      },
      {
        date: 'Saturday · Aug 29',
        isoDate: '2026-08-29',
        title: 'Arrive Malta — Grand Harbour · Matt & Brianna Board',
        subtitle: 'Marina di Valletta · UNESCO World Heritage Capital · Bride & groom join the boat',
        imageUrl: satelliteImage('14.49,35.88,14.55,35.92', '640,320'),
        imageCaption: 'Grand Harbour — baroque fortifications on arrival',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          radioChannel: 'Ch 13',
          eta: 'Morning Aug 29 (weather TBC)',
          etd: '~08:00 Sep 8',
          notes: 'Full-chapter dockage at Marina di Valletta (Aug 29 arrival → Sep 8 departure). Confirm berth allocation with VTS Grand Harbour on Ch 13. Wedding party access & shore-power confirmed.',
        },
        events: [
          { title: 'Grand Harbour arrival — one of the great Med sights', time: 'AM', highlight: true, link: mapsLink('Grand Harbour Valletta'), details: ['Arrival window: morning Aug 29 · may push to evening if the crossing is delayed for weather'] },
          { title: 'Dock at Marina di Valletta', highlight: true, link: mapsLink('Marina di Valletta') },
          { title: 'Matt & Brianna board the boat', time: 'PM', highlight: true, details: ['Bride & groom join the wedding-week crew aboard'] },
          { title: 'Three Cities water taxi (weather permitting)', link: mapsLink('Three Cities Vittoriosa Malta'), locationImage: satelliteImage('14.51,35.88,14.55,35.90', '320,160') },
          { title: 'Welcome dinner aboard — wedding chapter kickoff', time: '20:30', highlight: true },
        ],
      },
      {
        date: 'Sunday · Aug 30',
        isoDate: '2026-08-30',
        title: 'Valletta — Old Town & Three Cities',
        subtitle: 'At the dock · UNESCO World Heritage · Guest-led exploration',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'At the dock through Sep 8 · Malta base for wedding chapter.',
        },
        events: [
          { title: 'Birgu · Senglea · Cospicua by water taxi', time: '10:00', highlight: true, link: mapsLink('Birgu Vittoriosa Malta') },
          { title: 'Palace of the Grand Masters', time: '14:00', link: mapsLink('Grandmasters Palace Valletta') },
          { title: 'St John’s Co-Cathedral — Caravaggio masterpieces', time: '15:30', link: mapsLink('St John’s Co-Cathedral Valletta') },
          { title: 'Dinner at Under Grain — 1 Michelin Star', time: '20:30', link: mapsLink('Under Grain Valletta'), details: ['Seasonal tasting'] },
        ],
      },
      {
        date: 'Monday · Aug 31',
        isoDate: '2026-08-31',
        title: 'Ancient Temples & Mdina',
        subtitle: 'At the dock · 5,000-year-old history · Mdina hilltop dinner',
        imageUrl: satelliteImage('14.39,35.88,14.44,35.91', '640,320'),
        imageCaption: 'Mdina — the Silent City, medieval hilltop',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'At the dock through Sep 8 · Malta base for wedding chapter.',
        },
        events: [
          { title: 'Ħaġar Qim & Mnajdra megalithic temples', time: '09:30', highlight: true, link: mapsLink('Hagar Qim Mnajdra Malta'), details: ['5,000 years old', 'Older than Stonehenge and the pyramids'], locationImage: satelliteImage('14.42,35.81,14.46,35.84', '320,160') },
          { title: 'Mdina — the Silent City, hilltop views', time: '14:00', link: mapsLink('Mdina Silent City Malta'), locationImage: satelliteImage('14.39,35.88,14.44,35.91', '320,160') },
          { title: 'De Mondion — 1 Michelin Star · Palazzo Xara', time: '20:30', highlight: true, link: mapsLink('De Mondion Mdina'), details: ['Mdina hilltop views'] },
        ],
      },
      {
        date: 'Tuesday · Sep 1',
        isoDate: '2026-09-01',
        title: 'Valletta — WWII Heritage & Fine Dining',
        subtitle: 'At the dock · George Cross history · Panoramic dinner',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'At the dock through Sep 8 · Malta base for wedding chapter.',
        },
        events: [
          { title: 'Lascaris War Rooms — WWII underground HQ', time: '10:00', highlight: true, link: mapsLink('Lascaris War Rooms Valletta') },
          { title: 'Malta at War Museum — George Cross story', time: '13:30', link: mapsLink('Malta at War Museum') },
          { title: 'MUZA — National Museum of Art at Auberge d\'Italie', time: '16:00', link: mapsLink('MUZA Valletta') },
          { title: 'ION Harbour dinner — panoramic terrace', time: '20:30', highlight: true, link: mapsLink('ION Harbour Valletta'), details: ['Possibly the finest view in Malta'] },
        ],
      },
      {
        date: 'Wednesday · Sep 2',
        isoDate: '2026-09-02',
        title: 'Blue Lagoon — Family Boat Excursion',
        subtitle: 'Comino · Family day cruise to Blue Lagoon · Overnight back at Valletta',
        imageUrl: satelliteImage('14.30,36.00,14.37,36.04', '640,320'),
        imageCaption: 'Blue Lagoon — turquoise between Comino & Cominotto',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'Family day trip to Comino · Overnight back at Marina di Valletta (dock kept through Sep 8).',
        },
        overnight: 'Marina di Valletta',
        events: [
          { title: 'Depart Marina di Valletta for Blue Lagoon', time: '08:00', highlight: true, link: mapsLink('Marina di Valletta') },
          { title: 'Anchor Blue Lagoon — family day cruise', time: '10:00', highlight: true, link: mapsLink('Blue Lagoon Comino Malta'), details: ['Wedding-week crew aboard only — no external guests', 'Snorkel · swim · paddleboard the crystal shallows', 'Water toys and tender ops all day'], locationImage: satelliteImage('14.31,36.01,14.34,36.03', '320,160') },
          { title: 'Lunch on the aft deck', time: '13:00' },
          { title: 'Return to Marina di Valletta', time: '18:00' },
          { title: 'Quiet dinner aboard — rest before the 40-guest cocktail cruise', time: '20:30' },
        ],
      },
      {
        date: 'Thursday · Sep 3',
        isoDate: '2026-09-03',
        title: 'Pre-Wedding Cocktail Cruise — 40 Guests',
        subtitle: 'Pre-wedding event · 40-guest cocktail cruise · Grand Harbour departure',
        imageUrl: satelliteImage('14.49,35.88,14.55,35.92', '640,320'),
        imageCaption: 'Grand Harbour · Marina di Valletta — evening cocktail cruise',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: '40-guest evening cocktail cruise from Marina di Valletta · Overnight back at the dock (kept through Sep 8).',
        },
        overnight: 'Marina di Valletta',
        events: [
          { title: 'Crew prep day — deck setup, bar, canapé stations, water toys stowed', time: '10:00', highlight: true, details: ['40 guests aboard for the evening', 'Extra service staff on deck', 'Music/audio prepped for the cruise'] },
          { title: 'Guest muster & briefing — lifejackets, safety, headcount', time: '17:30', highlight: true },
          { title: 'Slip lines for the pre-wedding cocktail cruise', time: '18:00', highlight: true, link: mapsLink('Grand Harbour Valletta') },
          { title: 'Golden-hour cruise along Grand Harbour & Sliema coast', time: '18:30', details: ['Cocktails, canapés, live/DJ audio on deck'] },
          { title: 'Return to Marina di Valletta — last drinks aboard', time: '22:00' },
          { title: 'Guest disembark · crew reset', time: '22:30' },
        ],
      },
      {
        date: 'Friday · Sep 4',
        isoDate: '2026-09-04',
        title: 'Pre-Wedding Day',
        subtitle: 'Rehearsals, family time, last preparations · Rehearsal dinner ashore',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'At the dock through Sep 8 · Malta base for wedding chapter.',
        },
        events: [
          { title: 'Pre-wedding day — rehearsals & family time', time: '10:00', highlight: true, details: ['Schedule driven by wedding coordinator', 'Boat available for hair/makeup, changing, rest'] },
          { title: 'Trabuxu medieval wine cellar — pre-dinner', time: '18:30', link: mapsLink('Trabuxu wine bar Valletta') },
          { title: 'Rehearsal dinner ashore', time: '20:00', highlight: true, details: ['Venue TBC with the wedding coordinator'] },
        ],
      },
      {
        date: 'Saturday · Sep 5',
        isoDate: '2026-09-05',
        title: 'Wedding Day — Brianna & Matthew',
        subtitle: 'The main event · Ceremony & reception ashore · Boat as base for the wedding party',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'At the dock through Sep 8 · Boat serves as wedding-day base for the family.',
        },
        events: [
          { title: 'Wedding day — Brianna & Matthew', time: 'All day', highlight: true, details: ['Ceremony & reception ashore — timing per wedding coordinator', 'Boat available for prep, photos, rest between events', 'Crew on standby to shuttle & support'] },
        ],
      },
      {
        date: 'Sunday · Sep 6',
        isoDate: '2026-09-06',
        title: 'Recovery Day · After-Party · Candace’s Birthday',
        subtitle: 'Slow morning aboard · Wedding after-party events · Candace’s birthday celebration',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'At the dock through Sep 8 · After-party day · Candace’s birthday.',
        },
        events: [
          { title: 'Slow morning aboard — wedding-day recovery', time: '10:00', highlight: true, details: ['Breakfast on demand', 'Spa/sun deck open all day'] },
          { title: 'Candace’s birthday — celebration aboard', time: '15:00', highlight: true, details: ['Cake & toast on the sun deck'] },
          { title: 'Wedding after-party event', time: '19:00', highlight: true, details: ['Venue TBC with wedding coordinator', 'Boat as pre-party base & late-night return'] },
        ],
      },
      {
        date: 'Monday · Sep 7',
        isoDate: '2026-09-07',
        title: 'Finishing Celebrations',
        subtitle: 'Final Valletta day with the wedding-week crew · Last dinner ashore',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          notes: 'At the dock through Sep 8 · Final wedding-week day · Depart for Gozo Sep 8.',
        },
        events: [
          { title: 'Finishing celebrations — open schedule with the family', time: '10:00', highlight: true, details: ['Last souvenirs, last swims, farewell photos'] },
          { title: 'Palazzo Parisio rooftop — sunset drinks', time: '19:30', link: mapsLink('Palazzo Parisio Valletta') },
          { title: 'Farewell dinner — Under Grain / Noni / Bahia (venue TBC)', time: '21:00', highlight: true, link: mapsLink('Under Grain Valletta'), details: ['Michelin option — confirm with the family'] },
        ],
      },
      {
        date: 'Tuesday · Sep 8',
        isoDate: '2026-09-08',
        title: 'Farewell Malta — Depart for Gozo',
        subtitle: 'La Valletta marina → Mgarr, Gozo · Short morning hop',
        dock: {
          marina: 'Marina di Valletta',
          marinaLink: mapsLink('Marina di Valletta'),
          etd: '08:00',
          notes: 'Final morning at the dock · Depart 08:00 for Gozo.',
        },
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
    subtitle: 'Mgarr Harbour · Xlendi Bay · Inland Sea · Ggantija · Sep 8–9',
    startDate: '2026-09-08',
    endDate: '2026-09-09',
    hero: { icon: '\ud83c\udfdd\ufe0f', gradient: 'from-fuchsia-950 via-purple-900 to-rose-900' },
    guests: 'Post-wedding chapter — Enrico, Antoniette, Daniel, Laura, Marco, Deanna, Brianna, Matthew, Candace, The Dog',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Daniel' },
      { name: 'Laura' },
      { name: 'Marco' },
      { name: 'Deanna' },
      { name: 'Brianna' },
      { name: 'Matthew' },
      { name: 'Candace' },
      { name: 'The Dog' },
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
          eta: '~9:30 AM Sep 8',
          etd: '04:00 Sep 9',
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
        title: 'Gozo Farewell · Early Crossing to Sicily',
        subtitle: 'Day 36 · Depart 04:00 for Isola delle Correnti',
        events: [
          { time: '04:00', title: 'Depart Mgarr for Isola delle Correnti, Sicily', highlight: true },
        ],
        overnight: 'Underway \u2192 Sicily SE',
        leg: {
          label: 'Leg 11 · Early Crossing',
          route: 'Mgarr, Gozo \u2192 Isola delle Correnti, Sicily',
          sub: 'Depart 04:00 Sep 9 · Arrive ~11:00 Sep 9',
          miles: 63, // 55 nm × 1.15078
          duration: '7h 0m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER TEN — SICILY COAST & GROTTA DI SAN GREGORIO (Sep 9–15)
  // =================================================================
  {
    id: 'sicily-aeolians-revisited-2026',
    name: 'Sicily Coast → Taormina',
    subtitle: 'Isola delle Correnti · Vendicari · Punta Arenella · Syracuse · Taormina',
    startDate: '2026-09-09',
    endDate: '2026-09-13',
    hero: { icon: '\ud83c\udfdb\ufe0f', gradient: 'from-slate-900 via-zinc-800 to-amber-900' },
    guests: 'Final chapter — Enrico, Antoniette, Daniel, Laura, Marco, Deanna, Brianna, Matt, Candace, The Dog. Split Sep 13: Daniel, Laura, Marco, Deanna, Candace & The Dog depart; Brianna & Matt continue.',
    guestList: [
      { name: 'Enrico' },
      { name: 'Antoniette' },
      { name: 'Daniel', note: 'departs Sep 13 Taormina' },
      { name: 'Laura', note: 'departs Sep 13 Taormina' },
      { name: 'Marco', note: 'departs Sep 13 Taormina' },
      { name: 'Deanna', note: 'departs Sep 13 Taormina' },
      { name: 'Candace', note: 'departs Sep 13 Taormina' },
      { name: 'The Dog', note: 'departs Sep 13 Taormina' },
      { name: 'Brianna', note: 'joins Sep 13 Taormina' },
      { name: 'Matt', note: 'joins Sep 13 Taormina' },
    ],

    days: [
      {
        date: 'Wednesday · September 9',
        isoDate: '2026-09-09',
        title: 'Isola delle Correnti · Beach Day → Vendicari',
        subtitle: 'Day 36 · 55 NM crossing from Gozo · Arrive 11 AM',
        imageUrl: satelliteImage({ west: 14.90, south: 36.60, east: 15.15, north: 36.80 }, { w: 1000, h: 450 }),
        imageCaption: 'Isola delle Correnti — southeasternmost tip of Sicily',
        events: [
          { time: '11:00', title: 'Anchor off Isola delle Correnti — southernmost point of Sicily', link: mapsLink('Isola delle Correnti Sicily'), highlight: true },
          { title: 'Swim, tender to the sandy beach' },
          { title: 'Full beach day — shore setup with beach kit' },
          { time: '17:00', title: 'Weigh anchor for Isola Vendicari (12 NM, 1h)', link: mapsLink('Vendicari Nature Reserve Sicily') },
          { time: '18:00', title: 'Anchor at Isola Vendicari — nature reserve coastline', link: mapsLink('Isola Vendicari Sicily'), highlight: true },
          { time: '20:00', title: 'Dinner onboard at anchor' },
        ],
        overnight: 'Anchored \u2014 Vendicari',
        leg: {
          label: 'Leg 11a · Malta Channel Crossing',
          route: 'Mgarr, Gozo \u2192 Isola delle Correnti, Sicily',
          sub: 'Depart 04:00 Sep 9 · Arrive ~11:00 Sep 9',
          miles: 63, // 55 nm × 1.15078
          duration: '7h 0m',
          knots: 12,
        },
      },
      {
        date: 'Thursday · September 10',
        isoDate: '2026-09-10',
        title: 'Spiaggia La Tonnara → Ortigia / Siracusa',
        subtitle: 'Day 37 · Swim at La Tonnara until 15:00 · Anchor Ortigia by 16:00',
        imageUrl: satelliteImage({ west: 15.05, south: 36.85, east: 15.30, north: 37.10 }, { w: 1000, h: 450 }),
        imageCaption: 'Spiaggia La Tonnara → Ortigia / Siracusa anchorage',
        events: [
          { title: 'Swim at Spiaggia La Tonnara', link: mapsLink('Spiaggia La Tonnara Portopalo Sicily'), highlight: true, details: ['Until 15:00 — beach setup ashore, water toys'] },
          { time: '15:00', title: 'Weigh anchor for Ortigia / Siracusa', link: mapsLink('Ortigia Siracusa') },
          { time: '16:00', title: 'Anchor outside Siracusa harbour', link: mapsLink('Porto Grande Siracusa'), highlight: true },
          { title: 'Tender guests ashore for Ortigia old town exploration' },
          { title: 'Tender chef ashore for provisioning', link: mapsLink('Mercato di Ortigia Siracusa') },
          { title: 'Highlights ashore: Ortigia old town, Temple of Apollo, Fountain of Arethusa', link: mapsLink('Fontana di Aretusa Ortigia Siracusa') },
          { time: '20:30', title: 'Optional dinner ashore — Don Camillo (historic vaulted cellar)', link: mapsLink('Don Camillo Ortigia') },
        ],
        overnight: 'Anchored outside Siracusa',
      },
      {
        date: 'Friday · September 11',
        isoDate: '2026-09-11',
        title: 'Syracuse → Taormina at Anchor',
        subtitle: 'Day 38 · 48 NM up the Sicilian coast · Anchor by 10 AM',
        imageUrl: satelliteImage({ west: 15.20, south: 37.65, east: 15.40, north: 37.95 }, { w: 1000, h: 450 }),
        imageCaption: 'Taormina cliffside anchorage — Etna backdrop',
        events: [
          { time: '05:00', title: 'Depart Syracuse for Taormina (48 NM, 5h)', link: mapsLink('Taormina Sicily anchorage') },
          { time: '10:00', title: 'Anchor outside the bay at Taormina', link: mapsLink('Taormina Sicily anchorage'), highlight: true },
          { title: 'Swim, water toys, jet skis, seabobs' },
          { title: 'Full day at anchor — Etna & cliff views' },
          { time: '20:00', title: 'Dinner onboard' },
        ],
        overnight: 'Anchored \u2014 Taormina bay',
        leg: {
          label: 'Leg 11b · Sicily East Coast',
          route: 'Syracuse \u2192 Taormina anchorage',
          sub: 'Depart 05:00 Sep 11 · Arrive ~10:00 Sep 11',
          miles: 55, // 48 nm × 1.15078
          duration: '4h 0m',
          knots: 12,
        },
      },
      {
        date: 'Saturday · September 12',
        isoDate: '2026-09-12',
        title: 'Taormina Marina — Check-In',
        subtitle: 'Day 39 · 30 min hop to marina · Check-in 11:00–13:00 · Guests step off',
        events: [
          { time: '10:30', title: 'Weigh anchor for Taormina marina (30 min)', link: mapsLink('Portorosa Marina Sicily') },
          { time: '11:00', title: 'Arrive marina — check-in window 11:00–13:00', link: mapsLink('Marina di Taormina'), highlight: true },
          { title: 'Guests step off for Taormina town exploration' },
          { title: 'Highlights: Teatro Antico with Etna backdrop, Corso Umberto, Isola Bella', link: mapsLink('Teatro Antico di Taormina') },
          { time: '20:30', title: 'Optional dinner: Otto Geleng (1 Michelin, Belmond Taormina)', link: mapsLink('Otto Geleng Taormina'), highlight: true },
        ],
        overnight: 'Taormina marina',
        dock: {
          marina: 'Taormina Marina',
          marinaLink: mapsLink('Marina di Taormina'),
          radioChannel: 'Ch 09',
          eta: '~11:00 Sep 12',
          etd: 'Late Sep 13 (after Brianna & Matt arrive)',
          notes: 'Check-in window 11:00–13:00',
        },
      },
      {
        date: 'Sunday · September 13',
        isoDate: '2026-09-13',
        title: 'Guest Swap in Taormina → Overnight to Santa Maria di Leuca',
        subtitle: 'Day 40 · Daniel, Laura, Marco, Deanna, Candace & Dog depart · Brianna & Matt arrive · Depart 21:30',
        events: [
          { title: 'Morning: Daniel, Laura, Marco, Deanna, Candace and The Dog depart Taormina', highlight: true },
          { title: 'Provisioning turnaround · cabins reset for arriving guests' },
          { title: 'Brianna & Matt arrive Taormina, dinner ashore in town' },
          { time: '21:30', title: 'Depart Taormina for Santa Maria di Leuca — overnight passage (~120 NM, 10h)', highlight: true, link: mapsLink('Santa Maria di Leuca Puglia') },
        ],
        overnight: 'Underway \u2192 Santa Maria di Leuca',
        leg: {
          label: 'Leg 12 · Ionian Night Passage',
          route: 'Taormina, Sicily \u2192 Santa Maria di Leuca (Salento)',
          sub: 'Depart 21:30 Sep 13 · Arrive ~07:30 Sep 14',
          miles: 138, // ~120 nm × 1.15078
          duration: '10h 0m',
          knots: 12,
        },
      },
    ],
  },

  // =================================================================
  // CHAPTER ELEVEN — FINAL PASSAGE: SALENTO → IONIAN → ALBANIA → CROATIA (Sep 14–23)
  // =================================================================
  {
    id: 'final-passage-2026',
    name: 'Final Passage — Salento → Ionian → Albania → Croatia',
    subtitle: 'Santa Maria di Leuca · Corfu · Sivota · Paxos · Diapontia · Porto Palermo · Dhermi · Dubrovnik · Žuljana · Kaprije · Primošten · Krka & Skradin · Šibenik Yard',
    startDate: '2026-09-14',
    endDate: '2026-09-23',
    hero: { icon: '\ud83c\uddec\ud83c\uddf7', gradient: 'from-blue-950 via-sky-900 to-emerald-800' },
    guests: 'Enrico, Antoniette, Brianna, Matt — Brianna & Matt hotel ashore Sep 19 (Dhermi) · Enrico & Antoniette continue through Croatia to Šibenik yard Sep 23',
    guestList: [
      { name: 'Enrico' }, { name: 'Antoniette' },
      { name: 'Brianna', note: 'hotel ashore Sep 19 (Dhermi)' },
      { name: 'Matt', note: 'hotel ashore Sep 19 (Dhermi)' },
    ],

    days: [
      {
        date: 'Monday · September 14',
        isoDate: '2026-09-14',
        title: 'Santa Maria di Leuca — Caves & Town',
        subtitle: 'Day 41 · Arrive 07:30 · Morning cave expeditions · Dock 13:00–14:00 · Explore town',
        imageUrl: satelliteImage({ west: 18.30, south: 39.75, east: 18.45, north: 39.90 }, { w: 1000, h: 450 }),
        imageCaption: 'Santa Maria di Leuca — Salento sea caves',
        dock: {
          marina: 'Porto Turistico Marina di Leuca',
          marinaLink: mapsLink('Porto Turistico Marina di Leuca'),
          radioChannel: 'Ch 09',
          eta: '~13:00 Sep 14 (dock)',
          etd: 'Early Sep 15 (Corfu crossing)',
          notes: 'Anchor first for morning caves; move to marina after lunch',
        },
        events: [
          { time: '07:30', title: 'Arrive Santa Maria di Leuca — anchor for morning', link: mapsLink('Santa Maria di Leuca anchorage'), highlight: true },
          { title: 'Tender expedition to the sea caves & grottos along the cliffline', link: mapsLink('Grotta Verde Leuca'), details: ['Grotta del Diavolo, Grotta delle Tre Porte, Grotta Verde — dramatic light shows on the Salento heel'] },
          { title: 'Swim from the boat between cave stops' },
          { time: '13:00', title: 'Move to dock — Porto Turistico Marina di Leuca', link: mapsLink('Porto Turistico Marina di Leuca'), highlight: true },
          { title: 'Ashore: Santuario di Santa Maria de Finibus Terrae', link: mapsLink('Basilica Santa Maria de Finibus Terrae Leuca'), details: ['Sanctuary on the promontory where the Adriatic meets the Ionian'] },
          { title: 'Ashore: Cascata Monumentale & Belvedere', link: mapsLink('Cascata Monumentale Leuca'), details: ['Fascist-era monumental fountain fed from the Apulian aqueduct'] },
          { title: 'Ashore: Faro di Punta Meliso lighthouse walk', link: mapsLink('Faro di Punta Meliso Leuca'), details: ['48 m lighthouse marking the southern end of Italy'] },
          { title: 'Ashore: Villa Meridiana & waterfront villini', link: mapsLink('Villa Meridiana Leuca'), details: ['Belle Époque villas lining the lungomare'] },
          { title: 'Optional dinner: Ristorante La Sacrestia', link: mapsLink('La Sacrestia Ristorante Leuca'), details: ['Puglian seafood in the historic centre'] },
          { title: 'Alternative dinner: Terminal 4 Marina di Leuca', link: mapsLink('Terminal 4 Marina di Leuca'), details: ['Waterfront tables overlooking the harbour'] },
        ],
        overnight: 'Porto Turistico Marina di Leuca',
      },
      {
        date: 'Tuesday · September 15',
        isoDate: '2026-09-15',
        title: 'Santa Maria di Leuca → Corfu',
        subtitle: 'Day 42 · Depart 06:00 · Daytime Otranto crossing · Arrive Marina Gouvia ~13:30',
        imageUrl: satelliteImage({ west: 19.85, south: 39.55, east: 20.05, north: 39.70 }, { w: 1000, h: 450 }),
        imageCaption: 'Corfu Town, Greece',
        dock: {
          marina: 'Marina Gouvia, Corfu',
          marinaLink: mapsLink('Marina Gouvia Corfu'),
          radioChannel: 'Ch 69',
          eta: '~13:30 Sep 15',
          etd: '~07:00 Sep 16',
          notes: 'Schengen entry — clear customs on arrival',
        },
        events: [
          { time: '06:00', title: 'Depart Santa Maria di Leuca for Corfu (~85 NM, 7–8h)', link: mapsLink('Marina Gouvia Corfu'), highlight: true },
          { time: '13:30', title: 'Arrive Corfu — Marina Gouvia', link: mapsLink('Marina Gouvia Corfu'), highlight: true },
          { title: 'Customs & harbour formalities — Schengen entry into Greece' },
          { title: 'Ashore: Venetian-built Old Fortress', link: mapsLink('Old Fortress Corfu'), details: ['16th-century Venetian citadel guarding the old port'] },
          { title: 'Ashore: UNESCO Old Town', link: mapsLink('Corfu Old Town UNESCO'), details: ['Venetian, French and British layers stacked into narrow kantounia lanes'] },
          { title: 'Ashore: Liston promenade & cafés', link: mapsLink('Liston Corfu'), details: ['French-arcaded promenade fronting the Spianada'] },
          { title: 'Optional dinner: Venetian Well', link: mapsLink('Venetian Well Corfu'), details: ['Romantic courtyard dining in the old town'] },
        ],
        overnight: 'Marina Gouvia, Corfu',
        leg: {
          label: 'Leg 13 · Otranto Channel Crossing',
          route: 'Santa Maria di Leuca (Salento) \u2192 Corfu, Greece',
          sub: 'Depart 06:00 Sep 15 · Arrive ~13:30 Sep 15',
          miles: 98, // ~85 nm × 1.15078
          duration: '7h 30m',
          knots: 12,
        },
      },
      {
        date: 'Wednesday · September 16',
        isoDate: '2026-09-16',
        title: 'Corfu → Blue Lagoon → Sivota',
        subtitle: 'Day 43 · Depart 07:00 · Blue Lagoon by 09:00 · Sivota overnight',
        imageUrl: satelliteImage({ west: 20.05, south: 39.30, east: 20.35, north: 39.70 }, { w: 1000, h: 450 }),
        imageCaption: 'Corfu → Sivota (mainland Greece)',
        events: [
          { time: '07:00', title: 'Depart Marina Gouvia', link: mapsLink('Marina Gouvia Corfu') },
          { time: '09:00', title: 'Anchor — Blue Lagoon Beach', link: mapsLink('Blue Lagoon Beach Sivota Greece'), highlight: true, details: ['Turquoise cove between Sivota islets — sandy bottom, snorkel-clear water'] },
          { title: 'Tender expedition — Strand', link: mapsLink('Strand Beach Sivota'), details: ['Sandbar between two islets — you can wade knee-deep across'] },
          { title: 'Tender expedition — Papanikolis Cave', link: mapsLink('Papanikolis Cave Sivota'), details: ['Sea cave named for the WWII Greek submarine that hid inside'] },
          { time: '13:00', title: 'Move to Mikró Mourteméno', link: mapsLink('Mikro Mourtemeno Sivota'), highlight: true, details: ['Anchor tied to the rocks — protected pine-clad islet'] },
          { title: 'Guest option: evening walk in Sivota town', link: mapsLink('Sivota Greece'), details: ['Waterfront tavernas, small chapels, mainland fishing-village feel'] },
        ],
        overnight: 'Anchored — near Sivota',
        leg: {
          label: 'Leg 12 · Corfu → Sivota',
          route: 'Marina Gouvia \u2192 Blue Lagoon \u2192 Sivota',
          sub: 'Depart 07:00 Sep 16 · Anchor 09:00 Sep 16',
          miles: 26, // ~22 nm coastal hop
          duration: '2h 0m',
          knots: 11,
        },
      },
      {
        date: 'Thursday · September 17',
        isoDate: '2026-09-17',
        title: 'Sivota → Paxos → Anchor off Gaios',
        subtitle: 'Day 44 · Depart 07:00 · Anchor Paxos 08:30 · Anchor off Gaios 16:00 · Tender ashore to walk the town',
        imageUrl: satelliteImage({ west: 20.05, south: 39.10, east: 20.35, north: 39.55 }, { w: 1000, h: 450 }),
        imageCaption: 'Paxos & Antipaxos, Ionian Sea',
        events: [
          { time: '07:00', title: 'Depart Sivota', link: mapsLink('Sivota Greece') },
          { time: '08:30', title: 'Anchor off Ortholithos — Papanikolis Cave, Paxos', link: mapsLink('Papanikolis Cave Paxos'), highlight: true, details: ['Sea cave along the sheer west cliffs of Paxos — tender in for the classic light-shaft photo'] },
          { title: 'Morning swim & tender exploration of the west-coast caves', details: ['Ortholithos rock stack sits just off the entrance — protected on calm mornings'] },
          { time: '12:00', title: 'Lift anchor — lunch underway', details: ['Cruise south along the west coast, past bays, arches and sea stacks'] },
          { time: '13:00', title: 'Second swim — Antipaxos beaches', link: mapsLink('Antipaxos beaches'), highlight: true, details: ['Choose based on wind: **Plakes** (west, dramatic cliffs) • **Pagi** (south end, secluded) • **Voutoumi / Vrika** (east, Caribbean-blue sand)'] },
          { time: '16:00', title: 'Anchor off Gaios, Paxos (no dock tonight)', link: mapsLink('Gaios Paxos anchorage'), highlight: true, details: ['Set the hook outside the harbor — no stern-to on the quay tonight'] },
          { title: 'Tender ashore — walk the town', link: mapsLink('Gaios Paxos'), highlight: true, details: ['Paxos capital — wander the Venetian waterfront, small chapels, tiny alleys'] },
          { title: 'Landmarks: Church of Agios Nikolaos & the tiny Panagia islet', link: mapsLink('Panagia island Gaios Paxos'), details: ['Islet fortress and pine-clad chapel enclosing Gaios harbor'] },
          { time: '20:30', title: 'Dinner recommendation: Taka Taka', link: mapsLink('Taka Taka Gaios Paxos'), details: ['Classic Paxiot taverna — slow-cooked lamb, courtyard tables'] },
          { title: 'Dinner alternative: Karkaletzos', link: mapsLink('Karkaletzos Gaios Paxos'), details: ['Family-run — charcoal grill, garden setting, local wine'] },
          { title: 'Dinner alternative: Vassilis (Genesis)', link: mapsLink('Vassilis restaurant Gaios Paxos'), details: ['Refined Greek plates on the seafront — book ahead'] },
          { title: 'Departure window — flexible to Mathraki', highlight: true, details: ['**Guests back early → depart evening Sep 17** for the 40 NM crossing — arrive Mathraki overnight / at dawn', '**Guests back late → depart early Sep 18** (pre-dawn) for the 40 NM crossing — arrive Mathraki mid-morning'] },
        ],
        overnight: 'Anchored off Gaios, Paxos — or underway to Mathraki (guest-return dependent)',
        leg: {
          label: 'Leg 13 · Sivota → Paxos',
          route: 'Sivota \u2192 Ortholithos (Paxos) \u2192 Antipaxos \u2192 Anchor off Gaios',
          sub: 'Depart 07:00 Sep 17 · Anchor 16:00 Sep 17',
          miles: 40,
          duration: '~4h underway + swim stops',
          knots: 11,
        },
      },
      {
        date: 'Friday · September 18',
        isoDate: '2026-09-18',
        title: 'Diapontia Islands → Porto Palermo',
        subtitle: 'Day 45 · Depart Gaios (guest-return dependent) · Mathraki 09:30 · Braghini 12:00 · Porto Palermo evening',
        imageUrl: satelliteImage({ west: 19.30, south: 39.60, east: 20.00, north: 40.20 }, { w: 1000, h: 450 }),
        imageCaption: 'Paxos → Mathraki → Braghini (Ereikoussa) → Porto Palermo, Albania',
        events: [
          { time: 'Sep 17 eve / Sep 18 pre-dawn', title: 'Depart Gaios anchorage for the 40 NM crossing to Mathraki', link: mapsLink('Gaios Paxos'), details: ['**Guests back early Sep 17 → depart evening**, arrive Mathraki overnight / at dawn', '**Guests back late → depart pre-dawn Sep 18**, arrive Mathraki mid-morning'] },
          { time: '09:30', title: 'Anchor — Mathraki Beach', link: 'https://www.google.com/maps/place/Mathraki+Beach/@39.776017,19.5206393', highlight: true, locationImage: 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWk8X7806p4V1uUgm1XWsBVxvydwb6I0SwvPnO5OFGI4YMBmoIPDoT9v0XA2qajwUcibsJ5gmn-X1HsmbmebzcJfjQLOCuVoZlIkHoJWB72_9MwoeXdnWFNiZwiVQm52NwysgIo5=w1600-h1200-k-no', details: ['Diapontia island NW of Corfu — wild, cliff-lined, only a handful of tavernas ashore'] },
          { title: 'Swim, tender exploration to shore — beach morning', details: ['Fine pebble beach with vivid turquoise shallows — nearly empty in September'] },
          { time: '12:00', title: 'Lift anchor — lunch underway to Braghini Beach', link: mapsLink('Braghini Beach Ereikoussa'), highlight: true, details: ['~1h hop north to Ereikoussa island — the northernmost of the Diapontia'] },
          { title: 'Braghini Beach — second swim & beach exploration', details: ['Beautiful secluded cove on the north side of Ereikoussa — verdant, sandy, essentially unreachable by road'] },
          { time: '17:30', title: 'Move to Porto Palermo (~1h30 crossing)', link: mapsLink('Porto Palermo Bay Albania'), highlight: true, details: ['Sheltered double bay in Albania, dominated by Ali Pasha\u2019s 19th-century fortress on the isthmus'] },
          { title: 'Anchor for the evening — Porto Palermo Bay', details: ['Good holding, protected from most quadrants — quiet Albanian coast at night'] },
        ],
        overnight: 'Anchored — Porto Palermo, Albania',
        leg: {
          label: 'Leg 14 · Paxos → Porto Palermo',
          route: 'Gaios \u2192 Mathraki \u2192 Braghini (Ereikoussa) \u2192 Porto Palermo',
          sub: 'Depart Sep 17 eve or Sep 18 pre-dawn (guest-return dependent) · Anchor ~19:00 Sep 18',
          miles: 90,
          duration: '~11h underway + swim stops',
          knots: 11,
        },
      },
      {
        date: 'Saturday · September 19',
        isoDate: '2026-09-19',
        title: 'Gjipe & Dhermi → Overnight to Dubrovnik',
        subtitle: 'Day 46 · Gjipe morning · Havana Beach Club afternoon · Matt & Brianna ashore · Overnight crossing',
        imageUrl: satelliteImage({ west: 19.55, south: 40.05, east: 19.75, north: 40.20 }, { w: 1000, h: 450 }),
        imageCaption: 'Gjipe → Dhermi → overnight to Dubrovnik',
        events: [
          { time: '10:00', title: 'Move to Gjipe Beach (~30 min)', link: mapsLink('Gjipe Beach Albania'), highlight: true, details: ['Isolated crescent at the mouth of the Gjipe Canyon — towering white cliffs on either side'] },
          { title: 'Gjipe Canyon walk & Buneci-area sea caves', link: mapsLink('Gjipe Canyon Albania'), details: ['Hike up the dry riverbed into a narrow slot canyon — dramatic limestone walls'] },
          { title: 'Swim and explore the shore', details: ['Clear water, no road access — the beach is reached on foot or by tender only'] },
          { time: '16:00', title: 'Move to Havana Beach Club, Dhermi', link: mapsLink('Havana Beach Club Dhermi'), highlight: true, details: ['Cliff-side beach club above Dhermi — sunset cocktails, DJ sets, late-night party scene'] },
          { title: 'Afternoon at the beach club — cocktails & swim', details: ['Book a beach bed'] },
          { time: '19:00', title: 'Matt & Brianna step off — tender ashore to their hotel', highlight: true, details: ['They overnight in Dhermi / Himarë; boat departs without them'] },
          { time: '21:00', title: 'Weigh anchor — overnight crossing to Dubrovnik', highlight: true, link: mapsLink('ACI Marina Dubrovnik'), details: ['~180 nm north through the Otranto Strait and up the Adriatic — arrive Dubrovnik at dawn'] },
        ],
        overnight: 'Underway → Dubrovnik',
        leg: {
          label: 'Leg 15 · Albania → Croatia',
          route: 'Porto Palermo \u2192 Gjipe \u2192 Dhermi \u2192 Dubrovnik (overnight)',
          sub: 'Coastal hops by day · Depart 21:00 Sep 19 · Arrive Dubrovnik ~07:00 Sep 20',
          miles: 197, // ~15 nm coastal + ~180 nm overnight
          duration: '~10h coastal + 10h overnight',
          knots: 12,
        },
      },
      {
        date: 'Sunday · September 20',
        isoDate: '2026-09-20',
        title: 'Dubrovnik Clear-In → Žuljana',
        subtitle: 'Day 47 · Anchor Dubrovnik dawn · Customs · Guests walk town + inland church · Boat repositions → Žuljana',
        imageUrl: satelliteImage({ west: 18.05, south: 42.60, east: 18.20, north: 42.70 }, { w: 1000, h: 450 }),
        imageCaption: 'Dubrovnik Old Town, Croatia',
        events: [
          { time: '07:00', title: 'Arrive & anchor off Dubrovnik', link: mapsLink('Dubrovnik anchorage'), highlight: true, details: ['Enter Croatian / Schengen waters — hoist Q flag until cleared'] },
          { time: '08:30', title: 'Captain to customs / port authority — clear in the whole party', link: mapsLink('Port Authority Dubrovnik'), highlight: true, details: ['Croatian customs office — crew list, passports, vignette'] },
          { title: 'Guests ashore — walk Dubrovnik Old Town (~2h)', link: mapsLink('Dubrovnik Old Town'), details: ['Stradun, city walls, Rector\u2019s Palace — UNESCO World Heritage'] },
          { title: 'Cab inland to church (guest excursion)', details: ['Private car for the inland-church visit — confirm the specific church with guests morning-of'] },
          { time: '12:00', title: 'Boat weighs anchor — reposition to Žuljana (~3h)', link: mapsLink('Zuljana Peljesac'), highlight: true, details: ['Sheltered bay on the south side of Pelje\u0161ac Peninsula — guests rejoin by tender'] },
          { time: '15:00', title: 'Anchor Žuljana — tender guests aboard', highlight: true, details: ['Guests arrive by land transfer to Žuljana beach — tender pickup from the pier'] },
          { time: '20:00', title: 'Weigh anchor — overnight delivery to Kaprije archipelago', highlight: true, link: mapsLink('Kaprije Croatia'), details: ['113 nm NW along the Dalmatian coast — arrive Kaprije at dawn'] },
        ],
        overnight: 'Underway → Kaprije',
        leg: {
          label: 'Leg 16 · Dubrovnik → Žuljana → Kaprije',
          route: 'Dubrovnik anchorage \u2192 \u017duljana \u2192 Kaprije archipelago',
          sub: 'Anchor Dubrovnik 07:00 · Reposition Žuljana · Depart 20:00 Sep 20 · Arrive Kaprije ~06:00 Sep 21',
          miles: 130, // ~17 nm Dubrovnik->Žuljana + 113 nm Žuljana->Kaprije
          duration: '~3h coastal + 10h overnight',
          knots: 11,
        },
      },
      {
        date: 'Monday · September 21',
        isoDate: '2026-09-21',
        title: 'Kaprije Morning → Primošten',
        subtitle: 'Day 48 · Morning at anchor Kaprije · 13:00 move to Primošten · Dinner ashore',
        imageUrl: satelliteImage({ west: 15.65, south: 43.55, east: 15.95, north: 43.75 }, { w: 1000, h: 450 }),
        imageCaption: 'Kaprije → Primošten, Dalmatian coast',
        events: [
          { title: 'Morning at anchor — Kaprije archipelago', link: mapsLink('Kaprije island Croatia'), highlight: true, details: ['Quiet \u0160ibenik-region island — pine-clad coves, clear water, near-empty in September'] },
          { title: 'Swim, tender exploration around the islets' },
          { time: '13:00', title: 'Weigh anchor — short hop to Primošten (~1h)', link: mapsLink('Primosten Croatia'), highlight: true, details: ['10 nm north along the coast'] },
          { time: '14:00', title: 'Anchor off Primošten — tender ashore', link: mapsLink('Primosten town'), highlight: true, details: ['Fortified peninsula town, medieval St. George\u2019s church crowning the hill, terracotta roofs'] },
          { title: 'Town exploration — Old Town, waterfront promenade', details: ['Compact walkable core — stone streets, harbor tavernas'] },
          { time: '20:00', title: 'Dinner ashore', details: ['Recommendations: **Konoba Torkul** (traditional peka), **Restoran Panorama** (harbor view), **Palma** (seafront)'] },
          { title: 'Return to boat — overnight at anchor' },
        ],
        overnight: 'Anchored — off Primošten',
        leg: {
          label: 'Leg 17 · Kaprije → Primošten',
          route: 'Kaprije archipelago \u2192 Primo\u0161ten anchorage',
          sub: 'Depart 13:00 Sep 21 · Anchor ~14:00 Sep 21',
          miles: 12,
          duration: '1h 0m',
          knots: 10,
        },
      },
      {
        date: 'Tuesday · September 22',
        isoDate: '2026-09-22',
        title: 'Krka Fjord → Skradin → Waterfalls',
        subtitle: 'Day 49 · 9am lift anchor · 20 nm scenic fjord cruise · Dock Skradin by noon · Waterfall tour boat',
        imageUrl: satelliteImage({ west: 15.75, south: 43.75, east: 16.00, north: 43.90 }, { w: 1000, h: 450 }),
        imageCaption: 'Krka Fjord → Skradin, Croatia',
        dock: {
          marina: 'Skradin (ACI Marina Skradin)',
          marinaLink: mapsLink('ACI Marina Skradin'),
          radioChannel: 'Ch 17',
          eta: '~12:00 Sep 22',
          etd: '~15:00 Sep 23',
          notes: 'Head of the Krka Fjord — river mouth, national park gateway. Air-draft & channel-depth briefing before entering.',
        },
        events: [
          { time: '09:00', title: 'Lift anchor Primošten — head north into the Krka Fjord', link: mapsLink('Krka River fjord Croatia'), highlight: true, details: ['20 nm scenic cruise up the fjord — must-see, cliffs and villages on both sides'] },
          { title: 'Cruise upriver — pass \u0160ibenik, St. Nicholas Fortress, narrow gorge into the national park', link: mapsLink('St Nicholas Fortress Sibenik'), details: ['UNESCO-listed fortress guarding the fjord entrance'] },
          { time: '12:00', title: 'Dock at Skradin (ACI Marina)', link: mapsLink('ACI Marina Skradin'), highlight: true, details: ['Town at the head of the fjord — gateway to Krka Waterfalls'] },
          { title: 'Guests board Krka NP tour boat — excursion to Skradinski Buk waterfalls', link: mapsLink('Skradinski Buk waterfalls Krka'), highlight: true, details: ['Ticket includes tour boat + park entry — tiered waterfalls, mill village, viewpoints'] },
          { time: '20:00', title: 'Dinner — ashore in Skradin or aboard (TBD)', details: ['Skradin recommendations: **Konoba Toni\u010d** (peka, lamb), **Zlatne \u0160koljke** (seafood), **Cantinetta** (waterfront)'] },
        ],
        overnight: 'Skradin (ACI Marina)',
        leg: {
          label: 'Leg 18 · Primošten → Skradin',
          route: 'Primo\u0161ten \u2192 Krka Fjord \u2192 Skradin',
          sub: 'Depart 09:00 Sep 22 · Dock ~12:00 Sep 22',
          miles: 23, // 20 nm scenic + entry
          duration: '~3h scenic cruise',
          knots: 8,
        },
      },
      {
        date: 'Wednesday · September 23',
        isoDate: '2026-09-23',
        title: 'Skradin → Šibenik Yard',
        subtitle: 'Day 50 · Ashore or waterfall day · Guests depart 15:00 · Boat to yard Šibenik',
        imageUrl: satelliteImage({ west: 15.85, south: 43.70, east: 16.00, north: 43.80 }, { w: 1000, h: 450 }),
        imageCaption: 'Šibenik shipyard — season\u2019s end',
        events: [
          { title: 'Possible day ashore — walk Skradin Old Town, riverside cafes', link: mapsLink('Skradin old town'), details: ['Stone streets, small churches, Roman remains'] },
          { title: 'Possible waterfall expedition — return to Skradinski Buk / Roški Slap', link: mapsLink('Roski Slap Krka'), details: ['Roški Slap upstream is quieter than Skradinski Buk'] },
          { time: '15:00', title: 'Guests depart — land transfer to airport', highlight: true, details: ['Split Airport (SPU, ~50 min) is the closest international airport'] },
          { time: '15:30', title: 'Slip lines — boat departs Skradin for the yard in \u0160ibenik', highlight: true, link: mapsLink('Sibenik shipyard Croatia'), details: ['Down the Krka Fjord and into the \u0160ibenik channel — winter yard destination'] },
          { time: '18:00', title: 'Arrive \u0160ibenik yard — season complete', link: mapsLink('Sibenik shipyard'), highlight: true, details: ['Vessel handed to the yard team for winter refit'] },
        ],
        overnight: '\u0160ibenik shipyard',
        leg: {
          label: 'Leg 19 · Skradin → Šibenik yard',
          route: 'Skradin \u2192 Krka Fjord \u2192 \u0160ibenik shipyard',
          sub: 'Depart 15:30 Sep 23 · Arrive ~18:00 Sep 23',
          miles: 14,
          duration: '~2h 30m',
          knots: 7,
        },
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
 * Merge a saved override onto a seed baseline.
 *
 * Trip-level fields the user can edit (`name`, `subtitle`, `guests`,
 * `guestList`) are reapplied when present in the override. Days are matched
 * by `isoDate`: for each seed day, if the override has an entry with the
 * same `isoDate`, we merge the override's user-editable day fields
 * (`date`, `title`, `subtitle`, `events`) onto the seed day. Seed-only
 * fields (`imageUrl`, `imageCaption`, `overnight`, `dock`, `leg`,
 * `locationImage`, etc.) always shine through from the seed so seed edits
 * remain visible for anything the user hasn't edited.
 *
 * New days that only exist in the override are appended in order, so the
 * app also supports adding days that the seed doesn't have.
 */
function mergeTripOverride(baseline: Trip, override: Partial<Trip> & { days?: Partial<TripDay>[] }): Trip {
  const merged: Trip = { ...baseline }
  if (override.name !== undefined) merged.name = override.name
  if (override.subtitle !== undefined) merged.subtitle = override.subtitle
  if (override.guests !== undefined) merged.guests = override.guests
  if (override.guestList !== undefined) merged.guestList = override.guestList
  if (Array.isArray(override.days)) {
    const overrideByIso = new Map<string, Partial<TripDay>>()
    for (const d of override.days) {
      if (d && typeof d.isoDate === 'string' && d.isoDate) overrideByIso.set(d.isoDate, d)
    }
    const usedIsos = new Set<string>()
    const mergedDays: TripDay[] = baseline.days.map(seedDay => {
      const ov = overrideByIso.get(seedDay.isoDate)
      if (!ov) return seedDay
      usedIsos.add(seedDay.isoDate)
      const nextDay: TripDay = { ...seedDay }
      if (ov.date !== undefined) nextDay.date = ov.date
      if (ov.title !== undefined) nextDay.title = ov.title
      if (ov.subtitle !== undefined) nextDay.subtitle = ov.subtitle
      if (Array.isArray(ov.events)) nextDay.events = ov.events as TripDay['events']
      return nextDay
    })
    // Append override-only days (unknown isoDate not in seed) so users can
    // add days from the UI without a source-code edit.
    for (const d of override.days) {
      if (!d || typeof d.isoDate !== 'string' || !d.isoDate) continue
      if (usedIsos.has(d.isoDate)) continue
      mergedDays.push({
        date: d.date || d.isoDate,
        isoDate: d.isoDate,
        title: d.title || 'Untitled day',
        subtitle: d.subtitle,
        events: Array.isArray(d.events) ? (d.events as TripDay['events']) : [],
      } as TripDay)
    }
    merged.days = mergedDays
  }
  return merged
}

/**
 * Persist a trip override to the backend.
 *
 * We send only the user-editable fields — trip meta (`name`, `subtitle`,
 * `guests`, `guestList`) and per-day edits keyed by `isoDate` with just the
 * fields the day editor exposes (`date`, `title`, `subtitle`, `events`).
 * Seed-only fields like `imageUrl`, `dock`, `overnight`, and `leg` are
 * omitted so the seed remains the source of truth for anything the user
 * hasn't touched — this preserves the "seed changes stay visible" property.
 */
export async function saveTrip(trip: Trip, user?: string): Promise<{ ok: boolean; detail?: string }> {
  const overrideOnly = {
    id: trip.id,
    name: trip.name,
    subtitle: trip.subtitle,
    guests: trip.guests,
    guestList: trip.guestList,
    days: trip.days.map(d => ({
      isoDate: d.isoDate,
      date: d.date,
      title: d.title,
      subtitle: d.subtitle,
      events: d.events,
    })),
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
