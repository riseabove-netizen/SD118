// Upload a receipt image to Drive under Expenses/<Month>/<Account>/.
// Creates the folder tree on demand.
// Month name follows the receipt date if provided, otherwise today.
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
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}

const EXPENSES_ROOT_FOLDER_ID = cleanEnv(process.env.EXPENSES_ROOT_FOLDER_ID)
// Fall back to the same shared drive that hosts inventory photos, so we don't
// need a new env var just to bootstrap: we create/find an "Expenses" folder as a
// sibling of the inventory photos folder.
const INVENTORY_PHOTOS_FOLDER_ID = cleanEnv(process.env.INVENTORY_PHOTOS_FOLDER_ID)

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function detectMime(b64: string): { mime: string; ext: string } {
  try {
    const head = atob(b64.slice(0, 16))
    if (head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
    if (head.charCodeAt(0) === 0x89 && head.charCodeAt(1) === 0x50) return { mime: 'image/png', ext: 'png' }
    if (head.slice(0, 4) === '%PDF') return { mime: 'application/pdf', ext: 'pdf' }
  } catch {}
  return { mime: 'image/jpeg', ext: 'jpg' }
}

function safeName(s: string): string {
  return (s || '').replace(/[^\w\-. ]+/g, '_').slice(0, 80)
}

async function findOrCreateChildFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string,
): Promise<string> {
  const safeParent = parentId.replace(/'/g, "\\'")
  const safeChild = name.replace(/'/g, "\\'")
  const q = `'${safeParent}' in parents and name='${safeChild}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const list = await drive.files.list({
    q,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
    pageSize: 5,
  })
  const existing = list.data.files?.[0]?.id
  if (existing) return existing
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.data.id!
}

async function resolveRootFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
  if (EXPENSES_ROOT_FOLDER_ID) return EXPENSES_ROOT_FOLDER_ID
  if (!INVENTORY_PHOTOS_FOLDER_ID) {
    throw new Error('Neither EXPENSES_ROOT_FOLDER_ID nor INVENTORY_PHOTOS_FOLDER_ID is set on the server')
  }
  // Find the parent of the inventory photos folder → that's the Rise Above
  // shared drive root (or a boat-wide subfolder). Use it as a sibling parent
  // for the Expenses tree.
  const meta = await drive.files.get({
    fileId: INVENTORY_PHOTOS_FOLDER_ID,
    fields: 'parents',
    supportsAllDrives: true,
  })
  const parents = meta.data.parents
  if (!parents || parents.length === 0) {
    throw new Error('Could not resolve parent of INVENTORY_PHOTOS_FOLDER_ID; set EXPENSES_ROOT_FOLDER_ID explicitly')
  }
  return findOrCreateChildFolder(drive, parents[0], 'Expenses')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as {
    base64: string
    account?: 'Amex 3240' | 'Bilt' | string
    date?: string // YYYY-MM-DD (receipt date) — else today
    mime?: string
    ext?: string
    filename?: string
  }
  if (!body?.base64) return res.status(400).json({ error: 'Invalid body — base64 image required' })

  try {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })

    const detected = detectMime(body.base64)
    const mime = body.mime || detected.mime
    const ext = body.ext || detected.ext

    const account = body.account && body.account.trim() ? body.account.trim() : 'Uncategorised'
    const d = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? new Date(body.date + 'T00:00:00Z')
      : new Date()
    const monthLabel = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`

    // Expenses / <month> / <account>
    const expensesRoot = await resolveRootFolder(drive)
    const monthFolder = await findOrCreateChildFolder(drive, expensesRoot, monthLabel)
    const accountFolder = await findOrCreateChildFolder(drive, monthFolder, safeName(account))

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = body.filename
      ? safeName(body.filename)
      : `receipt-${ts}.${ext}`

    const bytes = Buffer.from(body.base64, 'base64')
    const stream = Readable.from(bytes)
    const uploadResp = await drive.files.create({
      requestBody: { name: fileName, parents: [accountFolder] },
      media: { mimeType: mime, body: stream },
      fields: 'id, webViewLink, thumbnailLink',
      supportsAllDrives: true,
    })
    const fileId = uploadResp.data.id!
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      })
    } catch (permErr: any) {
      console.warn('expense-drive-upload permission warn:', permErr?.message)
    }

    const viewUrl = uploadResp.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
    return res.status(200).json({ ok: true, fileId, viewUrl, thumbUrl, monthFolder, accountFolder, monthLabel })
  } catch (err: any) {
    console.error('expense-drive-upload error:', err)
    const detail = err?.errors?.[0]?.message || err?.response?.data?.error?.message || err?.message || String(err)
    return res.status(500).json({ error: 'Failed to upload receipt', detail })
  }
}
