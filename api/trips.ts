import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
  maxDuration: 30,
}

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)
const SHEET = 'Trips'

function getSheetsAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureSheetExists(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const exists = (meta.data.sheets || []).some((s: any) => s.properties?.title === SHEET)
  if (exists) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: INVENTORY_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: INVENTORY_ID,
    range: `${SHEET}!A1:D1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['ID', 'JSON', 'UpdatedAt', 'UpdatedBy']] },
  })
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  const id = String(req.query.id || '').trim()
  if (!id) return res.status(400).json({ error: 'id required' })

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheetExists(sheets)

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${SHEET}!A:D`,
  })
  const rows = resp.data.values || []
  const dataRow = rows.slice(1).find(r => r[0] === id)
  if (!dataRow) return res.status(200).json({ trip: null })

  let parsed: any = null
  try {
    parsed = JSON.parse(dataRow[1] || 'null')
  } catch {
    parsed = null
  }
  return res.status(200).json({
    trip: parsed,
    updatedAt: dataRow[2] || '',
    updatedBy: dataRow[3] || '',
  })
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'INVENTORY_SPREADSHEET_ID not set' })
  }
  const body = req.body as { id?: string; trip?: any; user?: string }
  if (!body?.id || !body?.trip) {
    return res.status(400).json({ error: 'Invalid body', detail: 'id and trip are required' })
  }
  const id = String(body.id).trim()
  const user = String(body.user || 'crew').trim()
  const json = JSON.stringify(body.trip)
  const nowIso = new Date().toISOString()

  const auth = getSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheetExists(sheets)

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${SHEET}!A:D`,
  })
  const rows = resp.data.values || []
  const existingIdx = rows.slice(1).findIndex(r => r[0] === id)
  const rowValues = [id, json, nowIso, user]

  if (existingIdx >= 0) {
    const sheetRow = existingIdx + 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${SHEET}!A${sheetRow}:D${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: `${SHEET}!A:D`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    })
  }

  return res.status(200).json({ ok: true, id, updatedAt: nowIso })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') return await handleGet(req, res)
    if (req.method === 'POST') return await handlePost(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('trips handler error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Trip request failed', detail })
  }
}
