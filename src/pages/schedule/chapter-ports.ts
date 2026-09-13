// Per-chapter port stops + curated mid-water waypoints for nautical charts.
//
// Each chapter lists its named stops (ports/anchorages) in chronological order.
// Between consecutive stops we optionally inject waypoints — coordinates picked
// to sit clearly over water — so the polyline drawn on the chart routes
// around landmasses (peninsulas, islands, headlands) instead of cutting across
// them. The boat cannot travel over land, so the visualization shouldn't either.
//
// Coordinates were chosen from open nautical references (OpenSeaMap, marina
// directories). Waypoints are stylized — they are visual hints to the
// chart, not navigational guidance.

export type Coord = { lat: number; lon: number }

export type PortStop = {
  /** Display name (e.g. "Palma de Mallorca"). */
  name: string
  /** Coordinate of the marina / harbor entrance. */
  coord: Coord
  /** Optional short label override for the chart marker (defaults to name). */
  short?: string
}

export type ChapterRoute = {
  /** Ordered named stops. First = start, last = end of chapter. */
  stops: PortStop[]
  /**
   * Optional ordered intermediate water-only waypoints inserted between
   * consecutive stops. Keyed by stop-index pair "i-j" where j = i+1.
   * The polyline goes stop[i] → waypoints["i-j"] → stop[j].
   */
  waypoints?: Record<string, Coord[]>
}

// Trip ids from src/data/trips.ts — chart only renders if id matches a key.
export const CHAPTER_ROUTES: Record<string, ChapterRoute> = {
  // Chapter 1 — Balearics (Mallorca → Ibiza → Menorca loop)
  'balearics-2026': {
    stops: [
      { name: 'Palma de Mallorca', coord: { lat: 39.555, lon: 2.630 } },
      { name: 'Ibiza Town',        coord: { lat: 38.910, lon: 1.450 } },
      { name: 'Formentera',        coord: { lat: 38.700, lon: 1.430 } },
      { name: 'Mahón, Menorca',    coord: { lat: 39.890, lon: 4.270 } },
      { name: 'Palma de Mallorca', coord: { lat: 39.555, lon: 2.630 } },
    ],
    waypoints: {
      // Palma → Ibiza: go south of Cabrera, clear water
      '0-1': [{ lat: 39.000, lon: 2.200 }],
      // Ibiza → Formentera: short, direct water
      // Formentera → Mahón: long open-water passage, slight arc north
      '2-3': [{ lat: 39.300, lon: 2.900 }, { lat: 39.700, lon: 3.800 }],
      // Mahón → Palma: south along Mallorca's east coast, no land crossings
      '3-4': [{ lat: 39.700, lon: 3.500 }],
    },
  },

  // Chapter 2 — Menorca → Corsica (Bonifacio)
  'menorca-corsica-2026': {
    stops: [
      { name: 'Mahón, Menorca',          coord: { lat: 39.890, lon: 4.270 } },
      { name: 'Bonifacio, Corsica',      coord: { lat: 41.385, lon: 9.160 } },
      { name: 'Cala di Volpe / Costa S.', coord: { lat: 41.090, lon: 9.555 } },
    ],
    waypoints: {
      // Mahón → Bonifacio: open Tyrrhenian crossing, slight north arc to avoid Sardinia's NW cape
      '0-1': [{ lat: 40.500, lon: 6.500 }, { lat: 41.200, lon: 8.500 }],
      // Bonifacio → Costa Smeralda: through Strait of Bonifacio, then south
      '1-2': [{ lat: 41.300, lon: 9.300 }],
    },
  },

  // Chapter 2b — Crew delivery to Alghero (Aug 9–11) · guest embark Aug 11 PM
  'crew-alghero-2026': {
    stops: [
      { name: 'Alghero (dock)', coord: { lat: 40.560, lon: 8.315 } },
    ],
    waypoints: {},
  },

  // Chapter 3 — Sardinia → Ponza (Costa Smeralda · Cala Brandinchi · Cala Luna · Ponza)
  'sardinia-2026': {
    stops: [
      { name: 'Porto Cervo',        coord: { lat: 41.130, lon: 9.540 } },
      { name: 'Cala di Volpe',      coord: { lat: 41.090, lon: 9.555 } },
      { name: 'Cala Brandinchi',    coord: { lat: 40.740, lon: 9.700 } },
      { name: 'Cala Luna',          coord: { lat: 40.230, lon: 9.630 } },
      { name: 'Ponza',              coord: { lat: 40.900, lon: 12.965 } },
    ],
    waypoints: {
      // Cala Luna → Ponza: open Tyrrhenian crossing east then NE
      '3-4': [{ lat: 40.400, lon: 11.000 }, { lat: 40.700, lon: 12.500 }],
    },
  },

  // Chapter 5a — Naples · Family Chapter (Aug 19–23, Nonna aboard, big family party 21st)
  'naples-family-2026': {
    stops: [
      { name: 'Ponza',      coord: { lat: 40.900, lon: 12.965 } },
      { name: 'Napoli · Mergellina', coord: { lat: 40.833, lon: 14.245 } },
      { name: 'Capri / Ischia',      coord: { lat: 40.553, lon: 14.243 } },
      { name: 'Napoli · Mergellina', coord: { lat: 40.833, lon: 14.245 } },
    ],
    waypoints: {
      '0-1': [{ lat: 40.900, lon: 13.500 }],
    },
  },

  // Chapter 5b–7 — Naples · Friends: Capri / Amalfi → Aeolian Islands → Catania (Aug 24–28)
  'naples-friends-2026': {
    stops: [
      { name: 'Napoli',     coord: { lat: 40.833, lon: 14.245 } },
      { name: 'Capri',      coord: { lat: 40.553, lon: 14.243 } },
      { name: 'Positano',   coord: { lat: 40.625, lon: 14.485 } },
      { name: 'Amalfi',     coord: { lat: 40.633, lon: 14.605 } },
      { name: 'Stromboli',  coord: { lat: 38.793, lon: 15.213 } },
      { name: 'Panarea',    coord: { lat: 38.640, lon: 15.075 } },
      { name: 'Lipari',     coord: { lat: 38.470, lon: 14.955 } },
      { name: 'Taormina',   coord: { lat: 37.852, lon: 15.295 } },
    ],
    waypoints: {
      // Capri → Positano: short coastal hop, stay south of Sorrentine peninsula
      '1-2': [{ lat: 40.580, lon: 14.380 }],
      // Amalfi → Stromboli: open Tyrrhenian crossing
      '3-4': [{ lat: 40.000, lon: 14.900 }, { lat: 39.300, lon: 15.150 } ],
      // Lipari → Taormina: south to round NE Sicily through Messina Strait approaches
      '6-7': [{ lat: 38.300, lon: 15.350 }, { lat: 38.000, lon: 15.400 }],
    },
  },

  // Chapter 7 — Malta (Valletta + harbors)
  'malta-2026': {
    stops: [
      { name: 'Taormina',         coord: { lat: 37.852, lon: 15.295 } },
      { name: 'Syracuse',         coord: { lat: 37.060, lon: 15.295 } },
      { name: 'Valletta, Malta',  coord: { lat: 35.895, lon: 14.515 } },
      { name: 'St. Julian\u2019s', coord: { lat: 35.920, lon: 14.490 } },
    ],
    waypoints: {
      // Taormina → Syracuse: down Sicily's east coast (water only)
      // Syracuse → Valletta: open water SSW
      '1-2': [{ lat: 36.500, lon: 14.900 }],
    },
  },

  // Chapter 8 — Gozo & Comino
  'gozo-2026': {
    stops: [
      { name: 'Valletta',     coord: { lat: 35.895, lon: 14.515 } },
      { name: 'Comino',       coord: { lat: 36.013, lon: 14.337 } },
      { name: 'Mgarr, Gozo',  coord: { lat: 36.025, lon: 14.298 } },
      { name: 'Dwejra Bay',   coord: { lat: 36.050, lon: 14.190 } },
    ],
    waypoints: {
      // Valletta → Comino: round NW tip of Malta, stay offshore
      '0-1': [{ lat: 35.980, lon: 14.420 }],
    },
  },

  // Chapter 9 — Sicily Coast → Grotta di San Gregorio (Sept 9–14)
  'sicily-aeolians-revisited-2026': {
    stops: [
      { name: 'Mgarr, Gozo',              coord: { lat: 36.025, lon: 14.298 } },
      { name: 'Spiaggia La Tonnara',      coord: { lat: 36.665, lon: 15.130 } },
      { name: 'Ortigia / Siracusa',       coord: { lat: 37.060, lon: 15.295 } },
      { name: 'Taormina anchorage',       coord: { lat: 37.852, lon: 15.295 } },
      { name: 'Taormina Marina',          coord: { lat: 37.865, lon: 15.305 } },
      { name: 'Grotta di San Gregorio',   coord: { lat: 39.833, lon: 18.360 } },
    ],
    waypoints: {
      // Gozo → La Tonnara: open Malta Channel crossing
      '0-1': [{ lat: 36.300, lon: 14.700 }],
      // Taormina Marina → Grotta di San Gregorio: overnight NE across Ionian, clear NE tip of Sicily
      '4-5': [
        { lat: 38.400, lon: 15.700 }, // NE of Taormina, offshore of Messina strait mouth
        { lat: 39.200, lon: 17.500 }, // mid-Ionian
      ],
    },
  },

  // Chapter 11 — Final Passage: Salento → Ionian → Albania (Sept 14–20)
  'final-passage-2026': {
    stops: [
      { name: 'Grotta di San Gregorio',    coord: { lat: 39.833, lon: 18.360 } },
      { name: 'Corfu — Marina Gouvia',     coord: { lat: 39.680, lon: 19.850 } },
      { name: 'Blue Lagoon (Sivota)',       coord: { lat: 39.410, lon: 20.243 } },
      { name: 'Sivota',                     coord: { lat: 39.415, lon: 20.250 } },
      { name: 'Ortholithos (Paxos)',        coord: { lat: 39.220, lon: 20.125 } },
      { name: 'Antipaxos',                  coord: { lat: 39.150, lon: 20.240 } },
      { name: 'Gaios',                      coord: { lat: 39.202, lon: 20.184 } },
      { name: 'Mathraki',                   coord: { lat: 39.776, lon: 19.540 } },
      { name: 'Braghini (Ereikoussa)',      coord: { lat: 39.877, lon: 19.590 } },
      { name: 'Porto Palermo',              coord: { lat: 40.060, lon: 19.790 } },
      { name: 'Gjipe',                      coord: { lat: 40.127, lon: 19.670 } },
      { name: 'Dhermi',                     coord: { lat: 40.144, lon: 19.635 } },
      { name: 'Secret Blue Cave',           coord: { lat: 40.232, lon: 19.453 } },
      { name: 'Orikum Marina',              coord: { lat: 40.325, lon: 19.470 } },
    ],
    waypoints: {
      // Salento → Corfu: open Otranto Channel crossing
      '0-1': [{ lat: 39.750, lon: 19.100 }],
      // Corfu → Blue Lagoon: coastal SE
      '1-2': [{ lat: 39.550, lon: 20.150 }],
      // Sivota → Ortholithos (Paxos): south down west coast of Paxos
      '3-4': [{ lat: 39.300, lon: 20.150 }],
      // Gaios → Mathraki: N/NW open crossing around Corfu west side
      '6-7': [{ lat: 39.500, lon: 19.700 }, { lat: 39.700, lon: 19.500 }],
      // Braghini → Porto Palermo: SE across Corfu Strait to Albanian coast
      '8-9': [{ lat: 40.000, lon: 19.700 }],
      // Secret Blue Cave → Orikum: north along Karaburun then into Vlorë Bay
      '12-13': [{ lat: 40.280, lon: 19.400 }, { lat: 40.320, lon: 19.420 }],
    },
  },

  // Chapter 13 — Croatia: Dubrovnik → Dalmatian coast → Šibenik yard
  'croatia-2026': {
    stops: [
      { name: 'Dubrovnik',   coord: { lat: 42.660, lon: 18.080 } },
      { name: 'Žuljana',     coord: { lat: 42.870, lon: 17.475 } },
      { name: 'Kaprije',     coord: { lat: 43.680, lon: 15.720 } },
      { name: 'Primošten',   coord: { lat: 43.585, lon: 15.925 } },
      { name: 'Skradin',     coord: { lat: 43.820, lon: 15.925 } },
      { name: 'Šibenik yard', coord: { lat: 43.735, lon: 15.895 } },
    ],
    waypoints: {
      // Dubrovnik → Žuljana: NW along the Pelješac south coast, staying offshore
      '0-1': [{ lat: 42.720, lon: 17.900 }, { lat: 42.820, lon: 17.700 }],
      // Žuljana → Kaprije: long overnight run NW along the outer Dalmatian coast, well offshore of Korčula and Hvar
      '1-2': [{ lat: 43.000, lon: 17.100 }, { lat: 43.250, lon: 16.500 }, { lat: 43.500, lon: 16.100 }],
      // Kaprije → Primošten: short coastal hop east/northeast
      '2-3': [{ lat: 43.640, lon: 15.850 }],
      // Primošten → Skradin: N along coast into the Šibenik channel, up the Krka fjord
      '3-4': [{ lat: 43.700, lon: 15.910 }, { lat: 43.735, lon: 15.895 }, { lat: 43.790, lon: 15.905 }],
      // Skradin → Šibenik yard: back down the Krka fjord to the yard
      '4-5': [{ lat: 43.790, lon: 15.905 }],
    },
  },

  // Chapter 15 — Hvar & Split (Croatian Dalmatian islands)
  'hvar-split-2026': {
    stops: [
      { name: 'Mljet',     coord: { lat: 42.770, lon: 17.555 } },
      { name: 'Korčula',   coord: { lat: 42.960, lon: 17.135 } },
      { name: 'Hvar Town', coord: { lat: 43.170, lon: 16.440 } },
      { name: 'Brač',      coord: { lat: 43.265, lon: 16.650 } },
      { name: 'Split',     coord: { lat: 43.508, lon: 16.435 } },
    ],
    waypoints: {
      // Mljet → Korčula: through channel between islands (water only)
      '0-1': [{ lat: 42.880, lon: 17.350 }],
      // Korčula → Hvar: through Hvar Channel
      '1-2': [{ lat: 43.080, lon: 16.700 }],
      // Hvar → Brač: through Hvar Channel, north
      '2-3': [{ lat: 43.220, lon: 16.580 }],
      // Brač → Split: through Brač Channel
      '3-4': [{ lat: 43.400, lon: 16.520 }],
    },
  },
}

/** Expand stops + waypoints into a single ordered polyline of coordinates. */
export function buildPolyline(route: ChapterRoute): Coord[] {
  const poly: Coord[] = []
  for (let i = 0; i < route.stops.length; i++) {
    poly.push(route.stops[i].coord)
    const key = `${i}-${i + 1}`
    const wps = route.waypoints?.[key]
    if (wps && i < route.stops.length - 1) {
      for (const w of wps) poly.push(w)
    }
  }
  return poly
}

/** Compute the bounding box covering all stops + waypoints, with padding. */
export function routeBounds(route: ChapterRoute, padFrac = 0.18): {
  west: number; east: number; south: number; north: number
} {
  const poly = buildPolyline(route)
  let minLat = poly[0].lat, maxLat = poly[0].lat
  let minLon = poly[0].lon, maxLon = poly[0].lon
  for (const p of poly) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
  }
  const padLat = Math.max(0.08, (maxLat - minLat) * padFrac)
  const padLon = Math.max(0.08, (maxLon - minLon) * padFrac)
  return {
    west: minLon - padLon,
    east: maxLon + padLon,
    south: minLat - padLat,
    north: maxLat + padLat,
  }
}
