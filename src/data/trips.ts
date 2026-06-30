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

/**
 * Build an Esri World Imagery satellite snapshot URL for a bounding box.
 * No API key required. Lon/lat in WGS84 decimal degrees.
 */
export function satelliteImage(
  bbox: { west: number; south: number; east: number; north: number },
  size: { w: number; h: number } = { w: 1000, h: 500 }
): string {
  const { west, south, east, north } = bbox
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${size.w},${size.h}`,
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
  // =================================================================
  // CHAPTER NINE — GOZO (Sep 7–9, 2026)
  // =================================================================
  {
    id: 'gozo-2026',
    name: 'Gozo — Malta\u2019s Wild Sister',
    subtitle: 'Mgarr Harbour · Xlendi Bay · Inland Sea · Ggantija',
    startDate: '2026-09-07',
    endDate: '2026-09-09',
    hero: { icon: '\ud83c\udfdd\ufe0f', gradient: 'from-fuchsia-950 via-purple-900 to-rose-900' },
    days: [
      {
        date: 'Monday · September 7',
        isoDate: '2026-09-07',
        title: 'Gozo — Xlendi Bay & Inland Sea',
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
        date: 'Tuesday · September 8',
        isoDate: '2026-09-08',
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
        date: 'Wednesday · September 9',
        isoDate: '2026-09-09',
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
          sub: 'Depart ~9 PM Sep 9 · Arrive ~4 AM Sep 10',
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
    subtitle: 'Pakleni · Palmižana · Stari Grad · Diocletian\u2019s Palace · Final Chapter',
    startDate: '2026-09-25',
    endDate: '2026-09-30',
    hero: { icon: '\ud83c\udf47', gradient: 'from-blue-950 via-indigo-900 to-rose-800' },
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
        subtitle: 'Day 56 · 56 days · ~2,270 nm · 17 chapters complete',
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
