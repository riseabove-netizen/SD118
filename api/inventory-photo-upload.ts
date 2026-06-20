import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { Readable } from 'stream'

export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
  maxDuration: 30,
}

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s.trim()
}

const FOLDER_ID = cleanEnv(process.env.INVENTORY_PHOTOS_FOLDER_ID)

function getAuth() {
  // Prefer OAuth user delegation when configured. Files land in the user's
  // own Drive, owned by them, on their quota. Service accounts cannot own
  // files in personal Drive (no storage quota), so OAuth is required for
  // personal Gmail / consumer Workspace accounts.
  const oauthClientId = cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_ID)
  const oauthClientSecret = cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
  const oauthRefreshToken = cleanEnv(process.env.GOOGLE_OAUTH_REFRESH_TOKEN)
  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const client = new google.auth.OAuth2(oauthClientId, oauthClientSecret)
    client.setCredentials({ refresh_token: oauthRefreshToken })
    return client
  }

  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

function detectImageMime(b64: string): 'image/jpeg' | 'image/png' {
  try {
    const head = atob(b64.slice(0, 16))
    if (head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8) return 'image/jpeg'
    if (head.charCodeAt(0) === 0x89 && head.charCodeAt(1) === 0x50) return 'image/png'
  } catch {}
  return 'image/jpeg'
}

function safeName(s: string): string {
  return (s || '').replace(/[^\w\-. ]+/g, '_').slice(0, 80)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!FOLDER_ID) {
    return res.status(500).json({
      error: 'Server not configured',
      detail: 'Missing env: INVENTORY_PHOTOS_FOLDER_ID',
    })
  }

  const body = req.body as {
    base64: string
    tab?: string
    itemId?: string
    label?: string
  }
  if (!body || !body.base64) {
    return res.status(400).json({ error: 'Invalid body — base64 image required' })
  }

  try {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })

    const mime = detectImageMime(body.base64)
    const ext = mime === 'image/png' ? 'png' : 'jpg'
    const tag = [body.tab, body.itemId, body.label].filter(Boolean).map(safeName).join(' - ')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${tag || 'inv-photo'}-${ts}.${ext}`

    const bytes = Buffer.from(body.base64, 'base64')
    const stream = Readable.from(bytes)

    const uploadResp = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: mime,
        body: stream,
      },
      fields: 'id, webViewLink, thumbnailLink',
      supportsAllDrives: true,
    })

    const fileId = uploadResp.data.id!
    // Make the file readable to anyone with link, so img tags can fetch
    // through Google's thumbnail/UC endpoints without auth.
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      })
    } catch (permErr: any) {
      // Non-fatal: file still uploaded; user can still open via Drive
      console.warn('inventory-photo-upload permission error:', permErr?.message)
    }

    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
    const viewUrl = uploadResp.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`

    return res.status(200).json({
      ok: true,
      fileId,
      thumbUrl,
      viewUrl,
      // Store this in the "Photo URL" sheet column
      photoUrl: thumbUrl,
    })
  } catch (error: any) {
    console.error('inventory-photo-upload error:', error)
    const detail =
      error?.errors?.[0]?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      String(error)
    return res.status(500).json({ error: 'Failed to upload photo', detail })
  }
}
