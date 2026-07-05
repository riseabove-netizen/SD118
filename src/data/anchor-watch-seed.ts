// Anchor Watchkeeper Log — based on the 'Anchoring' operating procedure,
// with the customizations the captain requested:
//   • Remove the first 4 children of "Consider the following"
//     (How many shackles, Holding ground, Current/Depth/Tide, Other vessels)
//   • Remove: Weather Forecast, Shore Communications group (5 children),
//     Security Watch
//   • Add: Enable Anchor watch alarm

export interface AnchorChecklistItem {
  id: string
  label: string
  indent: 0 | 1
  isGroup?: boolean
}

export const ANCHOR_CHECKLIST: AnchorChecklistItem[] = [
  // "Consider the following" header is kept but its 4 children are removed.
  { id: 'aw-1',  label: 'Consider the following', indent: 0, isGroup: true },
  { id: 'aw-2',  label: 'Swinging circle', indent: 0 },
  { id: 'aw-3',  label: "Location – Check chart or pilot book warnings", indent: 0 },
  { id: 'aw-4',  label: "Display 'At Anchor' signals", indent: 0 },
  { id: 'aw-5',  label: 'Plan crew/passenger movements on and off yacht', indent: 0 },
  { id: 'aw-6',  label: 'Agree communications procedures', indent: 0 },
  { id: 'aw-7',  label: 'Toys', indent: 0, isGroup: true },
  { id: 'aw-7a', label: 'Intended use', indent: 1 },
  { id: 'aw-7b', label: 'Supervision', indent: 1 },
  { id: 'aw-7c', label: 'Communications', indent: 1 },
  { id: 'aw-8',  label: 'Tender', indent: 0, isGroup: true },
  { id: 'aw-8a', label: 'Intended use', indent: 1 },
  { id: 'aw-8b', label: 'Designated person to remain with tender if ashore', indent: 1 },
  { id: 'aw-8c', label: 'Communications', indent: 1 },
  { id: 'aw-9',  label: 'Enable Anchor watch alarm', indent: 0 },
]

export interface AnchorWatchSign {
  name: string           // crew name
  timestamp: string      // ISO
  wind?: string          // wind reading, e.g. "12 kt NW"
  notes?: string
}

export interface AnchorWatchData {
  // Setup
  locationName: string         // also used in the title
  locationNotes: string
  lat: number | null
  lon: number | null
  coordsFormatted: string      // e.g. "N 39°47.945' E 2°28.843'"
  depth: string                // metres
  chainLength: string          // "shackles" / metres — free text
  safetyRing: string           // metres
  physicalDanger: string
  presenceOfCouple: string     // (kept the model image field literally — neighbor vessel notes)
  windAlarmKt: string          // contact captain if wind > this many knots; default 16
  startedAt: string            // ISO
  startedBy: string            // crew name (captain or watch keeper)

  // Pre-anchor checklist (item.id -> checked)
  checklist: Record<string, boolean>

  // Static images captured at start
  satelliteUrl?: string        // Esri static export URL
  windForecastJson?: string    // serialized forecast (we render a chart from this)

  // Hourly signatures
  signatures: AnchorWatchSign[]

  // Hourly watch schedule (admin-editable): ISO hour start -> crew name
  // e.g. { "2026-07-05T21:00:00.000Z": "Alex", "2026-07-05T22:00:00.000Z": "Sam" }
  schedule?: Record<string, string>

  // Server-side bookkeeping: which schedule slots have already been notified
  // (so the cron doesn't ping the same person twice). Written by /api/watch-cron.
  notifiedSlots?: Record<string, string>  // hourIso -> notifiedAt ISO

  // Close-out
  closed: boolean
  closedAt?: string
  closedBy?: string            // captain
  chartTrackPhotoUrl?: string  // uploaded photo of chart tracks
  pdfUrl?: string              // uploaded PDF
}

export function emptyAnchorWatch(): AnchorWatchData {
  return {
    locationName: '',
    locationNotes: '',
    lat: null,
    lon: null,
    coordsFormatted: '',
    depth: '',
    chainLength: '',
    safetyRing: '',
    physicalDanger: '',
    presenceOfCouple: '',
    windAlarmKt: '16',
    startedAt: '',
    startedBy: '',
    checklist: {},
    signatures: [],
    closed: false,
  }
}

export const ANCHOR_WATCH_ACTIVE_ID = 'ANCHOR-WATCH-ACTIVE'
