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

// Same running-log spreadsheet used by /api/write-row
const SHEET_ID = cleanEnv(process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID)
const TAB = 'RPM Averages'

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (keyJson) {
    const key = JSON.parse(keyJson)
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

// Parse a value like "80°C", "424 kPa", "43.0 L/hr", "13.0 kt", "" -> number|null
function num(cell: unknown): number | null {
  if (cell == null) return null
  const s = String(cell).trim()
  if (!s || s.startsWith('#')) return null
  const m = s.match(/-?\d+(?:[.,]\d+)?/)
  if (!m) return null
  return parseFloat(m[0].replace(',', '.'))
}

// Column layout on the sheet (0-indexed):
// A(0) RPM band | B(1) SOG avg | C(2) Economy L/NM
// Fuel Rate:   D(3) port avg, E(4) port σ, F(5) stbd avg, G(6) stbd σ
// Coolant T:   H(7) port avg, I(8) port σ, J(9) stbd avg, K(10) stbd σ
// Trans Oil T: L(11) port avg, M(12) port σ, N(13) stbd avg, O(14) stbd σ
// Eng Oil P:   P(15) port avg, Q(16) port σ, R(17) stbd avg, S(18) stbd σ
// Eng Oil T:   T(19) port avg, U(20) port σ, V(21) stbd avg, W(22) stbd σ
// Trans Oil P: X(23) port avg, Y(24) port σ, Z(25) stbd avg   (σ col off end for STBD sometimes)
type Band = {
  rpm: number
  sog: number | null
  economy: number | null
  port: Record<string, { avg: number | null; sigma: number | null }>
  stbd: Record<string, { avg: number | null; sigma: number | null }>
}

const FIELDS: { key: string; portAvg: number; portSig: number; stbdAvg: number; stbdSig: number }[] = [
  { key: 'fuel_rate',       portAvg: 3,  portSig: 4,  stbdAvg: 5,  stbdSig: 6 },
  { key: 'coolant_temp',    portAvg: 7,  portSig: 8,  stbdAvg: 9,  stbdSig: 10 },
  { key: 'trans_oil_temp',  portAvg: 11, portSig: 12, stbdAvg: 13, stbdSig: 14 },
  { key: 'oil_press',       portAvg: 15, portSig: 16, stbdAvg: 17, stbdSig: 18 },
  { key: 'oil_temp',        portAvg: 19, portSig: 20, stbdAvg: 21, stbdSig: 22 },
  { key: 'trans_oil_press', portAvg: 23, portSig: 24, stbdAvg: 25, stbdSig: 26 },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!SHEET_ID) {
    return res.status(500).json({ error: 'Server not configured', detail: 'SPREADSHEET_ID not set' })
  }
  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1:AA200`,
    })
    const rows = (r.data.values || []) as unknown[][]
    const bands: Band[] = []
    // First 3 rows are headers; data starts row index 3.
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i] || []
      const rpmCell = row[0]
      const rpm = num(rpmCell)
      if (rpm == null) continue
      const b: Band = {
        rpm,
        sog: num(row[1]),
        economy: num(row[2]),
        port: {},
        stbd: {},
      }
      for (const f of FIELDS) {
        b.port[f.key] = { avg: num(row[f.portAvg]), sigma: num(row[f.portSig]) }
        b.stbd[f.key] = { avg: num(row[f.stbdAvg]), sigma: num(row[f.stbdSig]) }
      }
      bands.push(b)
    }
    return res.status(200).json({ ok: true, bands })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: 'Failed to load RPM averages', detail: msg })
  }
}
