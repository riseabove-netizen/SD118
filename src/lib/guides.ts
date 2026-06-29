export type GuideSummary = {
  ID: string
  Title: string
  Category: string
  'Current Version': string
  'Updated At': string
  'Updated By': string
  'Created At': string
  'Created By': string
  rowIndex: number
}

export type GuideVersion = {
  version: number
  createdAt: string
  createdBy: string
  note: string
}

export type Guide = GuideSummary & {
  Markdown: string
  versions: GuideVersion[]
}

export const GUIDE_CATEGORIES = [
  'Engine Room',
  'Bridge',
  'Deck',
  'Galley',
  'Safety',
  'Maintenance',
  'Operations',
  'Emergency',
  'Other',
]

async function jsonOrError(res: Response): Promise<any> {
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) {
    const detail = data?.detail || data?.error || res.statusText
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return data
}

export async function fetchGuides(): Promise<GuideSummary[]> {
  const res = await fetch('/api/guides')
  const data = await jsonOrError(res)
  return data.guides || []
}

export async function fetchGuide(id: string): Promise<Guide> {
  const res = await fetch(`/api/guides?id=${encodeURIComponent(id)}`)
  const data = await jsonOrError(res)
  return data.guide
}

export async function saveGuide(args: {
  id?: string
  title: string
  category?: string
  markdown: string
  note?: string
  user?: string
}): Promise<{ ok: true; id: string; version: number }> {
  const res = await fetch('/api/guides?action=upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  return jsonOrError(res)
}

export async function prettifyGuide(args: {
  title: string
  category?: string
  draft: string
  photos?: { url: string; caption?: string }[]
}): Promise<{ ok: true; markdown: string }> {
  const res = await fetch('/api/guides?action=prettify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  return jsonOrError(res)
}

export async function uploadGuidePhoto(base64: string, guideTag?: string): Promise<string> {
  // Reuse the inventory photo upload endpoint — it stores photos in the same Drive folder
  const res = await fetch('/api/inventory-photo-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, tab: 'Guide', label: guideTag || 'guide' }),
  })
  const data = await jsonOrError(res)
  return data.photoUrl
}

export async function uploadDrivePdf(base64: string, filename: string, label?: string): Promise<{ viewUrl: string; fileId: string }> {
  const res = await fetch('/api/inventory-photo-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, filename, label: label || 'pdf', mime: 'application/pdf', ext: 'pdf' }),
  })
  const data = await jsonOrError(res)
  return { viewUrl: data.viewUrl, fileId: data.fileId }
}
