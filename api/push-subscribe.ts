// POST { name: string, subscription: PushSubscriptionJSON, action?: 'subscribe' | 'unsubscribe' }
// Stores a Web Push subscription in the Google Sheet so /api/watch-cron can dispatch to it.
// One row per (endpoint). If the same endpoint POSTs again, we update the crew name.

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
  // Confirm PushSubs sheet exists; create it with headers if not.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const has = (meta.data.sheets || []).some((s: any) => s.properties?.title === 'PushSubs')
  if (!has) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: INVENTORY_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'PushSubs' } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: 'PushSubs!A1:F1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Endpoint', 'Name', 'P256dh', 'Auth', 'CreatedAt', 'UpdatedAt']] },
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) return res.status(500).json({ error: 'INVENTORY_SPREADSHEET_ID not set' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const body = req.body as {
    name?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    action?: 'subscribe' | 'unsubscribe'
  }
  const name = (body?.name || '').trim()
  const sub = body?.subscription
  const action = body?.action || 'subscribe'
  if (!sub?.endpoint) return res.status(400).json({ error: 'subscription.endpoint required' })

  const sheets = getSheets()
  await ensureSheet(sheets)

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'PushSubs!A:F',
  })
  const rows = resp.data.values || []
  const dataRows = rows.slice(1)
  const idx = dataRows.findIndex(r => (r[0] || '') === sub.endpoint)
  const now = new Date().toISOString()

  if (action === 'unsubscribe') {
    if (idx >= 0) {
      // Delete the row via batchUpdate deleteDimension
      const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
      const s = (meta.data.sheets || []).find((s: any) => s.properties?.title === 'PushSubs')
      const sheetId = s?.properties?.sheetId
      if (sheetId != null) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: INVENTORY_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 },
              },
            }],
          },
        })
      }
    }
    return res.status(200).json({ ok: true, action: 'unsubscribe' })
  }

  if (!name) return res.status(400).json({ error: 'name required' })
  if (!sub.keys?.p256dh || !sub.keys?.auth) return res.status(400).json({ error: 'subscription.keys required' })

  const values = [sub.endpoint, name, sub.keys.p256dh, sub.keys.auth]
  if (idx >= 0) {
    const rowNum = idx + 2
    const existingCreated = dataRows[idx][4] || now
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `PushSubs!A${rowNum}:F${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[...values, existingCreated, now]] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: 'PushSubs!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[...values, now, now]] },
    })
  }

  return res.status(200).json({ ok: true, action: 'subscribe', name })
}
