// Anchor watch cron dispatcher — runs on a Vercel Cron schedule (every 5 min).
// For any hour slot in the active watch's schedule that has arrived within the
// last 65 minutes and hasn't been notified yet, sends a Web Push to every
// subscription registered under the assigned crew name.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import webpush from 'web-push'

export const config = { maxDuration: 30 }

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

async function decodeActiveWatch(sheets: any): Promise<{ startedAt: string; locationName: string; closed: boolean } | null> {
  // Anchor watch is stored as a Guide with a fixed ID. Its markdown blob is
  // encoded JSON (see src/lib/guides.ts encoding). We only need a few fields
  // for the cron, so we do a targeted read of the latest version.
  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'Guides!A:H',
  })
  const rows = meta.data.values || []
  if (rows.length < 2) return null
  const headers = rows[0]
  const idIdx = headers.indexOf('ID')
  const verIdx = headers.indexOf('Current Version')
  const dataRow = rows.slice(1).find((r: any[]) => r[idIdx] === ANCHOR_WATCH_ACTIVE_ID)
  if (!dataRow) return null
  const currentVersion = dataRow[verIdx] || '1'

  const versions = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'GuideVersions!A:F',
  })
  const vRows = versions.data.values || []
  if (vRows.length < 2) return null
  const vHeaders = vRows[0]
  const vGuideIdx = vHeaders.indexOf('Guide ID')
  const vVerIdx = vHeaders.indexOf('Version')
  const vMdIdx = vHeaders.indexOf('Markdown')
  const version = vRows.slice(1).find((r: any[]) => r[vGuideIdx] === ANCHOR_WATCH_ACTIVE_ID && String(r[vVerIdx]) === String(currentVersion))
  if (!version) return null
  const markdown = version[vMdIdx] || ''

  // Extract the JSON envelope from the markdown blob. The client stores the
  // AnchorWatchData object as a fenced code block; we just parse the first
  // JSON we find.
  const match = markdown.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[0])
    return {
      startedAt: String(obj.startedAt || ''),
      locationName: String(obj.locationName || ''),
      closed: !!obj.closed,
    }
  } catch {
    return null
  }
}

interface Sub { endpoint: string; name: string; p256dh: string; auth: string }

async function loadSubsByName(sheets: any, name: string): Promise<Sub[]> {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'PushSubs!A:F',
  })
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
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'PushSubs!A:F',
  })
  const rows = resp.data.values || []
  const idx = rows.slice(1).findIndex((r: any[]) => (r[0] || '') === endpoint)
  if (idx < 0) return
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET (Vercel Cron / GitHub Actions) and POST (manual testing).
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' })

  // Auth: shared secret via ?key=... or Authorization: Bearer <secret>.
  // Also accept requests bearing Vercel's built-in cron header, in case we
  // ever move to Pro-tier Vercel Cron.
  const expectedSecret = cleanEnv(process.env.WATCH_CRON_SECRET)
  const authHeader = String(req.headers['authorization'] || '')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const queryKey = String(req.query.key || '')
  const isVercelCron = !!req.headers['x-vercel-cron']
  if (expectedSecret && !isVercelCron && bearer !== expectedSecret && queryKey !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (!INVENTORY_ID) return res.status(500).json({ error: 'INVENTORY_SPREADSHEET_ID not set' })
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID keys not set' })
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  const sheets = getSheets()
  const active = await decodeActiveWatch(sheets)
  if (!active || active.closed || !active.startedAt) {
    return res.status(200).json({ ok: true, skipped: 'no active watch' })
  }

  // Load the schedule.
  const schedResp = await sheets.spreadsheets.values.get({
    spreadsheetId: INVENTORY_ID,
    range: 'WatchSchedule!A:E',
  })
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
    // Fire once the slot's hour has arrived. Skip if it's more than 65 min
    // in the past (we missed the window — user probably closed the app).
    // Skip if already notified.
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
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, payload, { TTL: 60 * 60 })
        sent++
      } catch (e: any) {
        failed++
        // 404/410 = subscription gone; clean it up
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          try { await removeSub(sheets, sub.endpoint) } catch {}
        }
      }
    }

    notified[slotIso] = new Date().toISOString()
    results.push({ slot: slotIso, name, sent, failed })
  }

  if (results.length > 0) {
    // Persist updated notified map
    const rowNum = sIdx + 2
    const nowIso = new Date().toISOString()
    await sheets.spreadsheets.values.update({
      spreadsheetId: INVENTORY_ID,
      range: `WatchSchedule!A${rowNum}:E${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          active.startedAt,
          JSON.stringify(schedule),
          JSON.stringify(notified),
          nowIso,
          'cron',
        ]],
      },
    })
  }

  return res.status(200).json({ ok: true, active: active.startedAt, results })
}
