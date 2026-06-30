// Consolidated "Enrico's Attempt at Retirement" → printable PDF helper.
//
// Builds a single HTML document that includes:
//   - cover summary (date range, chapter count, total nautical miles, steaming time)
//   - one section per chapter with title, subtitle, dates, day count, guest chips
//   - a leg block between consecutive chapters with satellite map URL,
//     distance, travel time at 12 kn, and bearing
//
// Renders via the existing printHtmlAsPdf iframe helper so the user picks
// "Save as PDF" from the system print dialog.

import type { Trip } from '@/data/trips'
import { printHtmlAsPdf, escapeHtml } from '@/lib/share-link'
import { buildLegs, type Leg } from '@/pages/schedule/enricos-legs'

function formatRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${fmt(startIso)} – ${fmt(endIso)}`
}

export function printConsolidatedTripAsPdf(chapters: Trip[]) {
  const html = buildConsolidatedHtml(chapters)
  printHtmlAsPdf(html)
}

function buildConsolidatedHtml(chapters: Trip[]): string {
  if (chapters.length === 0) {
    return `<!doctype html><meta charset="utf-8"><body>Nothing to render.</body>`
  }

  const legs = buildLegs()
  const totalNm = Math.round(legs.reduce((acc, l) => acc + l.distanceNm, 0))
  const totalSteamHours = Math.round(legs.reduce((acc, l) => acc + l.travelHours, 0))
  const totalDays = chapters.reduce((acc, t) => acc + t.days.length, 0)
  const range = formatRange(chapters[0].startDate, chapters[chapters.length - 1].endDate)

  const sectionsHtml = chapters
    .map((trip, i) => {
      const chapterNum = String(i + 1).padStart(2, '0')
      const safeName = escapeHtml(trip.name)
      const safeSubtitle = escapeHtml(trip.subtitle)
      const safeRange = escapeHtml(formatRange(trip.startDate, trip.endDate))

      const guestChips =
        trip.guestList && trip.guestList.length > 0
          ? `<div class="guest-row">
              <span class="guest-label">Guests · ${trip.guestList.filter(g => !g.tentative).length}${
                trip.guestList.some(g => g.tentative)
                  ? ` (+${trip.guestList.filter(g => g.tentative).length} maybe)`
                  : ''
              }:</span>
              ${trip.guestList
                .map(
                  g => `<span class="guest-chip ${g.tentative ? 'maybe' : ''}">${escapeHtml(g.name)}${
                    g.note ? ` · <em>${escapeHtml(g.note)}</em>` : ''
                  }</span>`,
                )
                .join('')}
            </div>`
          : trip.guests
            ? `<div class="guest-row"><span class="guest-label">Guests:</span> ${escapeHtml(trip.guests)}</div>`
            : ''

      const nextLeg = legs.find(l => l.fromId === trip.id)
      const legHtml = nextLeg ? buildLegHtml(nextLeg) : ''

      return `
        <section class="chapter">
          <div class="ch-head">
            <div class="ch-num">LEG ${chapterNum}</div>
            <div class="ch-titles">
              <div class="ch-name">${safeName}</div>
              <div class="ch-subtitle">${safeSubtitle}</div>
            </div>
          </div>
          <div class="ch-meta">${safeRange} · ${trip.days.length} days</div>
          ${guestChips}
        </section>
        ${legHtml}
      `
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Enrico's Attempt at Retirement</title>
<style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #0b0b0c; }
  body { font-size: 11pt; line-height: 1.45; }
  h1, h2, h3, h4 { margin: 0; }
  a { color: #b91c1c; text-decoration: none; }

  /* Cover */
  .cover {
    background: linear-gradient(135deg, #312e81 0%, #6b21a8 50%, #be185d 100%);
    color: white;
    padding: 28px 24px;
    border-radius: 16px;
    margin-bottom: 24px;
  }
  .cover .eyebrow { font-size: 10pt; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8; }
  .cover h1 { font-size: 26pt; font-weight: 800; margin-top: 6px; line-height: 1.1; }
  .cover .vessel { font-size: 11pt; opacity: 0.9; margin-top: 4px; }
  .cover .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .cover .stat {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 10pt;
    font-weight: 500;
  }

  /* Chapter */
  .chapter {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 0;
    page-break-inside: avoid;
    background: #fafafa;
  }
  .ch-head { display: flex; align-items: baseline; gap: 12px; }
  .ch-num {
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: #b91c1c;
  }
  .ch-titles { flex: 1; }
  .ch-name { font-size: 14pt; font-weight: 700; color: #0b0b0c; }
  .ch-subtitle { font-size: 10.5pt; color: #4b5563; margin-top: 1px; }
  .ch-meta { font-size: 10pt; color: #6b7280; margin-top: 8px; }

  .guest-row { margin-top: 8px; font-size: 10pt; color: #1f2937; }
  .guest-label { font-weight: 600; margin-right: 4px; }
  .guest-chip {
    display: inline-block;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    padding: 2px 8px;
    margin: 2px 3px 0 0;
    font-size: 9pt;
    color: #111827;
  }
  .guest-chip.maybe {
    border-style: dashed;
    color: #4b5563;
  }

  /* Leg block between chapters */
  .leg {
    margin: 14px 0;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #ffffff;
    page-break-inside: avoid;
  }
  .leg-head {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #b91c1c;
    margin-bottom: 6px;
  }
  .leg-route {
    font-size: 11.5pt;
    font-weight: 600;
    color: #111827;
  }
  .leg-arrow { color: #b91c1c; margin: 0 6px; }
  .leg-stats {
    margin-top: 8px;
    font-size: 10pt;
    color: #1f2937;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .leg-stat {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 3px 8px;
  }
  .leg-stat b { font-weight: 700; }
  .leg-map {
    margin-top: 10px;
    display: block;
    width: 100%;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .footer {
    margin-top: 24px;
    font-size: 9pt;
    color: #6b7280;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="cover">
    <div class="eyebrow">M/Y Rise Above · Summer 2026</div>
    <h1>Enrico's Attempt at Retirement</h1>
    <div class="vessel">Mediterranean season — Balearics to Croatia</div>
    <div class="stats">
      <div class="stat">${escapeHtml(range)}</div>
      <div class="stat">${chapters.length} stops</div>
      <div class="stat">${totalDays} days at sea / in port</div>
      <div class="stat">~${totalNm} nm total passage</div>
      <div class="stat">~${totalSteamHours}h steaming @ 12 kn</div>
    </div>
  </div>

  ${sectionsHtml}

  <div class="footer">M/Y Rise Above III · Generated from the Rise Above engine log</div>
</body>
</html>`
}

function buildLegHtml(leg: Leg): string {
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const cardinal = cardinals[Math.round(leg.bearingDeg / 45) % 8]
  return `
    <div class="leg">
      <div class="leg-head">Passage</div>
      <div class="leg-route">
        ${escapeHtml(leg.fromLabel)} <span class="leg-arrow">→</span> ${escapeHtml(leg.toLabel)}
      </div>
      <div class="leg-stats">
        <span class="leg-stat"><b>${leg.distanceNm.toFixed(0)}</b> nm</span>
        <span class="leg-stat">~<b>${escapeHtml(leg.travelLabel)}</b> @ ${leg.cruiseKnots} kn</span>
        <span class="leg-stat">Heading <b>${cardinal} ${Math.round(leg.bearingDeg)}°</b></span>
      </div>
      <img class="leg-map" src="${escapeHtml(leg.satelliteUrl)}" alt="Satellite map: ${escapeHtml(leg.fromLabel)} to ${escapeHtml(leg.toLabel)}" />
    </div>
  `
}
