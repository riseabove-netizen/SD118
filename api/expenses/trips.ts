// GET /api/expenses/trips        → list guest trips.
// POST /api/expenses/trips        → create a new guest trip. Admin only.
//
// Guest_Trips sheet layout (columns A..E):
//   A name           - display name, e.g. "Enrico's Med Summer"
//   B start_date     - inclusive, YYYY-MM-DD
//   C end_date       - inclusive, YYYY-MM-DD
//   D active         - 'active' | 'archived'
//   E created_at     - ISO timestamp
//
// The date range is used by the client to pre-fill the trip on a txn card
// whose date falls inside it.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { requireAdmin, requireCrew, sheetsAuth, SPREADSHEET_ID } from '../_plaid.js'

export const TRIPS_TAB = 'Guest_Trips'

type Trip = { name: string; start_date: string; end_date: string; active: boolean }

async function ensureTab(sheets: any): Promise<void> {
  // No-op if the tab already exists; create with a header row otherwise.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties.title' })
  const has = (meta.data.sheets || []).some((s: any) => s.properties?.title === TRIPS_TAB)
  if (has) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: TRIPS_TAB } } }] },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TRIPS_TAB}!A1:E1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['name', 'start_date', 'end_date', 'status', 'created_at']] },
  })
}

async function listTrips(sheets: any): Promise<Trip[]> {
  await ensureTab(sheets)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TRIPS_TAB}!A2:E`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  const values = resp.data.values || []
  return values
    .map((r: any[]) => ({
      name: String(r[0] ?? '').trim(),
      start_date: String(r[1] ?? '').trim(),
      end_date: String(r[2] ?? '').trim(),
      active: String(r[3] ?? 'active').trim().toLowerCase() !== 'archived',
    }))
    .filter((t: Trip) => t.name)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = sheetsAuth(true)
  const sheets = google.sheets({ version: 'v4', auth })

  if (req.method === 'GET') {
    if (!requireCrew(req, res)) return
    try {
      const trips = await listTrips(sheets)
      return res.status(200).json({ ok: true, trips })
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || String(e) })
    }
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return
    try {
      const body = req.body as { name?: string; start_date?: string; end_date?: string }
      const name = String(body?.name || '').trim()
      const start = String(body?.start_date || '').trim()
      const end = String(body?.end_date || '').trim()
      if (!name) return res.status(400).json({ error: 'name required' })
      // Basic ISO date validation
      const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
      if (start && !ok(start)) return res.status(400).json({ error: 'start_date must be YYYY-MM-DD' })
      if (end && !ok(end)) return res.status(400).json({ error: 'end_date must be YYYY-MM-DD' })
      if (start && end && end < start) return res.status(400).json({ error: 'end_date is before start_date' })
      await ensureTab(sheets)
      // Reject duplicate names (case-insensitive).
      const existing = await listTrips(sheets)
      if (existing.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'A trip with that name already exists' })
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${TRIPS_TAB}!A:E`,
        valueInputOption: 'RAW',
        requestBody: { values: [[name, start, end, 'active', new Date().toISOString()]] },
      })
      return res.status(200).json({ ok: true, trip: { name, start_date: start, end_date: end, active: true } })
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || String(e) })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
