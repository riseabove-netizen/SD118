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

const SHEET_ID = cleanEnv(process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID)
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
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// Engine Log column layout — verified 2026-07-01 against the actual 2-row
// merged header on the master "Engine Log" tab by reading the live sheet.
// Note the ordering: the master sheet places ENGINE OIL PRESSURE (Z/AA)
// BEFORE Engine Oil Temperature (AB/AC), and TRANSMISSION OIL PRESSURE
// (AD/AE) comes after Oil Temp. Historical rows (before 2026-07-01) were
// written with an off-by-one layout that put oil_temp values into the
// Engine Oil Pressure columns and trans_oil_press values into the Engine
// Oil Temp columns — see api/backfill-oil-pressure.ts.
//
// `formula: (row)=>...` means the column holds a computed formula that we
// write explicitly for each new row (so the formula propagates even when the
// user has not manually filled it down). The cell value is preserved when the
// row already contains data; the formula is only emitted for brand-new rows.
const ENGINE_LOG_COLUMNS: { col: string; key: string; formula?: (row: number) => string }[] = [
  { col: 'A',  key: '__datetime' },                  // Date/Time "YYYY/MM/DD HHMM"
  { col: 'B',  key: 'entry_type' },                  // Type
  { col: 'C',  key: 'gen_running' },                 // Running Gen
  { col: 'D',  key: 'gen_port_hours' },              // Gen Hours Port
  { col: 'E',  key: 'gen_stbd_hours' },              // Gen Hours STBD
  { col: 'F',  key: 'port_engine_hours' },           // Engine Hours Port
  { col: 'G',  key: 'stbd_engine_hours' },           // Engine Hours STBD
  { col: 'H',  key: '',                              // Fuel Total = SUM(I:K) when all three tank readings present
    formula: (r) => `=if(or(I${r}="",J${r}="",K${r}=""),"",SUM(I${r}:K${r}))` },
  { col: 'I',  key: 'fuel_daily' },                  // Fuel: Daily tank
  { col: 'J',  key: 'fuel_aft' },                    // Fuel: Aft Main
  { col: 'K',  key: 'fuel_fwd' },                    // Fuel: FWD Main
  { col: 'L',  key: 'latitude' },                    // Lat
  { col: 'M',  key: 'longitude' },                   // Long
  { col: 'N',  key: 'cog' },                         // COG
  { col: 'O',  key: 'sog' },                         // Ground speed (kt)
  { col: 'P',  key: 'port_rpm' },                    // RPM Port
  { col: 'Q',  key: 'stbd_rpm' },                    // RPM STBD
  { col: 'R',  key: 'port_fuel_rate' },              // Fuel Rate Port
  { col: 'S',  key: 'stbd_fuel_rate' },              // Fuel Rate STBD
  { col: 'T',  key: '',                              // Gal/hr total — converts fuel-rate sum + 4 gal/hr gen to gal
    formula: (r) => `=O${r}/(((left(S${r},2)+left(R${r},2)+4))/3.78541)` },
  { col: 'U',  key: '',                              // L/NM — litres consumed per nautical mile
    formula: (r) => `=(left(S${r},2)+left(R${r},2)+4)/O${r}` },
  { col: 'V',  key: 'port_coolant_temp' },           // Coolant Temp Port
  { col: 'W',  key: 'stbd_coolant_temp' },           // Coolant Temp STBD
  { col: 'X',  key: 'port_trans_oil_temp' },         // Trans Oil Temp Port
  { col: 'Y',  key: 'stbd_trans_oil_temp' },         // Trans Oil Temp STBD
  { col: 'Z',  key: 'port_oil_press' },              // Engine Oil Pressure Port
  { col: 'AA', key: 'stbd_oil_press' },              // Engine Oil Pressure STBD
  { col: 'AB', key: 'port_oil_temp' },               // Engine Oil Temp Port
  { col: 'AC', key: 'stbd_oil_temp' },               // Engine Oil Temp STBD
  { col: 'AD', key: 'port_trans_oil_press' },        // Trans Oil Press Port
  { col: 'AE', key: 'stbd_trans_oil_press' },        // Trans Oil Press STBD
  { col: 'AF', key: 'port_fuel_temp' },              // Fuel Temp Port
  { col: 'AG', key: 'stbd_fuel_temp' },              // Fuel Temp STBD
  { col: 'AH', key: 'port_fuel_pressure' },          // Fuel Pressure Port
  { col: 'AI', key: 'stbd_fuel_pressure' },          // Fuel Pressure STBD
  { col: 'AJ', key: 'port_engine_load' },            // Engine Load Port
  { col: 'AK', key: 'stbd_engine_load' },            // Engine Load STBD
  { col: 'AL', key: 'port_coolant_level' },          // Coolant Level Port
  { col: 'AM', key: 'stbd_coolant_level' },          // Coolant Level STBD
  { col: 'AN', key: 'port_battery_voltage' },        // ECU Batt Voltage Port
  { col: 'AO', key: 'stbd_battery_voltage' },        // ECU Batt Voltage STBD
  { col: 'AP', key: 'port_exhaust_temp_l' },         // Exhaust Temp Left Port
  { col: 'AQ', key: 'stbd_exhaust_temp_l' },         // Exhaust Temp Left STBD
  { col: 'AR', key: 'port_exhaust_temp_r' },         // Exhaust Temp Right Port
  { col: 'AS', key: 'stbd_exhaust_temp_r' },         // Exhaust Temp Right STBD
  { col: 'AT', key: 'port_inlet_manifold_temp' },    // Inlet Manifold Temp Port
  { col: 'AU', key: 'stbd_inlet_manifold_temp' },    // Inlet Manifold Temp STBD
  { col: 'AV', key: '__waves' },                     // Waves (sea + wind)
  { col: 'AW', key: '__comments' },                  // Comments
]

const LAST_COL = ENGINE_LOG_COLUMNS[ENGINE_LOG_COLUMNS.length - 1].col

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

  // Combine wind and sea_conditions into the Waves column
  const wind = String(values.wind || '').trim()
  const sea = String(values.sea_conditions || '').trim()
  let waves = ''
  if (wind && sea) waves = `${sea} \u2022 wind ${wind}`
  else waves = sea || wind

  const comments = [values.comments, values.notes]
    .map(v => (v ? String(v).trim() : ''))
    .filter(Boolean)
    .join(' \u2014 ')

  return ENGINE_LOG_COLUMNS.map(({ key }) => {
    if (key === '__datetime') return datetime
    if (key === '__waves') return waves
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

    // 1) Reserve a new row by appending only column A.
    //    We then write the remaining columns in segments that skip the
    //    protected formula columns (H, T, U) so any sheet formula there
    //    is preserved.
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[row[0]]] },
    })

    const updatedRange = appendRes.data.updates?.updatedRange || ''
    const rowMatch = updatedRange.match(/!.*?(\d+)(?::|$)/)
    const rowNum = rowMatch ? parseInt(rowMatch[1], 10) : null
    if (!rowNum) {
      return res.status(500).json({
        error: 'Failed to determine appended row number',
        detail: `updatedRange=${updatedRange}`,
      })
    }

    // 2) Write per-cell ranges for the remaining columns (skipping A which
    //    we already appended). Columns flagged with `formula` get the
    //    formula string computed for this row number; everything else gets
    //    the value from buildRow(). Each column is sent as its own range so
    //    the formula columns reliably contain a formula even when adjacent
    //    value columns are blank.
    const data: { range: string; values: string[][] }[] = []
    ENGINE_LOG_COLUMNS.forEach((c, i) => {
      if (i === 0) return // column A already appended
      const v = c.formula ? c.formula(rowNum) : row[i]
      if (v === '' || v === undefined || v === null) {
        // skip empties for value cells, but ALWAYS write formulas
        if (!c.formula) return
      }
      data.push({
        range: `${SHEET_TAB}!${c.col}${rowNum}:${c.col}${rowNum}`,
        values: [[v]],
      })
    })

    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data },
      })
    }

    return res.status(200).json({ ok: true, tab: SHEET_TAB, row: rowNum, lastCol: LAST_COL })
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
