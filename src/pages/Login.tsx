import React, { useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/lib/api'
import { setToken, getCrewName } from '@/lib/auth'

export function LoginPage() {
  const [, setLocation] = useLocation()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const { token } = await login(code.trim())
      setToken(token)
      // Redirect: if no crew name yet, go to set-name first
      if (!getCrewName()) {
        setLocation('/settings/name')
      } else {
        setLocation('/menu')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid access code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <svg viewBox="0 0 48 48" className="w-16 h-16 mb-4" fill="none" aria-label="Rise Above">
            <rect width="48" height="48" rx="12" fill="hsl(0 0% 10%)"/>
            <path d="M24 8L38 36H10L24 8Z" stroke="hsl(0 72% 51%)" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
            <path d="M16 28h16" stroke="hsl(0 72% 51%)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="text-2xl font-bold tracking-tight">Rise Above</h1>
          <p className="text-muted-foreground text-sm mt-1">Operations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Access Code</Label>
            <Input
              id="code"
              type="password"
              placeholder="Enter access code"
              value={code}
              onChange={e => setCode(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="text-center text-xl tracking-widest h-14"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-base"
            disabled={loading || !code.trim()}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-8">
          M/Y Rise Above · Safety Management System
        </p>
      </div>
    </div>
  )
}