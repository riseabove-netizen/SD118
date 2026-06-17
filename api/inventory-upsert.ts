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

const SPARE_HEADERS = [
  'ID', 'Part Number', 'Description', 'Manufacturer', 'System', 'Qty',
  'Location', 'Sub-Location', 'Min Qty', 'Last Used', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]
const CONSUMABLE_HEADERS = [
  'ID', 'Item', 'Category', 'Location', 'Sub-Location', 'Qty', 'Unit',
  'Min Qty', 'Max Qty', 'Last Used', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]
const TOOL_HEADERS = [
  'ID', 'Name', 'Category', 'Brand', 'Model / Serial',
  'Location', 'Sub-Location', 'Condition', 'Last Checked', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]
const SUPPLY_HEADERS = [
  'ID', 'Item', 'Category', 'Brand', 'Location', 'Sub-Location', 'Qty', 'Unit',
  'Min Qty', 'Max Qty', 'Last Used', 'Notes', 'Photo URL',
  'Created At', 'Created By',
]
const TRANSACTION_HEADERS = [
  'Timestamp', 'Tab', 'Item ID', 'Item Name', 'Delta', 'Qty After',
  'Reason', 'User', 'Notes',
]

function headersFor(tab: string) {
  if (tab === 'Spares') return SPARE_HEADERS
  if (tab === 'Consumables') return CONSUMABLE_HEADERS
  if (tab === 'Tools') return TOOL_HEADERS
  if (tab === 'Supplies') return SUPPLY_HEADERS
  return null
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!INVENTORY_ID) {
    return res.status(500).json({
      error: 'Failed to save item',
      detail: 'INVENTORY_SPREADSHEET_ID env var is not set',
    })
  }

  const { tab, rowIndex, values, user, qtyDelta, reason } = (req.body || {}) as {
    tab?: string
    rowIndex?: number
    values?: Record<string, any>
    user?: string
    qtyDelta?: number
    reason?: string
  }

  const headers = tab ? headersFor(tab) : null
  if (!tab || !headers) return res.status(400).json({ error: 'Invalid tab' })
  if (!values || typeof values !== 'object') return res.status(400).json({ error: 'Missing values' })

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    const now = new Date().toISOString()
    const userName = user || 'unknown'

    let finalRowIndex = rowIndex
    let itemId = String(values.ID || '')
    let itemName = String(values['Item'] || values['Name'] || values['Part Number'] || values['Description'] || '')

    if (!rowIndex) {
      // CREATE new row
      if (!itemId) {
        itemId = newId()
        values.ID = itemId
      }
      values['Created At'] = now
      values['Created By'] = userName

      const row = headers.map(h => {
        const v = values[h]
        return v !== undefined && v !== null ? String(v) : ''
      })

      const appendResp = await sheets.spreadsheets.values.append({
        spreadsheetId: INVENTORY_ID,
        range: `${tab}!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      })

      // Parse updated range to extract the new row index, e.g. "Spares!A12:N12"
      const updatedRange = appendResp.data.updates?.updatedRange || ''
      const m = updatedRange.match(/!\D+(\d+):/)
      finalRowIndex = m ? parseInt(m[1], 10) : undefined
    } else {
      // UPDATE existing row
      // Read existing first to merge instead of overwriting empty fields
      const existingResp = await sheets.spreadsheets.values.get({
        spreadsheetId: INVENTORY_ID,
        range: `${tab}!A${rowIndex}:Z${rowIndex}`,
      })
      const existing = existingResp.data.values?.[0] || []
      const merged: Record<string, string> = {}
      headers.forEach((h, i) => {
        merged[h] = existing[i] !== undefined ? String(existing[i]) : ''
      })
      // Apply incoming values
      for (const k of Object.keys(values)) {
        if (values[k] !== undefined && values[k] !== null && values[k] !== '') {
          merged[k] = String(values[k])
        }
      }
      itemId = merged.ID
      itemName = merged['Item'] || merged['Name'] || merged['Part Number'] || merged['Description'] || ''

      const row = headers.map(h => merged[h] || '')

      await sheets.spreadsheets.values.update({
        spreadsheetId: INVENTORY_ID,
        range: `${tab}!A${rowIndex}:${String.fromCharCode(64 + headers.length)}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      })
    }

    // Log to Transactions if qtyDelta provided
    if (qtyDelta && qtyDelta !== 0) {
      const qtyAfter = values.Qty !== undefined ? String(values.Qty) : ''
      const txnRow = [now, tab, itemId, itemName, String(qtyDelta), qtyAfter, reason || '', userName, '']
      await sheets.spreadsheets.values.append({
        spreadsheetId: INVENTORY_ID,
        range: `Transactions!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [txnRow] },
      })
    }

    return res.status(200).json({ ok: true, rowIndex: finalRowIndex, id: itemId })
  } catch (error: any) {
    console.error('inventory-upsert error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to save item', detail })
  }
}

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }
// Reference transaction headers to avoid unused warning
void TRANSACTION_HEADERS