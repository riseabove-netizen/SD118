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
import { readFileSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'

// ---------- auth helpers (inlined; must match api/trips.ts + api/auth.ts) ----------
const _HMAC_SECRET = process.env.HMAC_SECRET || process.env.APP_SECRET || 'fallback-secret'
function _hmac(payload: string): string {
  return crypto.createHmac('sha256', _HMAC_SECRET).update(payload).digest('hex')
}
function verifyToken(token: string | undefined | null): { ok: boolean; role?: 'admin' | 'viewer' | 'crew' } {
  if (!token || typeof token !== 'string') return { ok: false }
  const dot = token.indexOf('.')
  if (dot < 0) return { ok: false }
  const b64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let payload = ''
  try { payload = Buffer.from(b64, 'base64').toString('utf-8') } catch { return { ok: false } }
  const expected = _hmac(payload)
  if (sig.length !== expected.length) return { ok: false }
  try {
    const sigBuf = new Uint8Array(Buffer.from(sig, 'hex'))
    const expBuf = new Uint8Array(Buffer.from(expected, 'hex'))
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return { ok: false }
  } catch { return { ok: false } }
  const parts = payload.split(':')
  if (parts.length < 3 || parts[0] !== 'auth') return { ok: false }
  const role = parts[1]
  if (role === 'admin' || role === 'viewer' || role === 'crew') return { ok: true, role }
  return { ok: false }
}
function getBearer(req: VercelRequest): string | null {
  const h = req.headers['authorization'] || req.headers['Authorization' as any]
  if (!h || typeof h !== 'string') return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

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

// ---------- broadcast core (shared by immediate broadcast + scheduled delivery) ----------
type BroadcastInput = {
  title: string
  body: string
  url?: string
  tag?: string
  recipients?: string[]
  from?: string
}

type BroadcastResult = {
  ok: boolean
  matched: number
  sent: number
  failed: number
  perName: Record<string, { sent: number; failed: number }>
  note?: string
}

async function sendBroadcastCore(input: BroadcastInput): Promise<BroadcastResult> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) throw new Error('VAPID keys not configured')
  const title = (input.title || '').trim()
  const message = (input.body || '').trim()
  if (!title) throw new Error('title required')
  if (!message) throw new Error('body required')

  const rawRecipients = Array.isArray(input.recipients) ? input.recipients : []
  const wantAll = rawRecipients.length === 0 || rawRecipients.includes('*')
  const wanted = new Set(rawRecipients.map(r => (r || '').trim().toLowerCase()).filter(Boolean))

  const sheets = getSheets()
  await ensureSheet(sheets, 'PushSubs', ['Endpoint', 'Name', 'P256dh', 'Auth', 'CreatedAt', 'UpdatedAt'])
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: INVENTORY_ID, range: 'PushSubs!A:F' })
  const rows = (resp.data.values || []).slice(1)
  const subs = rows
    .map((r: any[]) => ({ endpoint: r[0] || '', name: (r[1] || '').trim(), p256dh: r[2] || '', auth: r[3] || '' }))
    .filter(s => s.endpoint && s.p256dh && s.auth)
    .filter(s => wantAll || wanted.has(s.name.toLowerCase()))

  if (subs.length === 0) {
    return { ok: true, sent: 0, failed: 0, matched: 0, perName: {}, note: 'no matching subscriptions' }
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  const url = (input.url || '/schedule').trim()
  const tag = (input.tag || 'admin-broadcast').trim()
  const payload = JSON.stringify({ title, body: message, url, tag, requireInteraction: false })

  let sent = 0, failed = 0
  const perName: Record<string, { sent: number; failed: number }> = {}
  for (const sub of subs) {
    const bucket = perName[sub.name] || (perName[sub.name] = { sent: 0, failed: 0 })
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24 },
      )
      sent++
      bucket.sent++
    } catch (e: any) {
      failed++
      bucket.failed++
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        try { await removeSub(sheets, sub.endpoint) } catch {}
      }
    }
  }

  // Audit log
  try {
    await ensureSheet(sheets, 'BroadcastLog', ['SentAt', 'From', 'Title', 'Body', 'Url', 'Recipients', 'Matched', 'Sent', 'Failed'])
    const recipientsStr = wantAll ? '*' : rawRecipients.join(', ')
    await sheets.spreadsheets.values.append({
      spreadsheetId: INVENTORY_ID,
      range: 'BroadcastLog!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toISOString(),
          (input.from || 'admin').slice(0, 60),
          title.slice(0, 200),
          message.slice(0, 1000),
          url,
          recipientsStr,
          String(subs.length),
          String(sent),
          String(failed),
        ]],
      },
    })
  } catch (e) {
    console.error('BroadcastLog append failed', e)
  }

  return { ok: true, matched: subs.length, sent, failed, perName }
}

// ---------- broadcast op (ADMIN ONLY) ----------
// POST /api/anchor-notify?op=broadcast
//   Authorization: Bearer <admin-token>
//   body: { title, body, url?, tag?, recipients: string[] }
async function handleBroadcast(req: VercelRequest, res: VercelResponse) {
  const auth = verifyToken(getBearer(req))
  if (!auth.ok || auth.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  try {
    const result = await sendBroadcastCore((req.body || {}) as BroadcastInput)
    return res.status(200).json(result)
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'send failed' })
  }
}

// ---------- scheduled broadcasts ----------
//
// Storage: ScheduledBroadcasts tab in the inventory spreadsheet.
// Columns: Id, CreatedAt, CreatedBy, ScheduledAtUtc, Title, Body, Url, Tag,
//          RecipientsJson, Status(scheduled|sent|cancelled|failed),
//          DeliveredAt, DeliverySummaryJson
const SCHEDULED_HEADERS = [
  'Id', 'CreatedAt', 'CreatedBy', 'ScheduledAtUtc', 'Title', 'Body', 'Url', 'Tag',
  'RecipientsJson', 'Status', 'DeliveredAt', 'DeliverySummaryJson',
]

type ScheduledRow = {
  id: string
  createdAt: string
  createdBy: string
  scheduledAtUtc: string
  title: string
  body: string
  url: string
  tag: string
  recipients: string[]
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed'
  deliveredAt: string
  deliverySummary: any
  rowNum: number
}

function rowToScheduled(r: any[], rowNum: number): ScheduledRow {
  let recipients: string[] = []
  try { const parsed = JSON.parse(r[8] || '[]'); if (Array.isArray(parsed)) recipients = parsed } catch {}
  let deliverySummary: any = null
  try { deliverySummary = r[11] ? JSON.parse(r[11]) : null } catch {}
  return {
    id: r[0] || '',
    createdAt: r[1] || '',
    createdBy: r[2] || '',
    scheduledAtUtc: r[3] || '',
    title: r[4] || '',
    body: r[5] || '',
    url: r[6] || '',
    tag: r[7] || '',
    recipients,
    status: (r[9] || 'scheduled') as ScheduledRow['status'],
    deliveredAt: r[10] || '',
    deliverySummary,
    rowNum,
  }
}

async function loadScheduled(sheets: any): Promise<ScheduledRow[]> {
  await ensureSheet(sheets, 'ScheduledBroadcasts', SCHEDULED_HEADERS)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'ScheduledBroadcasts!A:L',
  })
  const rows = (resp.data.values || []).slice(1)
  return rows.map((r: any[], i: number) => rowToScheduled(r, i + 2))
}

async function updateScheduledRow(sheets: any, rowNum: number, patch: Partial<Pick<ScheduledRow, 'status'|'deliveredAt'|'deliverySummary'>>) {
  // Fetch the row, patch specific columns, write back
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: `ScheduledBroadcasts!A${rowNum}:L${rowNum}`,
  })
  const row = (resp.data.values || [[]])[0] || []
  if (patch.status !== undefined) row[9] = patch.status
  if (patch.deliveredAt !== undefined) row[10] = patch.deliveredAt
  if (patch.deliverySummary !== undefined) row[11] = JSON.stringify(patch.deliverySummary)
  // Ensure length 12
  while (row.length < 12) row.push('')
  await sheets.spreadsheets.values.update({
    spreadsheetId: INVENTORY_ID,
    range: `ScheduledBroadcasts!A${rowNum}:L${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
}

// POST /api/anchor-notify?op=schedule-broadcast
// body: { title, body, url?, tag?, recipients?: string[], scheduledAt: ISO, from?: string }
async function handleScheduleBroadcast(req: VercelRequest, res: VercelResponse) {
  const auth = verifyToken(getBearer(req))
  if (!auth.ok || auth.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  const body = (req.body || {}) as any
  const title = String(body.title || '').trim()
  const message = String(body.body || '').trim()
  const scheduledAt = String(body.scheduledAt || '').trim()
  if (!title) return res.status(400).json({ error: 'title required' })
  if (!message) return res.status(400).json({ error: 'body required' })
  if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required' })
  const t = new Date(scheduledAt)
  if (Number.isNaN(t.getTime())) return res.status(400).json({ error: 'scheduledAt must be ISO' })
  if (t.getTime() < Date.now() - 60_000) return res.status(400).json({ error: 'scheduledAt must be in the future' })

  const sheets = getSheets()
  await ensureSheet(sheets, 'ScheduledBroadcasts', SCHEDULED_HEADERS)
  const id = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const recipients = Array.isArray(body.recipients) ? body.recipients : []
  await sheets.spreadsheets.values.append({
    spreadsheetId: INVENTORY_ID,
    range: 'ScheduledBroadcasts!A:L',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        id,
        new Date().toISOString(),
        String(body.from || 'admin').slice(0, 60),
        t.toISOString(),
        title.slice(0, 200),
        message.slice(0, 1000),
        String(body.url || '/schedule').slice(0, 500),
        String(body.tag || `scheduled-${id}`).slice(0, 100),
        JSON.stringify(recipients),
        'scheduled',
        '', // DeliveredAt
        '', // DeliverySummaryJson
      ]],
    },
  })
  return res.status(200).json({ ok: true, id, scheduledAtUtc: t.toISOString() })
}

// GET /api/anchor-notify?op=list-scheduled
// Returns all scheduled broadcasts, newest first. Admin only.
async function handleListScheduled(req: VercelRequest, res: VercelResponse) {
  const auth = verifyToken(getBearer(req))
  if (!auth.ok || auth.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  const sheets = getSheets()
  const items = await loadScheduled(sheets)
  // Sort: pending future first (soonest), then sent/cancelled newest first
  items.sort((a, b) => {
    const aPending = a.status === 'scheduled'
    const bPending = b.status === 'scheduled'
    if (aPending !== bPending) return aPending ? -1 : 1
    if (aPending) return a.scheduledAtUtc.localeCompare(b.scheduledAtUtc)
    return (b.deliveredAt || b.createdAt).localeCompare(a.deliveredAt || a.createdAt)
  })
  return res.status(200).json({ ok: true, items })
}

// POST /api/anchor-notify?op=cancel-scheduled
// body: { id }
async function handleCancelScheduled(req: VercelRequest, res: VercelResponse) {
  const auth = verifyToken(getBearer(req))
  if (!auth.ok || auth.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  const id = String((req.body || {}).id || '').trim()
  if (!id) return res.status(400).json({ error: 'id required' })
  const sheets = getSheets()
  const items = await loadScheduled(sheets)
  const target = items.find(i => i.id === id)
  if (!target) return res.status(404).json({ error: 'not found' })
  if (target.status !== 'scheduled') return res.status(400).json({ error: `cannot cancel status=${target.status}` })
  await updateScheduledRow(sheets, target.rowNum, { status: 'cancelled' })
  return res.status(200).json({ ok: true })
}

// POST /api/anchor-notify?op=deliver-scheduled
// Delivery worker — secured by WATCH_CRON_SECRET (?key= or Bearer).
// Delivers every 'scheduled' row whose scheduledAtUtc <= now.
async function handleDeliverScheduled(req: VercelRequest, res: VercelResponse) {
  // Accept either the Vercel Cron infra (x-vercel-cron header) or an
  // external caller with the WATCH_CRON_SECRET via ?key= or Bearer.
  const expectedSecret = cleanEnv(process.env.WATCH_CRON_SECRET)
  const provided = String(req.query.key || '').trim() || getBearer(req) || ''
  const isVercelCron = !!req.headers['x-vercel-cron']
  if (expectedSecret && !isVercelCron && provided !== expectedSecret) {
    return res.status(403).json({ error: 'forbidden' })
  }
  const sheets = getSheets()
  const items = await loadScheduled(sheets)
  const now = Date.now()
  const due = items.filter(i => i.status === 'scheduled' && new Date(i.scheduledAtUtc).getTime() <= now)
  const results: any[] = []
  for (const item of due) {
    try {
      const summary = await sendBroadcastCore({
        title: item.title,
        body: item.body,
        url: item.url,
        tag: item.tag,
        recipients: item.recipients,
        from: item.createdBy,
      })
      await updateScheduledRow(sheets, item.rowNum, {
        status: 'sent',
        deliveredAt: new Date().toISOString(),
        deliverySummary: summary,
      })
      results.push({ id: item.id, ok: true, sent: summary.sent, failed: summary.failed })
    } catch (e: any) {
      await updateScheduledRow(sheets, item.rowNum, {
        status: 'failed',
        deliveredAt: new Date().toISOString(),
        deliverySummary: { error: e?.message || String(e) },
      })
      results.push({ id: item.id, ok: false, error: e?.message || String(e) })
    }
  }
  return res.status(200).json({ ok: true, delivered: results.length, results })
}

// POST /api/anchor-notify?op=prefill-tomorrow
// Returns a suggested {title, body, url} using tomorrow's TripDay from src/data/trips.ts
// Query: ?tz=Europe/Rome  (defaults to Europe/Rome so timezone is stable regardless of server location)
async function handlePrefillTomorrow(req: VercelRequest, res: VercelResponse) {
  const auth = verifyToken(getBearer(req))
  if (!auth.ok || auth.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  const tz = String(req.query.tz || 'Europe/Rome').trim() || 'Europe/Rome'
  const now = new Date()
  // Compute tomorrow's YYYY-MM-DD in the given tz.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const isoDate = fmt.format(tomorrow) // YYYY-MM-DD

  // Trip data is generated at build time from src/data/trips.ts into
  // ./_trips-data.json. Load it from the lambda's on-disk sibling.
  let ALL_TRIPS: any[] = []
  try {
    // process.cwd() in Vercel is typically /var/task, and api files live at /var/task/api/...
    const candidates = [
      join(process.cwd(), 'api', '_trips-data.json'),
      join(process.cwd(), '_trips-data.json'),
    ]
    let loaded = false
    for (const p of candidates) {
      try {
        ALL_TRIPS = JSON.parse(readFileSync(p, 'utf8'))
        loaded = true
        break
      } catch {}
    }
    if (!loaded) throw new Error('_trips-data.json not found in ' + candidates.join(', '))
  } catch (e: any) {
    return res.status(500).json({ error: 'trip data unavailable', detail: e?.message || String(e) })
  }
  let match: { tripId: string; tripName: string; day: any } | null = null
  for (const trip of ALL_TRIPS) {
    const day = trip.days.find((d: any) => d.isoDate === isoDate)
    if (day) { match = { tripId: trip.id, tripName: trip.name, day }; break }
  }

  if (!match) {
    return res.status(200).json({
      ok: true,
      found: false,
      isoDate,
      title: `Tomorrow · ${isoDate}`,
      body: `No planned schedule for ${isoDate}. Draft the update below.`,
      url: '/schedule',
    })
  }

  const d = match.day
  const lines: string[] = []
  for (const ev of (d.events || [])) {
    const t = (ev.time || '').trim()
    const title = String(ev.title || '').trim()
    if (!title) continue
    lines.push(t ? `${t} · ${title}` : title)
  }
  const summary = lines.slice(0, 8).join('\n')
  const url = `/schedule/${match.tripId}#day-${isoDate}`
  const titleOut = `Tomorrow · ${d.title || d.date || isoDate}`.slice(0, 120)
  const bodyOut = (summary ? summary + '\n\n' : '') + 'Tap to open tomorrow\u2019s schedule.'

  return res.status(200).json({
    ok: true,
    found: true,
    isoDate,
    tripId: match.tripId,
    tripName: match.tripName,
    dayTitle: d.title || d.date || '',
    dayContext: summary,
    title: titleOut,
    body: bodyOut.slice(0, 500),
    url,
  })
}

// POST /api/anchor-notify?op=ai-prefill
// body: { prompt: string, dayIso?: 'YYYY-MM-DD', tripId?: string, dayContext?: string }
// Returns: { ok, title, body, url }
async function handleAiPrefill(req: VercelRequest, res: VercelResponse) {
  const auth = verifyToken(getBearer(req))
  if (!auth.ok || auth.role !== 'admin') return res.status(403).json({ error: 'admin only' })
  const apiKey = cleanEnv(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
  const body = (req.body || {}) as any
  const prompt = String(body.prompt || '').trim()
  const dayContext = String(body.dayContext || '').trim()
  const dayIso = String(body.dayIso || '').trim()
  const tripId = String(body.tripId || '').trim()

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const model = cleanEnv(process.env.ANTHROPIC_MODEL) || 'claude-sonnet-4-6'

  const systemPrompt = `You draft push notifications for M/Y Rise Above crew and guests. Return STRICT JSON with three keys: title (max 90 chars), body (max 450 chars, plain text, use bullets with time-first pattern like "10:00 · Leave dock"), url (a path in the app such as /schedule, /schedule/<trip-id>#day-YYYY-MM-DD, /menu, /watch). No prose, no code fences — JSON only.`

  const userPrompt = [
    prompt ? `Admin instruction: ${prompt}` : '',
    dayContext ? `Reference day context:\n${dayContext}` : '',
    dayIso ? `Target day: ${dayIso}` : '',
    tripId ? `Suggested URL: /schedule/${tripId}${dayIso ? `#day-${dayIso}` : ''}` : '',
  ].filter(Boolean).join('\n\n')

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt || 'Draft a schedule update.' }],
    })
    const text = (resp.content || []).map((b: any) => b.type === 'text' ? b.text : '').join('').trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return res.status(200).json({ ok: false, error: 'no JSON in response', raw: text.slice(0, 1000) })
    const parsed = JSON.parse(jsonMatch[0])
    return res.status(200).json({
      ok: true,
      title: String(parsed.title || '').slice(0, 120),
      body: String(parsed.body || '').slice(0, 500),
      url: String(parsed.url || '/schedule').slice(0, 500),
    })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'AI request failed' })
  }
}

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
    if (op === 'broadcast') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      return await handleBroadcast(req, res)
    }
    if (op === 'schedule-broadcast') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      return await handleScheduleBroadcast(req, res)
    }
    if (op === 'list-scheduled') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
      return await handleListScheduled(req, res)
    }
    if (op === 'cancel-scheduled') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      return await handleCancelScheduled(req, res)
    }
    if (op === 'deliver-scheduled') {
      if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' })
      return await handleDeliverScheduled(req, res)
    }
    if (op === 'prefill-tomorrow') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
      return await handlePrefillTomorrow(req, res)
    }
    if (op === 'ai-prefill') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      return await handleAiPrefill(req, res)
    }
    return res.status(400).json({ error: 'op required: schedule | subscribe | users | cron | broadcast | schedule-broadcast | list-scheduled | cancel-scheduled | deliver-scheduled | prefill-tomorrow | ai-prefill' })
  } catch (e: any) {
    console.error('anchor-notify error', e)
    return res.status(500).json({ error: 'internal', detail: e?.message || String(e) })
  }
}
