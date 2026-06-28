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
// Master tab on the existing Engine Log spreadsheet. Configurable via env so
// you can point at a different tab without a redeploy.
const SHEET_TAB = cleanEnv(process.env.RUNLOG_SHEET_TAB) || 'Engine Log'

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

// Engine Log column layout (47 columns, A..AU).
// Each entry is the column letter and the form key (or '' for columns we leave blank).
// Order MUST match the existing sheet header order.
const ENGINE_LOG_COLUMNS: { col: string; key: string }[] = [
  { col: 'A', key: '__datetime' },        // "YYYY/MM/DD HHMM"
  { col: 'B', key: '__type' },             // entry type (blank for normal running entries)
  { col: 'C', key: 'gen_running' },        // Running Gen
  { col: 'D', key: 'gen_port_hours' },     // Gen Hours Port
  { col: 'E', key: 'gen_stbd_hours' },     // Gen Hours STBD
  { col: 'F', key: 'port_engine_hours' },  // Engine Hours Port
  { col: 'G', key: 'stbd_engine_hours' },  // Engine Hours STBD
  { col: 'H', key: '' },                   // Fuel: Daily tank
  { col: 'I', key: '' },                   // Fuel: Aft Main
  { col: 'J', key: '' },                   // Fuel: FWD Main
  { col: 'K', key: 'latitude' },           // Lat
  { col: 'L', key: 'longitude' },          // Long
  { col: 'M', key: 'cog' },                // COG
  { col: 'N', key: 'sog' },                // Speed Ground (kt)
  { col: 'O', key: 'port_rpm' },           // RPM Port
  { col: 'P', key: 'stbd_rpm' },           // RPM STBD
  { col: 'Q', key: 'port_fuel_rate' },     // Fuel Rate Port
  { col: 'R', key: 'stbd_fuel_rate' },     // Fuel Rate STBD
  { col: 'S', key: '' },                   // Gal/hr total (computed)
  { col: 'T', key: '' },                   // L/NM (computed)
  { col: 'U', key: 'port_coolant_temp' },  // Coolant Temp Port
  { col: 'V', key: 'stbd_coolant_temp' },  // Coolant Temp STBD
  { col: 'W', key: 'port_trans_oil_temp' },// Trans Oil Temp Port
  { col: 'X', key: 'stbd_trans_oil_temp' },// Trans Oil Temp STBD
  { col: 'Y', key: 'port_oil_temp' },      // Engine Oil Temp Port
  { col: 'Z', key: 'stbd_oil_temp' },      // Engine Oil Temp STBD
  { col: 'AA', key: 'port_trans_oil_press' },
  { col: 'AB', key: 'stbd_trans_oil_press' },
  { col: 'AC', key: 'port_fuel_temp' },
  { col: 'AD', key: 'stbd_fuel_temp' },
  { col: 'AE', key: 'port_engine_load' },
  { col: 'AF', key: 'stbd_engine_load' },
  { col: 'AG', key: '' },                   // Fuel Rate (dup) Port — leave blank
  { col: 'AH', key: '' },                   // Fuel Rate (dup) STBD
  { col: 'AI', key: 'port_coolant_level' },
  { col: 'AJ', key: 'stbd_coolant_level' },
  { col: 'AK', key: 'port_battery_voltage' },
  { col: 'AL', key: 'stbd_battery_voltage' },
  { col: 'AM', key: '' },                   // Engine Hours (dup) Port
  { col: 'AN', key: '' },                   // Engine Hours (dup) STBD
  { col: 'AO', key: 'port_exhaust_temp_l' },
  { col: 'AP', key: 'stbd_exhaust_temp_l' },
  { col: 'AQ', key: 'port_exhaust_temp_r' },
  { col: 'AR', key: 'stbd_exhaust_temp_r' },
  { col: 'AS', key: 'wind' },
  { col: 'AT', key: 'sea_conditions' },
  { col: 'AU', key: '__comments' },         // comments + notes
]

const LAST_COL = ENGINE_LOG_COLUMNS[ENGINE_LOG_COLUMNS.length - 1].col

// Combine a date (YYYY-MM-DD or YYYY/MM/DD) and time (HH:MM or HHMM) into the
// existing format used in Engine Log: "YYYY/MM/DD HHMM"
function formatDateTime(date: string, time: string): string {
  const d = (date || '').trim().replace(/-/g, '/')
  let t = (time || '').trim().replace(':', '')
  if (t && t.length === 3) t = '0' + t
  return [d, t].filter(Boolean).join(' ')
}

function buildRow(values: Record<string, unknown>): string[] {
  const date = String(values.date || '')
  const time = String(values.time || '')
  const datetime = formatDateTime(date, time)
  const comments = [values.comments, values.notes].map(v => (v ? String(v) : '')).filter(Boolean).join(' \u2014 ')

  return ENGINE_LOG_COLUMNS.map(({ key }) => {
    if (key === '__datetime') return datetime
    if (key === '__type') return ''
    if (key === '__comments') return comments
    if (!key) return ''
    const v = values[key]
    return v !== undefined && v !== null ? String(v) : ''
  })
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

    const row = buildRow(values)

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:${LAST_COL}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    })

    return res.status(200).json({ ok: true, tab: SHEET_TAB })
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
