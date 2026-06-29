import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import type { ISMForm, FormItem } from '@/data/forms-catalog'

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, Array.from(sub) as number[])
  }
  return btoa(binary)
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  if (!text) return []
  const out: string[] = []
  const paragraphs = text.split(/\r?\n/)
  for (const para of paragraphs) {
    if (!para.trim()) { out.push(''); continue }
    const words = para.split(/\s+/)
    let line = ''
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(trial, size) > maxW && line) {
        out.push(line)
        line = w
      } else {
        line = trial
      }
    }
    if (line) out.push(line)
  }
  return out
}

interface BuildArgs {
  form: ISMForm
  checks: Record<string, boolean>
  extraValues: Record<string, string>
  emergencyHeader?: Record<string, string>
  specificCol?: string
  specificChecks?: Record<string, boolean>
  notes?: string
  signerName: string
  submittedAt: string
  submissionId: string
}

const itemLabelById = (form: ISMForm): Record<string, string> => {
  const map: Record<string, string> = {}
  const walk = (items: FormItem[]) => {
    for (const it of items) {
      if (!it.noCheckbox) map[it.id] = it.label
    }
  }
  walk(form.items)
  if (form.sections) {
    for (const s of form.sections) walk(s.items)
  }
  return map
}

export async function buildIsmFormPdf(args: BuildArgs): Promise<Uint8Array> {
  const { form, checks, extraValues, emergencyHeader, specificCol, specificChecks, notes, signerName, submittedAt, submissionId } = args

  const pdf = await PDFDocument.create()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.06, 0.07, 0.09)
  const muted = rgb(0.45, 0.47, 0.5)
  const accent = form.formType === 'emergency' ? rgb(0.78, 0.18, 0.18) : rgb(0.13, 0.35, 0.7)
  const line = rgb(0.85, 0.85, 0.85)
  const margin = 36

  let page: PDFPage = pdf.addPage([595.28, 841.89])
  const width = page.getWidth() - margin * 2
  let y = page.getHeight() - margin

  const newPage = () => {
    page = pdf.addPage([595.28, 841.89])
    y = page.getHeight() - margin
  }
  const ensure = (h: number) => { if (y - h < margin) newPage() }

  const drawText = (txt: string, x: number, size: number, font: PDFFont, color = ink) => {
    page.drawText(txt, { x, y: y - size, size, font, color })
  }
  const drawWrapped = (txt: string, x: number, size: number, font: PDFFont, color = ink, maxW = width - (x - margin)) => {
    const lines = wrap(txt, font, size, maxW)
    for (const ln of lines) {
      ensure(size + 2)
      page.drawText(ln, { x, y: y - size, size, font, color })
      y -= size + 2
    }
  }
  const hr = () => {
    ensure(8)
    page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, color: line, thickness: 0.5 })
    y -= 8
  }

  // Header
  drawText(form.formName, margin, 16, helvBold, ink)
  const right = 'M/Y Rise Above'
  drawText(right, page.getWidth() - margin - helv.widthOfTextAtSize(right, 10), 10, helv, muted)
  y -= 22
  drawText(form.category.toUpperCase(), margin, 9, helvBold, accent)
  y -= 14
  hr()

  // Meta rows
  const submitted = new Date(submittedAt)
  const meta: [string, string][] = [
    ['Submitted', submitted.toLocaleString()],
    ['Signer', signerName || '—'],
    ['Form ID', form.formId],
    ['Submission ID', submissionId],
  ]
  for (const [k, v] of meta) {
    ensure(14)
    drawText(k, margin, 9, helvBold, muted)
    drawText(v, margin + 110, 10, helv, ink)
    y -= 14
  }
  y -= 4

  // Emergency header block
  if (form.formType === 'emergency' && emergencyHeader) {
    hr()
    drawText('Incident report', margin, 11, helvBold, accent)
    y -= 14
    const order = ['yachtName', 'callSign', 'officialNumber', 'mmsi', 'dateOfIncident', 'time', 'location', 'weather', 'typeOfIncident', 'personsInvolved', 'injuriesSustained', 'damageToVessel']
    for (const k of order) {
      const v = emergencyHeader[k]
      if (!v) continue
      ensure(14)
      drawText(k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), margin, 9, helvBold, muted)
      drawWrapped(v, margin + 130, 10, helv, ink, width - 130)
    }
    y -= 4
  }

  // Extra fields
  if (form.extraFields && form.extraFields.length > 0) {
    for (const group of form.extraFields) {
      const hasValues = group.fields.some(f => (extraValues[f.key] || '').trim() !== '')
      if (!hasValues) continue
      hr()
      drawText(group.title, margin, 11, helvBold, ink)
      y -= 14
      for (const f of group.fields) {
        const v = (extraValues[f.key] || '').trim()
        if (!v) continue
        ensure(14)
        drawText(`${f.label}${f.unit ? ` [${f.unit}]` : ''}`, margin, 9, helvBold, muted)
        drawWrapped(v, margin + 160, 10, helv, ink, width - 160)
      }
      y -= 4
    }
  }

  // Checklist
  const labels = itemLabelById(form)
  const checkedIds = Object.entries(checks).filter(([, v]) => v).map(([k]) => k)
  const drawChecklistItem = (it: FormItem) => {
    ensure(13)
    const isChecked = !!checks[it.id]
    const box = isChecked ? '☑' : '☐'
    const indent = (it.indent || 0) * 12
    page.drawText(box, { x: margin + indent, y: y - 10, size: 11, font: helv, color: isChecked ? accent : muted })
    drawWrapped(it.label, margin + indent + 14, 10, helv, ink, width - indent - 14)
  }
  if (Object.keys(labels).length > 0) {
    hr()
    const total = Object.keys(labels).length
    drawText(`Checklist — ${checkedIds.length} of ${total} confirmed`, margin, 11, helvBold, ink)
    y -= 14
    // Top-level items
    for (const it of form.items) if (!it.noCheckbox) drawChecklistItem(it)
    // Sectioned items (e.g. Emergency Broadcast: Pan Pan / Mayday)
    if (form.sections) {
      for (const s of form.sections) {
        ensure(20)
        y -= 6
        drawText(s.sectionLabel, margin, 10, helvBold, accent)
        y -= 14
        if (s.sectionDescription) {
          drawWrapped(s.sectionDescription, margin, 9, helv, muted)
          y -= 2
        }
        for (const it of s.items) if (!it.noCheckbox) drawChecklistItem(it)
      }
    }
    y -= 4
  }

  // Specific incidents
  if (form.specificIncidents && specificCol) {
    const col = form.specificIncidents.columns.find(c => c.label === specificCol)
    if (col) {
      hr()
      drawText(`Specific incident: ${col.label}`, margin, 11, helvBold, accent)
      y -= 14
      for (let i = 0; i < col.rows.length; i++) {
        const id = `specific-${col.label}-${i}`
        const isChecked = !!(specificChecks && specificChecks[id])
        ensure(13)
        page.drawText(isChecked ? '☑' : '☐', { x: margin, y: y - 10, size: 11, font: helv, color: isChecked ? accent : muted })
        drawWrapped(col.rows[i], margin + 14, 10, helv, ink, width - 14)
      }
      y -= 4
    }
  }

  // Notes
  if (notes && notes.trim()) {
    hr()
    drawText('Notes', margin, 11, helvBold, ink)
    y -= 14
    drawWrapped(notes, margin, 10, helv, ink)
    y -= 4
  }

  // Signature footer
  ensure(40)
  y -= 6
  hr()
  drawText('Signed by', margin, 9, helvBold, muted)
  drawText(signerName || '—', margin + 80, 11, helvBold, accent)
  drawText(submitted.toLocaleString(), margin + 280, 9, helv, muted)

  return pdf.save()
}

export function ismPdfFilename(form: ISMForm, submittedAt: string): string {
  const date = submittedAt.slice(0, 10)
  const safeName = form.formName.replace(/[^\w\-. ]+/g, '_').slice(0, 60)
  return `${date}-${form.formId}-${safeName}.pdf`
}
