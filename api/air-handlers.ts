// Air Handler maintenance API.
//
// Ops (dispatched via ?op=):
//   GET  op=list    -> return every logged air-handler service row
//   POST op=log     -> record a service event for one or more units.
//                      The client sends { technician, notes, unitIds[],
//                      checklistIds[], serviceDate }. We fan out and
//                      write one row per unitId into AirHandlerLog so the
//                      status page can query "last service per unit"
//                      cheaply.
//
// Storage: sheet AirHandlerLog in the inventory spreadsheet.
//   Columns:
//     EventId | Timestamp | UnitId | Zone | Technician
//     ChecklistIdsCsv | Notes | ServiceDate

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const LOG_HEADERS = [
  'EventId',
  'Timestamp',
  'UnitId',
  'Zone',
  'Technician',
  'ChecklistIdsCsv',
  'Notes',
  'ServiceDate',
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
      spreadsheetId: INVENTORY_ID,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    })
    return
  }
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${title}!A1:Z1`,
  })
  if (!cur.data.values || cur.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    })
  }
}

function newId(prefix = 'AHU'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function rowsToObjects(headers: string[], rows: any[][]): Record<string, string>[] {
  return rows.map(r => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => { o[h] = r[i] != null ? String(r[i]) : '' })
    return o
  })
}

async function opList(res: VercelResponse) {
  const sheets = google.sheets({ version: 'v4', auth: await getAuth() })
  await ensureSheet(sheets, 'AirHandlerLog', LOG_HEADERS)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'AirHandlerLog!A:H',
  })
  const values = resp.data.values || []
  if (values.length <= 1) {
    return res.status(200).json({ events: [] })
  }
  const [headers, ...rows] = values as any[][]
  const events = rowsToObjects(headers.map(String), rows)
    .filter(e => e.EventId)
    .sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''))
  return res.status(200).json({ events })
}

async function opLog(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {}
  const unitIds: string[] = Array.isArray(body.unitIds) ? body.unitIds.filter(Boolean) : []
  const checklistIds: string[] = Array.isArray(body.checklistIds) ? body.checklistIds.filter(Boolean) : []
  const zone = String(body.zone || '')
  const technician = String(body.technician || '')
  const notes = String(body.notes || '')
  const serviceDate = String(body.serviceDate || new Date().toISOString().slice(0, 10))
  if (unitIds.length === 0) {
    return res.status(400).json({ error: 'unitIds required' })
  }

  const sheets = google.sheets({ version: 'v4', auth: await getAuth() })
  await ensureSheet(sheets, 'AirHandlerLog', LOG_HEADERS)

  const eventId = newId('AHU')
  const timestamp = new Date().toISOString()
  const checklistCsv = checklistIds.join(',')

  const rows = unitIds.map(uid => [
    eventId,
    timestamp,
    uid,
    zone,
    technician,
    checklistCsv,
    notes,
    serviceDate,
  ])

  await sheets.spreadsheets.values.append({
    spreadsheetId: INVENTORY_ID,
    range: 'AirHandlerLog!A:H',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  })

  return res.status(200).json({ ok: true, eventId, count: rows.length })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const op = String((req.query.op as string) || (req.body && req.body.op) || 'list')
    if (op === 'list') return await opList(res)
    if (op === 'log') return await opLog(req, res)
    return res.status(400).json({ error: `unknown op: ${op}` })
  } catch (e: any) {
    console.error('[air-handlers] error', e)
    return res.status(500).json({ error: e.message || String(e) })
  }
}
