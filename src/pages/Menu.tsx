import React from 'react'
import { useLocation } from 'wouter'
import { getCrewName, logout, getRole } from '@/lib/auth'
import { EditableText, useTextOverrides } from '@/lib/textOverrides'

interface MenuItemProps {
  icon: string
  id: string
  label: string
  href: string
  description?: string
}

function MenuItem({ icon, id, label, href, description }: MenuItemProps) {
  const [, setLocation] = useLocation()
  return (
    <button
      onClick={() => setLocation(href)}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left min-h-[72px]"
    >
      <span className="text-2xl flex-shrink-0 w-10 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <EditableText id={`menu.${id}.label`} defaultText={label} as="div" className="text-base font-semibold" />
        {description && (
          <EditableText
            id={`menu.${id}.description`}
            defaultText={description}
            as="div"
            className="text-sm text-muted-foreground mt-0.5"
          />
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
  const role = getRole()

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
        <EditableText id="menu.title" defaultText="Rise Above" as="h1" className="text-2xl font-bold" />
        <EditableText id="menu.subtitle" defaultText="Engine Log & SMS" as="p" className="text-muted-foreground text-sm mt-1" />
      </header>

      {/* Menu items */}
      <div className="flex-1 px-4 max-w-lg mx-auto w-full space-y-3">
        <MenuItem
          icon="📋"
          id="runlog"
          label="Running Log"
          href="/runlog/upload"
          description="Upload and log engine readings"
        />
        <MenuItem
          icon="🔍"
          id="inspection"
          label="Engine Room Inspection Log"
          href="/inspection"
          description="Walk-around inspection with PDF report"
        />
        <MenuItem
          icon="🕒"
          id="watch"
          label="Watch Duties"
          href="/watch"
          description="Daily checklist & watch calendar"
        />
        <MenuItem
          icon="🗓️"
          id="schedule"
          label="Schedule"
          href="/schedule"
          description="Upcoming trips & itineraries"
        />
        <MenuItem
          icon="🛡️"
          id="ism"
          label="ISM"
          href="/ism"
          description="Operating, Emergency, Fire Safety & Drills"
        />
        <MenuItem
          icon="📖"
          id="guides"
          label="Operational Guides"
          href="/guides"
          description="Crew procedures & how-tos"
        />
        <MenuItem
          icon="🔧"
          id="maintenance"
          label="Maintenance Logs"
          href="/maintenance"
          description="Service history & upcoming due dates"
        />
        <MenuItem
          icon="📦"
          id="inventory"
          label="Inventory"
          href="/inventory"
          description="Spares & consumables onboard"
        />
        <MenuItem
          icon="⚙️"
          id="settings"
          label="Settings"
          href="/settings"
          description="Name, preferences"
        />
      </div>

      {/* Footer */}
      <footer className="px-4 py-6 mt-8 border-t border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>
              Signed in as <span className="text-foreground font-medium">{crewName || 'Crew'}</span>
            </span>
            {role !== 'crew' && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${
                role === 'admin'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                {role === 'admin' ? 'Admin' : role === 'viewer' ? 'View only' : ''}
              </span>
            )}
            {role === 'admin' && <AdminTextEditToggle />}
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

function AdminTextEditToggle() {
  const { editMode, setEditMode } = useTextOverrides()
  return (
    <button
      onClick={() => setEditMode(!editMode)}
      title={editMode ? 'Stop editing text labels' : 'Edit text labels'}
      aria-label={editMode ? 'Stop editing text labels' : 'Edit text labels'}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
        editMode
          ? 'bg-yellow-500/30 border-yellow-500/70 text-yellow-100'
          : 'bg-transparent border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/15'
      }`}
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  )
}
