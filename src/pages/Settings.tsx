import React, { useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCrewName, setCrewName, logout } from '@/lib/auth'

export function SettingsPage() {
  const [, setLocation] = useLocation()
  const [name, setName] = useState(getCrewName() || '')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCrewName(name.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = () => {
    logout()
    setLocation('/')
  }

  return (
    <MenuLayout title="Settings" showBack backHref="/menu">
      <div className="space-y-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <p className="text-sm text-muted-foreground">
              Used as signature on all ISM forms.
            </p>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            disabled={!name.trim()}
            className="w-full"
          >
            {saved ? '✓ Saved' : 'Save Name'}
          </Button>
        </form>

        <div className="border-t border-border pt-6">
          <Button
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-primary-foreground"
            onClick={handleLogout}
          >
            Log Out
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Rise Above Operations v2.0
        </p>
      </div>
    </MenuLayout>
  )
}