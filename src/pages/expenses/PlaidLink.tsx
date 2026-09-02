import React, { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { isAdmin, getToken } from '@/lib/auth'

type Account = {
  account_id: string
  name: string
  mask: string
  label: string
  subtype: string
  balance_usd?: number | null
}
type Item = {
  item_id: string
  institution_name: string
  status: string
  added_at?: string
  last_synced_at?: string
  error?: string
  accounts: Account[]
}

function adminHeaders(): Record<string, string> {
  const token = getToken() || ''
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export function PlaidLinkPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [env, setEnv] = useState<string>('production')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/plaid/accounts', { headers: adminHeaders() })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setItems(j.items || [])
    } catch (e: any) { setError(e?.message || String(e)) }
    finally { setLoading(false) }
  }, [])

  const requestLinkToken = useCallback(async () => {
    setError(null); setStatus(null)
    try {
      const r = await fetch('/api/plaid/link-token', { method: 'POST', headers: adminHeaders(), body: '{}' })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setLinkToken(j.link_token)
      setEnv(j.env || 'production')
    } catch (e: any) { setError(e?.message || String(e)) }
  }, [])

  const onSuccess = useCallback(async (public_token: string | null) => {
    if (!public_token) { setError('Plaid returned no public_token'); setLinkToken(null); return }
    setStatus('Linking account...')
    try {
      const r = await fetch('/api/plaid/exchange', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ public_token }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setStatus(`Linked: ${j.institution_name || j.item_id}`)
      setLinkToken(null)
      await loadAccounts()
    } catch (e: any) { setError(e?.message || String(e)); setStatus(null) }
  }, [loadAccounts])

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess,
    onExit: (err) => {
      if (err) setError(err.display_message || err.error_message || err.error_code || 'Plaid Link exited')
      setLinkToken(null)
    },
  })

  useEffect(() => { if (linkToken && ready) open() }, [linkToken, ready, open])
  useEffect(() => { loadAccounts() }, [loadAccounts])

  const unlink = async (item_id: string) => {
    if (!confirm('Unlink this bank connection?')) return
    setError(null); setStatus(null)
    try {
      const r = await fetch('/api/plaid/unlink', {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ item_id }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setStatus('Unlinked')
      await loadAccounts()
    } catch (e: any) { setError(e?.message || String(e)) }
  }

  if (!isAdmin()) {
    return (
      <MenuLayout title="Plaid Link" showBack backHref="/menu">
        <div className="text-red-400">Admin only.</div>
      </MenuLayout>
    )
  }

  return (
    <MenuLayout title="Plaid Link" showBack backHref="/menu">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button onClick={requestLinkToken} disabled={!!linkToken}>
            {linkToken ? 'Opening Plaid…' : 'Link a new bank'}
          </Button>
          <Button onClick={loadAccounts} variant="outline" disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <span className="text-xs text-neutral-400">env: {env}</span>
        </div>

        {status && <div className="text-green-400 text-sm">{status}</div>}
        {error && <div className="text-red-400 text-sm whitespace-pre-wrap">{error}</div>}

        <div className="space-y-3">
          {items.length === 0 && !loading && (
            <div className="text-neutral-500 text-sm">No banks linked yet.</div>
          )}
          {items.map(it => (
            <div key={it.item_id} className="border border-neutral-800 rounded p-3 bg-neutral-950">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold">{it.institution_name || it.item_id}</div>
                  <div className="text-xs text-neutral-500">
                    status: {it.status}
                    {it.added_at ? ` · linked ${new Date(it.added_at).toLocaleDateString()}` : ''}
                  </div>
                  {it.error && <div className="text-red-400 text-xs mt-1">{it.error}</div>}
                </div>
                {it.status === 'active' && (
                  <Button size="sm" variant="destructive" onClick={() => unlink(it.item_id)}>Unlink</Button>
                )}
              </div>
              {it.accounts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {it.accounts.map(a => (
                    <div key={a.account_id} className="flex justify-between text-sm border-t border-neutral-800 pt-1">
                      <span>
                        <span className="text-neutral-300">{a.label || a.name}</span>
                        {a.mask && <span className="text-neutral-500"> ····{a.mask}</span>}
                        {a.subtype && <span className="text-neutral-600"> · {a.subtype}</span>}
                      </span>
                      {a.balance_usd != null && (
                        <span className="text-neutral-400 tabular-nums">${a.balance_usd.toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </MenuLayout>
  )
}
