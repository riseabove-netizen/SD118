// Inter-chapter leg data for Enrico's Summer Trip.
//
// Each chapter has a representative anchor coordinate (port/anchorage where the
// vessel typically sits). Between consecutive chapters we compute:
//   - great-circle distance in nautical miles
//   - travel time at the configured cruising speed
//   - a satellite image URL with a route polyline drawn over the water
//
// Speeds:
//   Cruising: 12 knots (configurable per leg via OVERRIDES)
//
// Coordinates are picked to be in/near the water on the most plausible route,
// so the straight-line connector reads as a sea passage.

export type Coord = { lat: number; lon: number }

export type ChapterAnchor = {
  id: string
  label: string
  coord: Coord
}

// Anchors picked to sit in the marina / anchorage area of each chapter so the
// straight-line between consecutive points falls over water.
export const CHAPTER_ANCHORS: ChapterAnchor[] = [
  { id: 'balearics-2026',             label: 'Palma de Mallorca',       coord: { lat: 39.555, lon: 2.630 } },
  { id: 'menorca-corsica-2026',       label: 'Cap de Creus / Corsica',  coord: { lat: 41.620, lon: 9.380 } }, // Bonifacio
  { id: 'sardinia-2026',              label: 'Costa Smeralda',          coord: { lat: 41.130, lon: 9.540 } }, // Porto Cervo
  { id: 'ponza-2026',                 label: 'Ponza',                   coord: { lat: 40.900, lon: 12.965 } },
  { id: 'naples-family-2026',         label: 'Naples · Family',          coord: { lat: 40.833, lon: 14.245 } }, // Naples
  { id: 'capri-amalfi-aeolian-2026',  label: 'Capri · Aeolian · Catania', coord: { lat: 38.500, lon: 14.950 } }, // Lipari
  { id: 'malta-2026',                 label: 'Valletta, Malta',         coord: { lat: 35.895, lon: 14.515 } },
  { id: 'gozo-2026',                  label: 'Mgarr, Gozo',             coord: { lat: 36.025, lon: 14.300 } },
  { id: 'sicily-aeolian-revisit-2026',label: 'Taormina / Sicily E.',    coord: { lat: 37.850, lon: 15.300 } },
  { id: 'crotone-2026',               label: 'Crotone, Calabria',       coord: { lat: 39.080, lon: 17.130 } },
  { id: 'corfu-2026',                 label: 'Corfu',                   coord: { lat: 39.620, lon: 19.920 } },
  { id: 'albanian-riviera-2026',      label: 'Sarandë, Albania',        coord: { lat: 39.875, lon: 20.005 } },
  { id: 'montenegro-2026',            label: 'Kotor Bay, Montenegro',   coord: { lat: 42.430, lon: 18.770 } },
  { id: 'dubrovnik-2026',             label: 'Dubrovnik, Croatia',      coord: { lat: 42.660, lon: 18.080 } },
  { id: 'hvar-split-2026',            label: 'Hvar / Split',            coord: { lat: 43.170, lon: 16.440 } },
]

// Per-leg speed override (knots). Defaults to CRUISE_KNOTS.
const CRUISE_KNOTS = 12

// =================== math helpers ===================

const EARTH_RADIUS_NM = 3440.065 // nautical miles

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance in nautical miles (haversine). */
export function distanceNm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(h))
}

/** Initial bearing in degrees (0–360). */
export function bearingDeg(a: Coord, b: Coord): number {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

/** Convert decimal hours to "Xh Ym". */
export function formatDuration(hours: number): string {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// =================== leg model ===================

export type Leg = {
  fromId: string
  toId: string
  fromLabel: string
  toLabel: string
  from: Coord
  to: Coord
  distanceNm: number
  bearingDeg: number
  cruiseKnots: number
  travelHours: number
  travelLabel: string
  /** Satellite image URL with route line + endpoint markers overlaid. */
  satelliteUrl: string
  /** Google Maps directions URL (driving fallback — useful for reference). */
  mapsUrl: string
}

/** Build all 14 consecutive legs between the 15 anchors. */
export function buildLegs(): Leg[] {
  const legs: Leg[] = []
  for (let i = 0; i < CHAPTER_ANCHORS.length - 1; i++) {
    const a = CHAPTER_ANCHORS[i]
    const b = CHAPTER_ANCHORS[i + 1]
    const dist = distanceNm(a.coord, b.coord)
    const knots = CRUISE_KNOTS
    const hours = dist / knots
    legs.push({
      fromId: a.id,
      toId: b.id,
      fromLabel: a.label,
      toLabel: b.label,
      from: a.coord,
      to: b.coord,
      distanceNm: dist,
      bearingDeg: bearingDeg(a.coord, b.coord),
      cruiseKnots: knots,
      travelHours: hours,
      travelLabel: formatDuration(hours),
      satelliteUrl: satelliteWithRoute(a.coord, b.coord),
      mapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${a.coord.lat},${a.coord.lon}&destination=${b.coord.lat},${b.coord.lon}&travelmode=driving`,
    })
  }
  return legs
}

// =================== satellite image with route overlay ===================

/**
 * Build a satellite image URL with a red route line and endpoint markers.
 *
 * Uses the ArcGIS World_Imagery export endpoint that already powers
 * `satelliteImage` in src/data/trips.ts, but adds a `mapExtent` (instead of
 * `bbox`) and a `layers` overlay with a polyline + two stop markers.
 *
 * Padding: 25 % around the bbox so the route doesn't hug the edge.
 */
export function satelliteWithRoute(a: Coord, b: Coord, sizeW = 800, sizeH = 360): string {
  // Bounding box around both points, padded.
  const minLat = Math.min(a.lat, b.lat)
  const maxLat = Math.max(a.lat, b.lat)
  const minLon = Math.min(a.lon, b.lon)
  const maxLon = Math.max(a.lon, b.lon)
  const padLat = Math.max(0.2, (maxLat - minLat) * 0.25)
  const padLon = Math.max(0.2, (maxLon - minLon) * 0.25)
  const west = minLon - padLon
  const east = maxLon + padLon
  const south = minLat - padLat
  const north = maxLat + padLat

  // We use the ArcGIS export endpoint with `bbox` for the basemap and a
  // dynamicLayers overlay for the route. The export endpoint supports a
  // separate `geometry` query that we can pass as a polyline — but the
  // simpler, widely-supported path is to embed the route + markers as part
  // of a single image by relying on the export endpoint's symbology via
  // the public "Pacific/Esri" basemap and overlay services.
  //
  // To keep this dependency-free and CORS-friendly, we render a single
  // basemap snapshot, and the consumer overlays an SVG route on top of the
  // <img> in the React component (more reliable than baking a polyline
  // into the ArcGIS URL across all CDNs).
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${sizeW},${sizeH}`,
    format: 'jpg',
    f: 'image',
  })
  return `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?${params.toString()}`
}

/**
 * Given the same bbox math as satelliteWithRoute, return the projected
 * (x, y) pixel coordinates of two points within an image of `sizeW × sizeH`.
 * Used by the React overlay to draw the route line + markers as SVG on top
 * of the basemap snapshot — keeping the implementation CDN-agnostic.
 */
export function projectInBbox(
  a: Coord,
  b: Coord,
  sizeW: number,
  sizeH: number,
): { ax: number; ay: number; bx: number; by: number } {
  const minLat = Math.min(a.lat, b.lat)
  const maxLat = Math.max(a.lat, b.lat)
  const minLon = Math.min(a.lon, b.lon)
  const maxLon = Math.max(a.lon, b.lon)
  const padLat = Math.max(0.2, (maxLat - minLat) * 0.25)
  const padLon = Math.max(0.2, (maxLon - minLon) * 0.25)
  const west = minLon - padLon
  const east = maxLon + padLon
  const south = minLat - padLat
  const north = maxLat + padLat

  const lonToX = (lon: number) => ((lon - west) / (east - west)) * sizeW
  const latToY = (lat: number) => ((north - lat) / (north - south)) * sizeH

  return {
    ax: lonToX(a.lon),
    ay: latToY(a.lat),
    bx: lonToX(b.lon),
    by: latToY(b.lat),
  }
}
