// Diagnostic: try each import step-by-step with error handling
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const steps: Record<string, any> = {}
  try {
    steps.step1 = 'importing crypto'
    const crypto = (await import('crypto')).default
    steps.step1 = typeof crypto.createHmac

    steps.step2 = 'importing googleapis'
    const { google } = await import('googleapis')
    steps.step2 = typeof google.sheets

    steps.step3 = 'importing plaid'
    const plaid = await import('plaid')
    steps.step3 = { envs: Object.keys(plaid.PlaidEnvironments), api: typeof plaid.PlaidApi }

    steps.step4 = 'importing _plaid'
    const _plaid = await import('../_plaid')
    steps.step4 = Object.keys(_plaid)

    return res.status(200).json({ ok: true, steps })
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      failed_at: Object.keys(steps).pop(),
      steps,
      error: String(e?.message || e),
      stack: String(e?.stack || '').split('\n').slice(0, 5).join('\n'),
    })
  }
}
