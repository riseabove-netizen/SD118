// Append one or more expense rows to the SD118 Expenses spreadsheet while
// preserving per-row data validation. For each new row we:
//   1) Reserve the row by appending column A (the date).
//   2) Read the previous row's validation on D/E to figure out the current
//      Dropdown offset (rows 2-288 use offset 0; rows 289+ use offset 1;
//      any future shift is picked up automatically).
//   3) Fill columns A-O for the new row.
//   4) Write the transpose(unique(FILTER(...))) formulas into Dropdown1 and
//      Dropdown2 on the mapped row, mirroring existing behaviour.
//   5) Set data validation on D and E of the new row so the dropdowns stay
//      strict + custom UI, exactly like every other row.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export const config = { maxDuration: 45 }

const SPREADSHEET_ID = '1XBBy8ma5WmQNW2ix-K6JyBaJB7kvnXQoExGttcSu_Wk'
const EXPENSES_SHEET_TITLE = 'Expenses'
const EXPENSES_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=734695797`

function cleanEnv(v: string | undefined): string | undefined {
  if (!v) return v
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s.trim()
}

function getAuth() {
  const keyJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export type SubmitExpense = {
  date: string                 // YYYY-MM-DD
  account: 'Amex 3240' | 'Bilt' | string
  project: string              // e.g. "Operating"
  expenseType: string          // Category (col D). E.g. "Guest trip"
  category: string             // Subcategory (col E). E.g. "Provisions / Guest meals"
  guestTrip?: string           // Col F — free text (guest trip name / empty)
  store?: string               // Col G — merchant
  usd?: number | null          // Col H
  eur?: number | null          // Col I
  refunded?: string            // Col J
  description?: string         // Col K
  specificRepair?: string      // Col L
  statement?: string           // Col M
  inputBy: string              // Col N — crew name
  receiptUrl?: string          // Col O — Drive link
  crosscheck?: string          // Col S — Plaid crosscheck ('matched:<plaid_txn_id>' | 'no plaid match' | '')
}

function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function ymdToSheetDate(ymd: string): string {
  // Sheets is happy with 2026/08/19 or 2026-08-19; the existing data uses YYYY/MM/DD.
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[1]}/${m[2]}/${m[3]}` : ymd
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const body = req.body as { expenses: SubmitExpense[] }
  const items = body?.expenses
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'expenses[] required' })
  }
  if (items.length > 25) return res.status(400).json({ error: 'Max 25 expenses per submit' })

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Resolve the Expenses sheetId (needed for setDataValidation)
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets(properties(sheetId,title))',
    })
    const expensesSheet = meta.data.sheets?.find(s => s.properties?.title === EXPENSES_SHEET_TITLE)
    const expensesSheetId = expensesSheet?.properties?.sheetId
    if (typeof expensesSheetId !== 'number') throw new Error('Could not resolve Expenses sheetId')

    const inserted: Array<{ row: number; receiptUrl?: string }> = []
    const errors: Array<{ index: number; error: string }> = []

    for (let idx = 0; idx < items.length; idx++) {
      const ex = items[idx]
      try {
        // 1) Reserve row by appending column A only.
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${EXPENSES_SHEET_TITLE}!A:A`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [[ymdToSheetDate(ex.date)]] },
        })
        const updatedRange = appendRes.data.updates?.updatedRange || ''
        // updatedRange like "Expenses!A441"
        const m = updatedRange.match(/!A(\d+)/)
        if (!m) throw new Error(`Failed to parse appended row: ${updatedRange}`)
        const rowNum = parseInt(m[1], 10)

        // 2) Discover Dropdown offset by reading the previous row's validation.
        const prevRow = rowNum - 1
        let dropdownRow = rowNum // default: same-index mapping
        if (prevRow >= 2) {
          try {
            const prevMeta = await sheets.spreadsheets.get({
              spreadsheetId: SPREADSHEET_ID,
              ranges: [`${EXPENSES_SHEET_TITLE}!D${prevRow}:E${prevRow}`],
              includeGridData: true,
              fields: 'sheets(data(rowData(values(dataValidation))))',
            })
            const prevValidation = prevMeta.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation
            const prevRef = prevValidation?.condition?.values?.[0]?.userEnteredValue || ''
            // Match Dropdown1!<row>:<row>, tolerating any $ (absolute) markers
            // Google inserts, e.g. Dropdown1!$442:$442 or Dropdown1!442:442.
            const mm = prevRef.match(/Dropdown1!\$?(\d+):/)
            if (mm) {
              const prevDropdownRow = parseInt(mm[1], 10)
              // Same offset for our new row: prevDropdownRow was for prevRow;
              // next row keeps the same offset.
              const offset = prevDropdownRow - prevRow
              dropdownRow = rowNum + offset
            } else {
              console.warn('Could not parse Dropdown1 ref from prev row:', prevRef)
            }
          } catch (offsetErr: any) {
            console.warn('Could not discover dropdown offset, using rowNum:', offsetErr?.message)
          }
        }

        // 3) Fill A-O (columns 1-15) for the new row.
        const rowValues: any[] = new Array(15).fill('')
        rowValues[0] = ymdToSheetDate(ex.date)          // A Date (already set)
        rowValues[1] = ex.account || ''                  // B Account
        rowValues[2] = ex.project || ''                  // C Project
        rowValues[3] = ex.expenseType || ''              // D Expense type
        rowValues[4] = ex.category || ''                 // E Category
        rowValues[5] = ex.guestTrip || ''                // F Guest Trip
        rowValues[6] = ex.store || ''                    // G Store
        rowValues[7] = ex.usd ?? ''                      // H Dollar Amount
        rowValues[8] = ex.eur ?? ''                      // I Euro Amount
        rowValues[9] = ex.refunded || ''                 // J Refunded?
        rowValues[10] = ex.description || ''             // K Description
        rowValues[11] = ex.specificRepair || ''          // L Specific repair
        rowValues[12] = ex.statement || ''               // M Statement
        rowValues[13] = ex.inputBy || ''                 // N Input by
        rowValues[14] = ex.receiptUrl || ''              // O Receipt

        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${EXPENSES_SHEET_TITLE}!A${rowNum}:O${rowNum}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowValues] },
        })

        // Also write Crosscheck (col S) if provided — do not touch P/Q/R.
        if (ex.crosscheck && ex.crosscheck.trim()) {
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${EXPENSES_SHEET_TITLE}!S${rowNum}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [[ex.crosscheck]] },
            })
          } catch (ccErr: any) {
            console.warn('Could not write Crosscheck for row', rowNum, ccErr?.message)
          }
        }

        // 4) Write the Dropdown1 / Dropdown2 formulas on the mapped row.
        const dropdown1Formula = `=if(Expenses!C${rowNum}="","",transpose(unique(FILTER(Definitions!B:B,Definitions!A:A=Expenses!C${rowNum}))))`
        const dropdown2Formula = `=if(Expenses!C${rowNum}="","",transpose(unique(FILTER(Definitions!C:C,Definitions!A:A=Expenses!C${rowNum},Definitions!B:B=Expenses!D${rowNum}))))`
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: [
              { range: `Dropdown1!A${dropdownRow}`, values: [[dropdown1Formula]] },
              { range: `Dropdown2!A${dropdownRow}`, values: [[dropdown2Formula]] },
            ],
          },
        })

        // 5) Set data validation on D and E of the new row (in case the append
        //    landed on a row without validation extended from the sheet).
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                setDataValidation: {
                  range: {
                    sheetId: expensesSheetId,
                    startRowIndex: rowNum - 1,
                    endRowIndex: rowNum,
                    startColumnIndex: 3, // D
                    endColumnIndex: 4,
                  },
                  rule: {
                    condition: {
                      type: 'ONE_OF_RANGE',
                      values: [{ userEnteredValue: `=Dropdown1!${dropdownRow}:${dropdownRow}` }],
                    },
                    showCustomUi: true,
                    strict: true,
                  },
                },
              },
              {
                setDataValidation: {
                  range: {
                    sheetId: expensesSheetId,
                    startRowIndex: rowNum - 1,
                    endRowIndex: rowNum,
                    startColumnIndex: 4, // E
                    endColumnIndex: 5,
                  },
                  rule: {
                    condition: {
                      type: 'ONE_OF_RANGE',
                      values: [{ userEnteredValue: `=Dropdown2!${dropdownRow}:${dropdownRow}` }],
                    },
                    showCustomUi: true,
                    strict: true,
                  },
                },
              },
              {
                setDataValidation: {
                  range: {
                    sheetId: expensesSheetId,
                    startRowIndex: rowNum - 1,
                    endRowIndex: rowNum,
                    startColumnIndex: 2, // C (Project)
                    endColumnIndex: 3,
                  },
                  rule: {
                    condition: {
                      type: 'ONE_OF_RANGE',
                      values: [{ userEnteredValue: `=Definitions!$A$2:$A` }],
                    },
                    showCustomUi: true,
                    strict: true,
                  },
                },
              },
            ],
          },
        })

        inserted.push({ row: rowNum, receiptUrl: ex.receiptUrl })
      } catch (err: any) {
        errors.push({ index: idx, error: err?.message || String(err) })
      }
    }

    return res.status(200).json({ ok: errors.length === 0, inserted, errors, spreadsheetUrl: EXPENSES_URL })
  } catch (err: any) {
    console.error('expense-submit error:', err)
    return res.status(500).json({ error: 'Failed to submit expenses', detail: err?.message || String(err) })
  }
}
