import React, { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCrewName, setCrewName, logout } from '@/lib/auth'
import {
  isIosSafari,
  isStandalone,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getSubscriptionState,
} from '@/lib/push'

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

        <NotificationsSection currentName={name} />

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

function NotificationsSection({ currentName }: { currentName: string }) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const supported = pushSupported()
  const ios = isIosSafari()
  const standalone = isStandalone()
  // iOS only allows web push from installed PWAs — from a Safari tab, the
  // Notification API exists but subscription will fail with a "not permitted"
  // error. Detect and steer the user through Add-to-Home-Screen instead.
  const iosNeedsInstall = ios && !standalone
  const canEnable = supported && !iosNeedsInstall

  const refresh = async () => {
    try {
      const s = await getSubscriptionState()
      setSubscribed(s.subscribed)
      setPermission(s.permission)
    } catch {
      setSubscribed(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const handleEnable = async () => {
    setError(null)
    setStatusMsg(null)
    if (!currentName.trim()) {
      setError('Save your name first — notifications are addressed to you by name.')
      return
    }
    setBusy(true)
    try {
      await subscribeToPush(currentName.trim())
      setStatusMsg('Notifications enabled.')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    setError(null)
    setStatusMsg(null)
    setBusy(true)
    try {
      await unsubscribeFromPush()
      setStatusMsg('Notifications disabled.')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to disable notifications.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-border pt-6 space-y-3">
      <div>
        <Label>Notifications</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Get push alerts from the boss and boat updates (anchor watch, broadcasts).
        </p>
      </div>

      {!supported && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          This browser doesn't support push notifications. Use Safari on iOS (16.4+) or Chrome/Edge on desktop.
        </div>
      )}

      {iosNeedsInstall && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1.5">
          <div className="font-semibold">Install to Home Screen first</div>
          <div>iOS only allows notifications from installed apps:</div>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Tap the Share button in Safari.</li>
            <li>Choose <span className="font-semibold">Add to Home Screen</span>.</li>
            <li>Open the app from the boat icon on your home screen.</li>
            <li>Come back here and tap Enable notifications.</li>
          </ol>
        </div>
      )}

      {canEnable && subscribed === false && (
        <Button
          onClick={handleEnable}
          disabled={busy}
          className="w-full"
        >
          {busy ? 'Enabling…' : '🔔 Enable notifications'}
        </Button>
      )}

      {canEnable && subscribed === true && (
        <div className="space-y-2">
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            ✓ Notifications are on for this device.
          </div>
          <Button
            variant="outline"
            onClick={handleDisable}
            disabled={busy}
            className="w-full"
          >
            {busy ? 'Disabling…' : 'Disable notifications'}
          </Button>
        </div>
      )}

      {canEnable && permission === 'denied' && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-red-200">
          Notifications were blocked in the browser. Open device Settings → this app → Notifications and allow them, then come back.
        </div>
      )}

      {statusMsg && (
        <div className="text-xs text-emerald-300">{statusMsg}</div>
      )}
      {error && (
        <div className="text-xs text-red-300">{error}</div>
      )}
    </div>
  )
}
