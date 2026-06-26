// Trip schedule → printable PDF helper.
import type { Trip } from '@/data/trips'
import { printHtmlAsPdf, escapeHtml } from '@/lib/share-link'

function formatRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${fmt(startIso)} – ${fmt(endIso)}`
}

export function printTripAsPdf(trip: Trip) {
  const html = buildTripHtml(trip)
  printHtmlAsPdf(html)
}

function buildTripHtml(trip: Trip): string {
  const safeName = escapeHtml(trip.name)
  const safeSubtitle = escapeHtml(trip.subtitle)
  const safeRange = escapeHtml(formatRange(trip.startDate, trip.endDate))

  const daysHtml = trip.days
    .map((day, i) => {
      const eventsHtml = day.events
        .map(e => {
          const time = e.time ? `<span class="time">${escapeHtml(e.time)}</span>` : ''
          const title = `<span class="ev-title ${e.highlight ? 'hl' : ''}">${escapeHtml(e.title)}</span>`
          const details = e.details && e.details.length
            ? `<ul class="details">${e.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
            : ''
          return `<li class="event ${e.highlight ? 'hl' : ''}"><div class="ev-head">${time}${title}</div>${details}</li>`
        })
        .join('')
      const overnight = day.overnight
        ? `<div class="overnight">🌙 Overnight: <strong>${escapeHtml(day.overnight)}</strong></div>`
        : ''
      return `
        <section class="day">
          <div class="day-head">
            <span class="day-num">Day ${i + 1}</span>
            <span class="day-date">${escapeHtml(day.date)}</span>
          </div>
          <h2 class="day-title">${escapeHtml(day.title)}</h2>
          ${day.subtitle ? `<div class="day-sub">${escapeHtml(day.subtitle)}</div>` : ''}
          <ul class="events">${eventsHtml}</ul>
          ${overnight}
        </section>
      `
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeName}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #111;
    background: #fff;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .header {
    border-bottom: 2px solid #b91c1c;
    padding-bottom: 10px;
    margin-bottom: 16px;
  }
  .vessel {
    font-size: 9pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #b91c1c;
    font-weight: 700;
    margin-bottom: 4px;
  }
  h1 {
    font-size: 22pt;
    margin: 0 0 4px 0;
    line-height: 1.15;
  }
  .subtitle {
    color: #555;
    font-size: 10pt;
  }
  .range {
    margin-top: 6px;
    color: #444;
    font-size: 9.5pt;
  }
  .range .pill {
    display: inline-block;
    border: 1px solid #ddd;
    padding: 2px 8px;
    border-radius: 4px;
    margin-right: 6px;
    font-size: 9pt;
  }
  .day {
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    page-break-inside: avoid;
  }
  .day-head {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: 9pt;
    color: #6b7280;
  }
  .day-num {
    color: #b91c1c;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .day-title {
    font-size: 13pt;
    margin: 2px 0 1px 0;
    color: #111;
  }
  .day-sub {
    color: #6b7280;
    font-size: 9.5pt;
    margin-bottom: 6px;
  }
  ul.events {
    list-style: none;
    margin: 8px 0 0 0;
    padding: 0;
    border-left: 2px solid #eee;
  }
  li.event {
    position: relative;
    padding: 4px 0 4px 14px;
    margin-left: 4px;
  }
  li.event::before {
    content: "";
    position: absolute;
    left: -5px;
    top: 9px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c0c4cc;
  }
  li.event.hl::before {
    background: #b91c1c;
    box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.18);
  }
  .ev-head { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .ev-title { font-weight: 500; }
  .ev-title.hl { font-weight: 700; }
  .time {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    color: #b91c1c;
    background: #fef2f2;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 9pt;
  }
  ul.details {
    margin: 2px 0 0 4px;
    padding-left: 16px;
    color: #555;
    font-size: 9.5pt;
  }
  ul.details li { margin: 1px 0; }
  .overnight {
    margin-top: 8px;
    padding: 5px 8px;
    background: #f9fafb;
    border-top: 1px dashed #e5e7eb;
    color: #4b5563;
    font-size: 9pt;
  }
  .footer {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    color: #777;
    font-size: 8.5pt;
    text-align: center;
  }
  @media print { a { color: #111; text-decoration: none; } }
</style>
</head>
<body>
  <div class="header">
    <div class="vessel">M/Y Rise Above III · Schedule</div>
    <h1>${safeName}</h1>
    <div class="subtitle">${safeSubtitle}</div>
    <div class="range">
      <span class="pill">${safeRange}</span>
      <span class="pill">${trip.days.length} days</span>
    </div>
  </div>
  <main>${daysHtml}</main>
  <div class="footer">M/Y Rise Above · Itinerary subject to weather &amp; conditions · Generated ${escapeHtml(new Date().toLocaleString())}</div>
</body>
</html>`
}
