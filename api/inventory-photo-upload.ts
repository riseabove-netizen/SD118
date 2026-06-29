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

const PHOTOS_FOLDER_ID = cleanEnv(process.env.INVENTORY_PHOTOS_FOLDER_ID)
const ISM_FORMS_FOLDER_ID = cleanEnv(process.env.ISM_FORMS_FOLDER_ID)
const ISM_ANCHOR_WATCH_FOLDER_ID = cleanEnv(process.env.ISM_ANCHOR_WATCH_FOLDER_ID)
const ISM_DRILLS_FOLDER_ID = cleanEnv(process.env.ISM_DRILLS_FOLDER_ID)
const ISM_SAFETY_EQUIPMENT_FOLDER_ID = cleanEnv(process.env.ISM_SAFETY_EQUIPMENT_FOLDER_ID)
const ISM_OPERATING_EMERGENCY_FOLDER_ID = cleanEnv(process.env.ISM_OPERATING_EMERGENCY_FOLDER_ID)

function pickFolder(label: string | undefined, isPdf: boolean): { folderId: string | undefined; bucket: string } {
  // PDFs of known ISM forms route to their dedicated sub-folder.
  if (isPdf && label) {
    const l = label.toLowerCase()
    // Generic operating/emergency form PDFs (label = "IsmForm-<formId>")
    if (l.startsWith('ismform') && ISM_OPERATING_EMERGENCY_FOLDER_ID) return { folderId: ISM_OPERATING_EMERGENCY_FOLDER_ID, bucket: 'ism-operating-emergency' }
    if (l.includes('anchor') && ISM_ANCHOR_WATCH_FOLDER_ID) return { folderId: ISM_ANCHOR_WATCH_FOLDER_ID, bucket: 'ism-anchor-watch' }
    if ((l.includes('drill') || l.includes('drillreport')) && ISM_DRILLS_FOLDER_ID) return { folderId: ISM_DRILLS_FOLDER_ID, bucket: 'ism-drills' }
    if ((l.includes('safety') || l.includes('equipment')) && ISM_SAFETY_EQUIPMENT_FOLDER_ID) return { folderId: ISM_SAFETY_EQUIPMENT_FOLDER_ID, bucket: 'ism-safety-equipment' }
    // Unknown ISM PDF? Fall back to ISM parent if defined.
    if (ISM_FORMS_FOLDER_ID) return { folderId: ISM_FORMS_FOLDER_ID, bucket: 'ism-forms' }
  }
  return { folderId: PHOTOS_FOLDER_ID, bucket: 'inventory-photos' }
}

function getAuth() {
  // We now write into a Google Shared Drive that the service account is a member
  // of, so the service account is sufficient (shared drives don't require
  // personal storage quota the way My Drive does).
  //
  // Legacy OAuth user delegation (GOOGLE_OAUTH_*) is intentionally NOT used here
  // anymore — the refresh token had been revoked and re-minting required manual
  // browser auth. Shared drive + service account is more robust.
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

function detectMime(b64: string): { mime: string; ext: string; isPdf: boolean } {
  try {
    const head = atob(b64.slice(0, 16))
    if (head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8) return { mime: 'image/jpeg', ext: 'jpg', isPdf: false }
    if (head.charCodeAt(0) === 0x89 && head.charCodeAt(1) === 0x50) return { mime: 'image/png', ext: 'png', isPdf: false }
    // PDF magic: '%PDF'
    if (head.charCodeAt(0) === 0x25 && head.charCodeAt(1) === 0x50 && head.charCodeAt(2) === 0x44 && head.charCodeAt(3) === 0x46) {
      return { mime: 'application/pdf', ext: 'pdf', isPdf: true }
    }
  } catch {}
  return { mime: 'image/jpeg', ext: 'jpg', isPdf: false }
}

function safeName(s: string): string {
  return (s || '').replace(/[^\w\-. ]+/g, '_').slice(0, 80)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as {
    base64: string
    tab?: string
    itemId?: string
    label?: string
    mime?: string
    ext?: string
    filename?: string
  }
  if (!body || !body.base64) {
    return res.status(400).json({ error: 'Invalid body — base64 image required' })
  }

  try {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })

    const detected = detectMime(body.base64)
    const mime = body.mime || detected.mime
    const ext = body.ext || detected.ext
    const isPdf = mime === 'application/pdf' || ext === 'pdf' || detected.isPdf
    const { folderId, bucket } = pickFolder(body.label, isPdf)
    if (!folderId) {
      return res.status(500).json({
        error: 'Server not configured',
        detail: `Missing Drive folder env for bucket=${bucket}`,
      })
    }
    const tag = [body.tab, body.itemId, body.label]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map(safeName)
      .join(' - ')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = body.filename ? safeName(body.filename) : `${tag || 'inv-photo'}-${ts}.${ext}`

    const bytes = Buffer.from(body.base64, 'base64')
    const stream = Readable.from(bytes)

    const uploadResp = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
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
      bucket,
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
