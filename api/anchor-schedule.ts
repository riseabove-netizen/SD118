// Anchor watch schedule storage — decoupled from the versioned guide blob so
// admin edits and cron notifications don't create new guide versions.
//
// Sheet: "WatchSchedule" columns:
//   A: WatchStartedAt (ISO, primary key)
//   B: ScheduleJson   ({ "2026-07-05T21:00:00.000Z": "Alex", ... })
//   C: NotifiedJson   ({ "2026-07-05T21:00:00.000Z": "2026-07-05T21:00:14.000Z" })
//   D: UpdatedAt      (ISO)
//   E: UpdatedBy      (crew name)
//
// GET  /api/anchor-schedule?startedAt=<iso>  -> { schedule, notified }
// POST /api/anchor-schedule                  -> { startedAt, schedule?, notified?, user? }

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } }, maxDuration: 15 }

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)

function getSheets() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

async function ensureSheet(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const has = (meta.data.sheets || []).some((s: any) => s.properties?.title === 'WatchSchedule')
  if (!has) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: INVENTORY_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'WatchSchedule' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: 'WatchSchedule!A1:E1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['WatchStartedAt', 'ScheduleJson', 'NotifiedJson', 'UpdatedAt', 'UpdatedBy']] },
    })
  }
}

async function readAll(sheets: any) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'WatchSchedule!A:E',
  })
  return resp.data.values || []
}

function parseJson(s: string | undefined) {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) return res.status(500).json({ error: 'INVENTORY_SPREADSHEET_ID not set' })
  const sheets = getSheets()
  await ensureSheet(sheets)

  if (req.method === 'GET') {
    const startedAt = String(req.query.startedAt || '').trim()
    if (!startedAt) return res.status(400).json({ error: 'startedAt required' })
    const rows = await readAll(sheets)
    const idx = rows.slice(1).findIndex(r => (r[0] || '') === startedAt)
    if (idx < 0) return res.status(200).json({ schedule: {}, notified: {} })
    const row = rows[idx + 1]
    return res.status(200).json({
      schedule: parseJson(row[1]),
      notified: parseJson(row[2]),
      updatedAt: row[3] || '',
      updatedBy: row[4] || '',
    })
  }

  if (req.method === 'POST') {
    const body = req.body as {
      startedAt?: string
      schedule?: Record<string, string>
      notified?: Record<string, string>
      user?: string
    }
    const startedAt = (body?.startedAt || '').trim()
    if (!startedAt) return res.status(400).json({ error: 'startedAt required' })
    const rows = await readAll(sheets)
    const idx = rows.slice(1).findIndex(r => (r[0] || '') === startedAt)
    const nowIso = new Date().toISOString()
    const user = (body.user || 'crew').trim()
    const existing = idx >= 0 ? rows[idx + 1] : null
    const merged = {
      schedule: body.schedule !== undefined ? body.schedule : parseJson(existing?.[1]),
      notified: body.notified !== undefined ? body.notified : parseJson(existing?.[2]),
    }
    const values = [
      startedAt,
      JSON.stringify(merged.schedule || {}),
      JSON.stringify(merged.notified || {}),
      nowIso,
      user,
    ]
    if (idx >= 0) {
      const rowNum = idx + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId: INVENTORY_ID,
        range: `WatchSchedule!A${rowNum}:E${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      })
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: INVENTORY_ID,
        range: 'WatchSchedule!A:E',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      })
    }
    return res.status(200).json({ ok: true, schedule: merged.schedule, notified: merged.notified })
  }

  return res.status(405).json({ error: 'GET or POST only' })
}
