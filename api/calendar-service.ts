// Generic calendar-based maintenance service log.
//
// Handles any system whose intervals are measured in days (weekly /
// monthly / yearly / as-needed) — currently AC chillers, tanks, and
// fresh-water system. AHU is its own module because it predates this
// generalization; keeping them separate avoids a risky migration.
//
// Ops (dispatched via ?op=):
//   GET  op=list                  -> return every logged row
//   GET  op=list&systemId=<id>    -> filter by system
//   POST op=log                   -> record a service. Body:
//     { systemId, unitIds[], itemIds[], technician, notes, serviceDate }
//     Writes one row per (unit × item) so status queries are trivial.
//
// Storage: sheet `CalendarServiceLog` in the inventory spreadsheet.
//   Columns:
//     EventId | Timestamp | SystemId | UnitId | ItemId
//     Technician | Notes | ServiceDate

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}
const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const LOG_HEADERS = [
  'EventId', 'Timestamp',
  'SystemId', 'UnitId', 'ItemId',
  'Technician', 'Notes', 'ServiceDate',
]

async function ensureSheet(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === title)
  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: INVENTORY_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID, range: `${title}!A1`,
      valueInputOption: 'RAW', requestBody: { values: [headers] },
    })
    return
  }
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID, range: `${title}!A1:Z1`,
  })
  if (!cur.data.values || cur.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID, range: `${title}!A1`,
      valueInputOption: 'RAW', requestBody: { values: [headers] },
    })
  }
}

function newId(prefix = 'CSV'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function rowsToObjects(headers: string[], rows: any[][]): Record<string, string>[] {
  return rows.map(r => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => { o[h] = r[i] != null ? String(r[i]) : '' })
    return o
  })
}

async function opList(req: VercelRequest, res: VercelResponse) {
  const filterSystem = String((req.query.systemId as string) || '')
  const sheets = google.sheets({ version: 'v4', auth: await getAuth() })
  await ensureSheet(sheets, 'CalendarServiceLog', LOG_HEADERS)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID, range: 'CalendarServiceLog!A:H',
  })
  const values = resp.data.values || []
  if (values.length <= 1) return res.status(200).json({ events: [] })
  const [headers, ...rows] = values as any[][]
  let events = rowsToObjects(headers.map(String), rows).filter(e => e.EventId)
  if (filterSystem) events = events.filter(e => e.SystemId === filterSystem)
  events.sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''))
  return res.status(200).json({ events })
}

async function opLog(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {}
  const systemId = String(body.systemId || '')
  const unitIds: string[] = Array.isArray(body.unitIds) ? body.unitIds.filter(Boolean) : []
  const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds.filter(Boolean) : []
  const technician = String(body.technician || '')
  const notes = String(body.notes || '')
  const serviceDate = String(body.serviceDate || new Date().toISOString().slice(0, 10))
  if (!systemId) return res.status(400).json({ error: 'systemId required' })
  if (unitIds.length === 0) return res.status(400).json({ error: 'unitIds required' })
  if (itemIds.length === 0) return res.status(400).json({ error: 'itemIds required' })

  const sheets = google.sheets({ version: 'v4', auth: await getAuth() })
  await ensureSheet(sheets, 'CalendarServiceLog', LOG_HEADERS)

  const eventId = newId('CSV')
  const timestamp = new Date().toISOString()

  // Fan out one row per (unit × item) so status queries stay trivial.
  const rows: string[][] = []
  for (const uid of unitIds) {
    for (const iid of itemIds) {
      rows.push([eventId, timestamp, systemId, uid, iid, technician, notes, serviceDate])
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: INVENTORY_ID,
    range: 'CalendarServiceLog!A:H',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  })

  return res.status(200).json({ ok: true, eventId, count: rows.length })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const op = String((req.query.op as string) || (req.body && req.body.op) || 'list')
    if (op === 'list') return await opList(req, res)
    if (op === 'log')  return await opLog(req, res)
    return res.status(400).json({ error: `unknown op: ${op}` })
  } catch (e: any) {
    console.error('[calendar-service] error', e)
    return res.status(500).json({ error: e.message || String(e) })
  }
}
