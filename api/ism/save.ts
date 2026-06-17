import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { randomUUID } from 'crypto'

const SHEET_ID = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID
const ISM_TAB = 'ISM_Log'

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (keyJson) {
    const key = JSON.parse(keyJson)
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function ensureIsmTab(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const tabs = meta.data.sheets || []
    const exists = tabs.some(s => s.properties?.title === ISM_TAB)
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: ISM_TAB },
              },
            },
          ],
        },
      })
      // Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${ISM_TAB}!A1:F1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Timestamp', 'Form Name', 'Form Type', 'Signer', 'Vessel', 'Fields_JSON']],
        },
      })
    }
  } catch (err) {
    console.error('ensureIsmTab error:', err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { formId, formName, formType, submittedAt, signerName, fields } = req.body as {
    formId?: string
    formName?: string
    formType?: string
    submittedAt?: string
    signerName?: string
    fields?: Record<string, unknown>
  }

  if (!formId || !formName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const id = randomUUID()

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    await ensureIsmTab(sheets, SHEET_ID!)

    const row = [
      submittedAt || new Date().toISOString(),
      formName,
      formType || '',
      signerName || '',
      'Rise Above',
      JSON.stringify(fields || {}),
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID!,
      range: `${ISM_TAB}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    })

    return res.status(200).json({ ok: true, id })
  } catch (error) {
    console.error('ISM save error:', error)
    return res.status(500).json({ error: 'Failed to save ISM form', details: String(error) })
  }
}