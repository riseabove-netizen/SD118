// Consolidated anchor-watch notification endpoint. Three ops in one function
// so we stay under the Vercel Hobby 12-function cap.
//
//   GET  /api/anchor-notify?op=schedule&startedAt=<iso>
//     -> { schedule, notified }
//   POST /api/anchor-notify?op=schedule
//     body { startedAt, schedule?, notified?, user? }
//   POST /api/anchor-notify?op=subscribe
//     body { name, subscription, action: 'subscribe' | 'unsubscribe' }
//   GET  /api/anchor-notify?op=users
//     -> { users: [<name>, ...] } — unique names enrolled for push.
//   GET|POST /api/anchor-notify?op=cron
//     Fires pending hourly pushes for the active watch. Requires
//     Authorization: Bearer <WATCH_CRON_SECRET> or ?key=<secret> unless the
//     request bears the x-vercel-cron header.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import webpush from 'web-push'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } }, maxDuration: 30 }

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}

const INVENTORY_ID = cleanEnv(process.env.INVENTORY_SPREADSHEET_ID)
const VAPID_PUBLIC = cleanEnv(process.env.VAPID_PUBLIC_KEY)
const VAPID_PRIVATE = cleanEnv(process.env.VAPID_PRIVATE_KEY)
const VAPID_SUBJECT = cleanEnv(process.env.VAPID_SUBJECT) || 'mailto:riseabove@crestorg.com'
const ANCHOR_WATCH_ACTIVE_ID = 'ANCHOR-WATCH-ACTIVE'

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

function parseJson(s: string | undefined) {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}

async function ensureSheet(sheets: any, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const has = (meta.data.sheets || []).some((s: any) => s.properties?.title === title)
  if (!has) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: INVENTORY_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    })
  }
}

// ---------- schedule ops ----------

async function handleScheduleGet(req: VercelRequest, res: VercelResponse) {
  const sheets = getSheets()
  await ensureSheet(sheets, 'WatchSchedule', ['WatchStartedAt', 'ScheduleJson', 'NotifiedJson', 'UpdatedAt', 'UpdatedBy'])
  const startedAt = String(req.query.startedAt || '').trim()
  if (!startedAt) return res.status(400).json({ error: 'startedAt required' })
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'WatchSchedule!A:E' })
  const rows = resp.data.values || []
  const idx = rows.slice(1).findIndex((r: any[]) => (r[0] || '') === startedAt)
  if (idx < 0) return res.status(200).json({ schedule: {}, notified: {} })
  const row = rows[idx + 1]
  return res.status(200).json({
    schedule: parseJson(row[1]),
    notified: parseJson(row[2]),
    updatedAt: row[3] || '',
    updatedBy: row[4] || '',
  })
}

async function handleSchedulePost(req: VercelRequest, res: VercelResponse) {
  const sheets = getSheets()
  await ensureSheet(sheets, 'WatchSchedule', ['WatchStartedAt', 'ScheduleJson', 'NotifiedJson', 'UpdatedAt', 'UpdatedBy'])
  const body = req.body as {
    startedAt?: string
    schedule?: Record<string, string>
    notified?: Record<string, string>
    user?: string
  }
  const startedAt = (body?.startedAt || '').trim()
  if (!startedAt) return res.status(400).json({ error: 'startedAt required' })
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'WatchSchedule!A:E' })
  const rows = resp.data.values || []
  const idx = rows.slice(1).findIndex((r: any[]) => (r[0] || '') === startedAt)
  const nowIso = new Date().toISOString()
  const user = (body.user || 'crew').trim()
  const existing = idx >= 0 ? rows[idx + 1] : null
  const merged = {
    schedule: body.schedule !== undefined ? body.schedule : parseJson(existing?.[1]),
    notified: body.notified !== undefined ? body.notified : parseJson(existing?.[2]),
  }
  const values = [startedAt, JSON.stringify(merged.schedule || {}), JSON.stringify(merged.notified || {}), nowIso, user]
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

// ---------- subscribe op ----------

async function handleSubscribe(req: VercelRequest, res: VercelResponse) {
  const sheets = getSheets()
  await ensureSheet(sheets, 'PushSubs', ['Endpoint', 'Name', 'P256dh', 'Auth', 'CreatedAt', 'UpdatedAt'])
  const body = req.body as {
    name?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    action?: 'subscribe' | 'unsubscribe'
  }
  const name = (body?.name || '').trim()
  const sub = body?.subscription
  const action = body?.action || 'subscribe'
  if (!sub?.endpoint) return res.status(400).json({ error: 'subscription.endpoint required' })

  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'PushSubs!A:F' })
  const rows = resp.data.values || []
  const dataRows = rows.slice(1)
  const idx = dataRows.findIndex((r: any[]) => (r[0] || '') === sub.endpoint)
  const now = new Date().toISOString()

  if (action === 'unsubscribe') {
    if (idx >= 0) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
      const s = (meta.data.sheets || []).find((s: any) => s.properties?.title === 'PushSubs')
      const sheetId = s?.properties?.sheetId
      if (sheetId != null) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: INVENTORY_ID,
          requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }] },
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

// ---------- cron op ----------

interface Sub { endpoint: string; name: string; p256dh: string; auth: string }

async function loadSubsByName(sheets: any, name: string): Promise<Sub[]> {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'PushSubs!A:F' })
  const rows = resp.data.values || []
  if (rows.length < 2) return []
  const normalized = name.trim().toLowerCase()
  return rows.slice(1)
    .filter((r: any[]) => (r[1] || '').trim().toLowerCase() === normalized)
    .map((r: any[]) => ({ endpoint: r[0], name: r[1], p256dh: r[2], auth: r[3] }))
}

async function removeSub(sheets: any, endpoint: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: INVENTORY_ID })
  const s = (meta.data.sheets || []).find((s: any) => s.properties?.title === 'PushSubs')
  const sheetId = s?.properties?.sheetId
  if (sheetId == null) return
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'PushSubs!A:F' })
  const rows = resp.data.values || []
  const idx = rows.slice(1).findIndex((r: any[]) => (r[0] || '') === endpoint)
  if (idx < 0) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: INVENTORY_ID,
    requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx + 1, endIndex: idx + 2 } } }] },
  })
}

async function decodeActiveWatch(sheets: any): Promise<{ startedAt: string; locationName: string; closed: boolean } | null> {
  const meta = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'Guides!A:H' })
  const rows = meta.data.values || []
  if (rows.length < 2) return null
  const headers = rows[0]
  const idIdx = headers.indexOf('ID')
  const verIdx = headers.indexOf('Current Version')
  const dataRow = rows.slice(1).find((r: any[]) => r[idIdx] === ANCHOR_WATCH_ACTIVE_ID)
  if (!dataRow) return null
  const currentVersion = dataRow[verIdx] || '1'

  const versions = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'GuideVersions!A:F' })
  const vRows = versions.data.values || []
  if (vRows.length < 2) return null
  const vHeaders = vRows[0]
  const vGuideIdx = vHeaders.indexOf('Guide ID')
  const vVerIdx = vHeaders.indexOf('Version')
  const vMdIdx = vHeaders.indexOf('Markdown')
  const version = vRows.slice(1).find((r: any[]) => r[vGuideIdx] === ANCHOR_WATCH_ACTIVE_ID && String(r[vVerIdx]) === String(currentVersion))
  if (!version) return null
  const markdown = version[vMdIdx] || ''
  const match = markdown.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[0])
    return {
      startedAt: String(obj.startedAt || ''),
      locationName: String(obj.locationName || ''),
      closed: !!obj.closed,
    }
  } catch { return null }
}

async function handleCron(req: VercelRequest, res: VercelResponse) {
  const expectedSecret = cleanEnv(process.env.WATCH_CRON_SECRET)
  const authHeader = String(req.headers['authorization'] || '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const queryKey = String(req.query.key || '')
  const isVercelCron = !!req.headers['x-vercel-cron']
  if (expectedSecret && !isVercelCron && bearer !== expectedSecret && queryKey !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID keys not set' })
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  const sheets = getSheets()
  const active = await decodeActiveWatch(sheets)
  if (!active || active.closed || !active.startedAt) {
    return res.status(200).json({ ok: true, skipped: 'no active watch' })
  }

  const schedResp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'WatchSchedule!A:E' })
  const sRows = schedResp.data.values || []
  const sIdx = sRows.slice(1).findIndex((r: any[]) => (r[0] || '') === active.startedAt)
  if (sIdx < 0) return res.status(200).json({ ok: true, skipped: 'no schedule for this watch' })
  const schedule: Record<string, string> = parseJson(sRows[sIdx + 1][1])
  const notified: Record<string, string> = parseJson(sRows[sIdx + 1][2])

  const nowMs = Date.now()
  const results: { slot: string; name: string; sent: number; failed: number }[] = []

  for (const [slotIso, name] of Object.entries(schedule)) {
    if (!name || !name.trim()) continue
    const slotMs = Date.parse(slotIso)
    if (!Number.isFinite(slotMs)) continue
    if (nowMs < slotMs) continue
    if (nowMs - slotMs > 65 * 60 * 1000) continue
    if (notified[slotIso]) continue

    const subs = await loadSubsByName(sheets, name)
    let sent = 0, failed = 0
    for (const sub of subs) {
      const payload = JSON.stringify({
        title: 'Anchor watch — your turn',
        body: `${name}, please sign the anchor watch log for ${active.locationName || 'anchor watch'}.`,
        url: '/ism/anchor-watch',
        tag: 'anchor-watch-hour',
        requireInteraction: true,
      })
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 60 * 60 })
        sent++
      } catch (e: any) {
        failed++
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          try { await removeSub(sheets, sub.endpoint) } catch {}
        }
      }
    }
    notified[slotIso] = new Date().toISOString()
    results.push({ slot: slotIso, name, sent, failed })
  }

  if (results.length > 0) {
    const rowNum = sIdx + 2
    const nowIso = new Date().toISOString()
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `WatchSchedule!A${rowNum}:E${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[active.startedAt, JSON.stringify(schedule), JSON.stringify(notified), nowIso, 'cron']] },
    })
  }

  return res.status(200).json({ ok: true, active: active.startedAt, results })
}

// ---------- users op ----------

async function handleUsers(_req: VercelRequest, res: VercelResponse) {
  const sheets = getSheets()
  await ensureSheet(sheets, 'PushSubs', ['Endpoint', 'Name', 'P256dh', 'Auth', 'CreatedAt', 'UpdatedAt'])
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'PushSubs!A:F' })
  const rows = resp.data.values || []
  const seen = new Set<string>()
  const users: string[] = []
  for (const r of rows.slice(1)) {
    const name = String(r[1] || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    users.push(name)
  }
  users.sort((a, b) => a.localeCompare(b))
  return res.status(200).json({ users })
}

// ---------- dispatcher ----------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!INVENTORY_ID) return res.status(500).json({ error: 'INVENTORY_SPREADSHEET_ID not set' })
  const op = String(req.query.op || '').trim()

  try {
    if (op === 'schedule') {
      if (req.method === 'GET') return await handleScheduleGet(req, res)
      if (req.method === 'POST') return await handleSchedulePost(req, res)
      return res.status(405).json({ error: 'GET or POST' })
    }
    if (op === 'subscribe') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      return await handleSubscribe(req, res)
    }
    if (op === 'users') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
      return await handleUsers(req, res)
    }
    if (op === 'cron') {
      if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' })
      return await handleCron(req, res)
    }
    return res.status(400).json({ error: 'op required: schedule | subscribe | cron' })
  } catch (e: any) {
    console.error('anchor-notify error', e)
    return res.status(500).json({ error: 'internal', detail: e?.message || String(e) })
  }
}
