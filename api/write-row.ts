import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

// Sanitize env values — strip surrounding quotes and whitespace/newlines that
// sometimes get pasted into the Vercel dashboard.
function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const SHEET_ID = cleanEnv(process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID)
const SHEET_TAB = 'Running Log'

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (keyJson) {
    const key = JSON.parse(keyJson)
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// Column key -> human header label. Order here is the order written to the sheet.
const COLUMNS: { key: string; header: string }[] = [
  { key: 'date', header: 'Date' },
  { key: 'time', header: 'Time' },
  { key: 'gen_running', header: 'Gen Running' },
  { key: 'gen_port_hours', header: 'Port Gen Hours' },
  { key: 'gen_stbd_hours', header: 'STBD Gen Hours' },
  { key: 'latitude', header: 'Latitude' },
  { key: 'longitude', header: 'Longitude' },
  { key: 'cog', header: 'COG' },
  { key: 'sog', header: 'SOG' },
  // Port engine
  { key: 'port_engine_hours', header: 'Port Engine Hours' },
  { key: 'port_rpm', header: 'Port RPM' },
  { key: 'port_fuel_rate', header: 'Port Fuel Rate' },
  { key: 'port_coolant_temp', header: 'Port Coolant Temp' },
  { key: 'port_trans_oil_temp', header: 'Port Trans Oil Temp' },
  { key: 'port_oil_temp', header: 'Port Engine Oil Temp' },
  { key: 'port_trans_oil_press', header: 'Port Trans Oil Press' },
  { key: 'port_fuel_temp', header: 'Port Fuel Temp' },
  { key: 'port_engine_load', header: 'Port Engine Load' },
  { key: 'port_coolant_level', header: 'Port Coolant Level' },
  { key: 'port_battery_voltage', header: 'Port ECU Batt Voltage' },
  { key: 'port_exhaust_temp_l', header: 'Port Exhaust Temp L' },
  { key: 'port_exhaust_temp_r', header: 'Port Exhaust Temp R' },
  // Starboard engine
  { key: 'stbd_engine_hours', header: 'STBD Engine Hours' },
  { key: 'stbd_rpm', header: 'STBD RPM' },
  { key: 'stbd_fuel_rate', header: 'STBD Fuel Rate' },
  { key: 'stbd_coolant_temp', header: 'STBD Coolant Temp' },
  { key: 'stbd_trans_oil_temp', header: 'STBD Trans Oil Temp' },
  { key: 'stbd_oil_temp', header: 'STBD Engine Oil Temp' },
  { key: 'stbd_trans_oil_press', header: 'STBD Trans Oil Press' },
  { key: 'stbd_fuel_temp', header: 'STBD Fuel Temp' },
  { key: 'stbd_engine_load', header: 'STBD Engine Load' },
  { key: 'stbd_coolant_level', header: 'STBD Coolant Level' },
  { key: 'stbd_battery_voltage', header: 'STBD ECU Batt Voltage' },
  { key: 'stbd_exhaust_temp_l', header: 'STBD Exhaust Temp L' },
  { key: 'stbd_exhaust_temp_r', header: 'STBD Exhaust Temp R' },
  // Conditions
  { key: 'wind', header: 'Wind' },
  { key: 'sea_conditions', header: 'Sea Conditions' },
  { key: 'comments', header: 'Comments' },
  { key: 'notes', header: 'Notes' },
]

async function ensureSheetReady(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string) {
  // Look up tab presence
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
  const existing = meta.data.sheets?.find(s => s.properties?.title === SHEET_TAB)

  if (!existing) {
    // Create the tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
      },
    })
  }

  // Ensure header row exists (only writes if A1 is empty)
  const headerRange = `${SHEET_TAB}!A1:1`
  const headerResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  })
  const firstCell = headerResp.data.values?.[0]?.[0]
  if (!firstCell) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [COLUMNS.map(c => c.header)],
      },
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SHEET_ID) {
    return res.status(500).json({
      error: 'Failed to write row',
      detail: 'SPREADSHEET_ID env var is not set on the server',
    })
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    return res.status(500).json({
      error: 'Failed to write row',
      detail: 'GOOGLE_SERVICE_ACCOUNT_KEY env var is not set on the server',
    })
  }

  const { values } = req.body as { values?: Record<string, unknown>; token?: string }

  if (!values) {
    return res.status(400).json({ error: 'Missing values' })
  }

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    await ensureSheetReady(sheets, SHEET_ID)

    const row = COLUMNS.map(({ key }) => {
      const v = values[key]
      return v !== undefined && v !== null ? String(v) : ''
    })

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    })

    return res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error('Write-row error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to write row', detail })
  }
}