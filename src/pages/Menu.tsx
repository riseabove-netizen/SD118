import React from 'react'
import { useLocation } from 'wouter'
import { getCrewName, logout } from '@/lib/auth'

interface MenuItemProps {
  icon: string
  label: string
  href: string
  description?: string
}

function MenuItem({ icon, label, href, description }: MenuItemProps) {
  const [, setLocation] = useLocation()
  return (
    <button
      onClick={() => setLocation(href)}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left min-h-[72px]"
    >
      <span className="text-2xl flex-shrink-0 w-10 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold">{label}</div>
        {description && (
          <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

export function MenuPage() {
  const [, setLocation] = useLocation()
  const crewName = getCrewName()

  const handleLogout = () => {
    logout()
    setLocation('/')
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 pt-12 pb-8 text-center">
        <div className="flex justify-center mb-4">
          <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" aria-label="Rise Above">
            <rect width="48" height="48" rx="10" fill="hsl(0 0% 10%)"/>
            <path d="M24 9L37 35H11L24 9Z" stroke="hsl(0 72% 51%)" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
            <path d="M17 27h14" stroke="hsl(0 72% 51%)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Rise Above</h1>
        <p className="text-muted-foreground text-sm mt-1">Engine Log & SMS</p>
      </header>

      {/* Menu items */}
      <div className="flex-1 px-4 max-w-lg mx-auto w-full space-y-3">
        <MenuItem
          icon="📋"
          label="Running Log"
          href="/runlog/upload"
          description="Upload and log engine readings"
        />
        <MenuItem
          icon="🛡️"
          label="ISM Logs"
          href="/ism"
          description="Operating & Emergency procedures"
        />
        <MenuItem
          icon="🔍"
          label="Engine Room Inspection Log"
          href="/inspection"
          description="Walk-around inspection with PDF report"
        />
        <MenuItem
          icon="📦"
          label="Inventory"
          href="/inventory"
          description="Spares & consumables onboard"
        />
        <MenuItem
          icon="🗓️"
          label="Schedule"
          href="/schedule"
          description="Upcoming trips & itineraries"
        />
        <MenuItem
          icon="⚙️"
          label="Settings"
          href="/settings"
          description="Name, preferences"
        />
      </div>

      {/* Footer */}
      <footer className="px-4 py-6 mt-8 border-t border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground font-medium">{crewName || 'Crew'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors min-h-[44px] flex items-center"
          >
            Log out
          </button>
        </div>
      </footer>
    </div>
  )
}