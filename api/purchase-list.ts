// Purchase List API — lives inside the inventory spreadsheet as a
// dedicated `PurchaseList` sheet.
//
// Ops (dispatched via ?op= for GET, or body.op for POST):
//   GET  op=list             -> return every row (open + received). On the
//                               very first call, if the sheet is empty we
//                               seed it with items pulled out of the most
//                               recent MaintenanceLog events so the user
//                               always starts with something on the list.
//   POST op=add              -> body: { items: PurchaseItem[], addedBy?, sourceEventId? }
//                               dedupes on (Name + PartNumber) unless
//                               body.force === true.
//   POST op=remove           -> body: { ids: string[] }
//   POST op=move             -> body: { ids: string[], location: string,
//                                       subLocation?: string, notes?: string,
//                                       receivedBy?: string,
//                                       incrementStock?: boolean }
//                               marks rows Received and updates their
//                               StorageLocation / SubLocation. If
//                               incrementStock is set and the source row
//                               is known, also bump the underlying
//                               Spares/Consumables Qty.
//
// Sheet columns (auto-created on first use):
//   Id | AddedAt | AddedBy | Name | PartNumber | Qty
//   SourceTab | SourceRow | SourceEventId
//   Status | StorageLocation | SubLocation | ReceivedAt | ReceivedBy | Notes

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

const SHEET = 'PurchaseList'
const HEADERS = [
  'Id',
  'AddedAt',
  'AddedBy',
  'Name',
  'PartNumber',
  'Qty',
  'SourceTab',
  'SourceRow',
  'SourceEventId',
  'Status',
  'StorageLocation',
  'SubLocation',
  'ReceivedAt',
  'ReceivedBy',
  'Notes',
]

async function ensureSheet(sheets: any) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === SHEET)
  if (!found) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: INVENTORY_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    })
    return
  }
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${SHEET}!A1:Z1`,
  })
  if (!cur.data.values || cur.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    })
  }
}

async function readAll(sheets: any): Promise<any[]> {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `${SHEET}!A:Z`,
  })
  const rows = resp.data.values || []
  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map((row: any[], i: number) => {
    const obj: Record<string, any> = { rowIndex: i + 2 }
    headers.forEach((h: string, j: number) => {
      obj[h] = row[j] || ''
    })
    return obj
  })
}

function newId(): string {
  return 'PUR-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

function normKey(name: string, partNumber: string): string {
  return `${(name || '').toLowerCase().trim()}::${(partNumber || '').toLowerCase().trim()}`
}

// ---------------- seed helper ----------------

// If PurchaseList is empty, look at the last few MaintenanceLog rows and
// seed with any items that were used but never marked received.
async function seedFromMaintenance(sheets: any, addedBy: string): Promise<any[]> {
  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: INVENTORY_ID,
      range: 'MaintenanceLog!A:Z',
    })
    const rows = resp.data.values || []
    if (rows.length < 2) return []
    const headers = rows[0]
    const events = rows.slice(1).map((r: any[]) => {
      const obj: Record<string, any> = {}
      headers.forEach((h: string, i: number) => { obj[h] = r[i] || '' })
      return obj
    })
    // Take items from up to the last 3 events.
    const recent = events.slice(-3).reverse()
    const seen = new Set<string>()
    const seed: any[] = []
    for (const ev of recent) {
      let used: any[] = []
      try { used = JSON.parse(ev.InventoryUsedJson || '[]') } catch { used = [] }
      for (const it of used) {
        const key = normKey(it.name || '', it.partNumber || '')
        if (seen.has(key)) continue
        seen.add(key)
        seed.push([
          newId(),
          new Date().toISOString(),
          addedBy || 'seed',
          it.name || '',
          it.partNumber || '',
          String(it.qty ?? 1),
          '', // SourceTab
          '', // SourceRow
          ev.EventId || '',
          'open',
          '', '', '', '', // StorageLocation, SubLocation, ReceivedAt, ReceivedBy
          `Auto-seeded from ${ev.SystemLabel || ev.SystemId} on ${ev.Timestamp}`,
        ])
      }
    }
    if (seed.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: INVENTORY_ID,
        range: `${SHEET}!A:Z`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: seed },
      })
    }
    return seed
  } catch (e) {
    console.error('seedFromMaintenance error:', e)
    return []
  }
}

// ---------------- handler ----------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) {
    return res.status(500).json({ error: 'INVENTORY_SPREADSHEET_ID env var is not set' })
  }

  const op = String(
    req.method === 'GET'
      ? req.query.op || ''
      : (req.body && req.body.op) || req.query.op || ''
  )

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    await ensureSheet(sheets)

    if (op === 'list') {
      let items = await readAll(sheets)
      if (items.length === 0) {
        // Seed once from maintenance log (as a starter)
        await seedFromMaintenance(sheets, String(req.query.user || ''))
        items = await readAll(sheets)
      }
      return res.status(200).json({ items })
    }

    if (op === 'add') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const body: any = req.body || {}
      const incoming: any[] = Array.isArray(body.items) ? body.items : []
      if (incoming.length === 0) return res.status(400).json({ error: 'items[] required' })

      // Dedupe against open rows unless force=true
      const existing = await readAll(sheets)
      const openKeys = new Set(
        existing
          .filter(r => (r.Status || 'open') === 'open')
          .map(r => normKey(r.Name || '', r.PartNumber || ''))
      )

      const now = new Date().toISOString()
      const addedBy = body.addedBy || ''
      const eventId = body.sourceEventId || ''
      const toAppend: any[] = []
      const skipped: string[] = []
      for (const it of incoming) {
        const name = String(it.name || '').trim()
        const pn = String(it.partNumber || '').trim()
        if (!name) continue
        const key = normKey(name, pn)
        if (!body.force && openKeys.has(key)) {
          skipped.push(name)
          continue
        }
        openKeys.add(key)
        toAppend.push([
          newId(),
          now,
          addedBy,
          name,
          pn,
          String(it.qty ?? 1),
          String(it.sourceTab || ''),
          String(it.sourceRow || ''),
          eventId,
          'open',
          '', '', '', '', // storage / sub / received / by
          String(it.notes || ''),
        ])
      }
      if (toAppend.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: INVENTORY_ID,
          range: `${SHEET}!A:Z`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: toAppend },
        })
      }
      return res.status(200).json({ added: toAppend.length, skipped })
    }

    if (op === 'remove') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const body: any = req.body || {}
      const ids: string[] = Array.isArray(body.ids) ? body.ids : []
      if (ids.length === 0) return res.status(400).json({ error: 'ids[] required' })

      const rows = await readAll(sheets)
      const idSet = new Set(ids)
      const targets = rows.filter(r => idSet.has(r.Id))
      if (targets.length === 0) return res.status(200).json({ removed: 0 })

      // Get sheetId for batch delete rows
      const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
      const sheet = meta.data.sheets?.find((s: any) => s.properties?.title === SHEET)
      const sheetId = sheet?.properties?.sheetId

      // Delete from bottom-up so row indices remain valid.
      const requests = targets
        .map(r => r.rowIndex)
        .sort((a, b) => b - a)
        .map((rowIndex: number) => ({
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        }))
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: INVENTORY_ID,
        requestBody: { requests },
      })
      return res.status(200).json({ removed: requests.length })
    }

    if (op === 'move') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const body: any = req.body || {}
      const ids: string[] = Array.isArray(body.ids) ? body.ids : []
      if (ids.length === 0) return res.status(400).json({ error: 'ids[] required' })
      const location: string = String(body.location || '').trim()
      if (!location) return res.status(400).json({ error: 'location required' })
      const subLocation: string = String(body.subLocation || '').trim()
      const receivedBy: string = String(body.receivedBy || '').trim()
      const notes: string = String(body.notes || '').trim()
      const incrementStock: boolean = !!body.incrementStock

      const rows = await readAll(sheets)
      const idSet = new Set(ids)
      const targets = rows.filter(r => idSet.has(r.Id))
      if (targets.length === 0) return res.status(200).json({ moved: 0 })

      const now = new Date().toISOString()
      // Update each row's Status/StorageLocation/SubLocation/ReceivedAt/ReceivedBy/Notes.
      // Header order (A..O): Id AddedAt AddedBy Name PartNumber Qty SourceTab SourceRow SourceEventId Status StorageLocation SubLocation ReceivedAt ReceivedBy Notes
      const data = targets.map(r => {
        const combinedNotes = [r.Notes, notes].filter(Boolean).join(' | ')
        return {
          range: `${SHEET}!J${r.rowIndex}:O${r.rowIndex}`, // J..O = Status..Notes (10..15)
          values: [[
            'received',
            location,
            subLocation,
            now,
            receivedBy,
            combinedNotes,
          ]],
        }
      })
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: INVENTORY_ID,
        requestBody: { valueInputOption: 'RAW', data },
      })

      // Optionally bump underlying inventory Qty
      let stockBumped = 0
      if (incrementStock) {
        for (const r of targets) {
          if (!r.SourceTab || !r.SourceRow) continue
          const rowNum = parseInt(String(r.SourceRow), 10)
          if (!rowNum) continue
          try {
            // Read the current qty and header to find the Qty column.
            const head = await sheets.spreadsheets.values.get({
              spreadsheetId: INVENTORY_ID,
              range: `${r.SourceTab}!1:1`,
            })
            const cols: string[] = head.data.values?.[0] || []
            const qtyCol = cols.findIndex(h => h === 'Qty' || h === 'Quantity')
            if (qtyCol < 0) continue
            const colLetter = String.fromCharCode('A'.charCodeAt(0) + qtyCol)
            const cell = await sheets.spreadsheets.values.get({
              spreadsheetId: INVENTORY_ID,
              range: `${r.SourceTab}!${colLetter}${rowNum}`,
            })
            const cur = parseFloat(cell.data.values?.[0]?.[0] || '0') || 0
            const bump = parseFloat(r.Qty || '1') || 1
            await sheets.spreadsheets.values.update({
              spreadsheetId: INVENTORY_ID,
              range: `${r.SourceTab}!${colLetter}${rowNum}`,
              valueInputOption: 'RAW',
              requestBody: { values: [[String(cur + bump)]] },
            })
            stockBumped++
          } catch (e) {
            console.error('increment stock failed for', r.Id, e)
          }
        }
      }

      return res.status(200).json({ moved: targets.length, stockBumped })
    }

    return res.status(400).json({ error: 'Unknown op', op })
  } catch (error: any) {
    console.error('purchase-list error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'purchase-list failed', detail })
  }
}
