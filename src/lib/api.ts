import { getToken } from './auth'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const baseMsg = data.error || data.message || 'Request failed'
    const rawDetail = data.detail || data.details || ''
    const detail = rawDetail ? ` — ${String(rawDetail).slice(0, 400)}` : ''
    throw new ApiError(res.status, `${baseMsg}${detail}`)
  }
  return data as T
}

export async function login(code: string): Promise<{ token: string; role?: 'admin' | 'viewer' | 'crew' }> {
  return request('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function extractFromImages(images: string[]): Promise<Record<string, unknown>> {
  return request('/api/extract', {
    method: 'POST',
    body: JSON.stringify({ images }),
  })
}

export async function writeRow(values: Record<string, unknown>): Promise<{ ok: boolean }> {
  const token = getToken()
  return request('/api/write-row', {
    method: 'POST',
    body: JSON.stringify({ values, token }),
  })
}

export interface RpmBand {
  rpm: number
  sog: number | null
  economy: number | null
  port: Record<string, { avg: number | null; sigma: number | null }>
  stbd: Record<string, { avg: number | null; sigma: number | null }>
}
export async function getRpmAverages(): Promise<{ ok: boolean; bands: RpmBand[] }> {
  return request('/api/rpm-averages', { method: 'GET' })
}

export interface IsmSavePayload {
  formId: string
  formName: string
  formType: string
  submittedAt: string
  signerName: string
  fields: Record<string, unknown>
}

export async function saveIsmForm(payload: IsmSavePayload): Promise<{ ok: boolean; id: string }> {
  return request('/api/ism/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}