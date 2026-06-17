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

const ALLOWED_TABS = new Set(['Spares', 'Consumables', 'Tools', 'Transactions'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!INVENTORY_ID) {
    return res.status(500).json({
      error: 'Failed to load inventory',
      detail: 'INVENTORY_SPREADSHEET_ID env var is not set',
    })
  }

  const tab = String(req.query.tab || '')
  if (!ALLOWED_TABS.has(tab)) {
    return res.status(400).json({ error: 'Invalid tab', detail: `tab must be one of ${[...ALLOWED_TABS].join(', ')}` })
  }

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTORY_ID,
      range: `${tab}!A:Z`,
    })

    const rows = resp.data.values || []
    if (rows.length < 2) {
      return res.status(200).json({ items: [] })
    }

    const headers = rows[0]
    const items = rows.slice(1).map((row, i) => {
      const obj: Record<string, any> = { rowIndex: i + 2 }
      headers.forEach((h, j) => {
        obj[h] = row[j] || ''
      })
      return obj
    })

    return res.status(200).json({ items })
  } catch (error: any) {
    console.error('inventory-list error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to load inventory', detail })
  }
}