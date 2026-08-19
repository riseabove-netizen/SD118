// Convert EUR -> USD (or USD -> EUR) using the ECB reference rate for a given date.
// Uses the free exchangerate.host / Frankfurter public API. No key needed.
// Ramp integration will replace this later when the connector is wired up.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 15 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const amountRaw = (req.query.amount ?? '') as string
  const from = ((req.query.from ?? 'EUR') as string).toUpperCase()
  const to = ((req.query.to ?? 'USD') as string).toUpperCase()
  const dateRaw = ((req.query.date ?? '') as string).trim()

  const amount = Number(amountRaw)
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount query param required (positive number)' })
  }
  if (from === to) {
    return res.status(200).json({ ok: true, amount, converted: amount, rate: 1, source: 'identity' })
  }

  // Frankfurter accepts either YYYY-MM-DD or "latest"
  const datePath = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : 'latest'
  const url = `https://api.frankfurter.dev/v1/${datePath}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`

  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!r.ok) {
      return res.status(200).json({ ok: false, error: `FX provider returned ${r.status}`, converted: null, rate: null })
    }
    const j: any = await r.json()
    const rate = j?.rates?.[to]
    if (!Number.isFinite(rate)) {
      return res.status(200).json({ ok: false, error: 'rate missing in provider response', converted: null, rate: null })
    }
    const converted = Math.round(amount * rate * 100) / 100
    return res.status(200).json({ ok: true, amount, converted, rate, source: 'frankfurter', date: j?.date || datePath })
  } catch (err: any) {
    return res.status(200).json({ ok: false, error: err?.message || String(err), converted: null, rate: null })
  }
}
