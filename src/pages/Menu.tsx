import React from 'react'
import { useLocation } from 'wouter'
import { getCrewName, logout, getRole } from '@/lib/auth'
import { EditableText, useTextOverrides } from '@/lib/textOverrides'
import { TRIPS } from '@/data/trips'

// Find the trip whose date range covers today's date so "Today's
// schedule" can jump straight to the right day. Falls back to the
// consolidated summer-trip page when nothing matches.
function findTodaysScheduleHref(): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const iso = today.toISOString().slice(0, 10)
  for (const t of TRIPS) {
    if (t.startDate <= iso && iso <= t.endDate) {
      return `/schedule/${t.id}?d=${iso}`
    }
  }
  // No active trip — default to the consolidated summer overview.
  return '/schedule/enricos-summer-trip'
}

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
      <header className="px-4 pt-12 pb-6 text-center">
        <div className="flex justify-center mb-3">
          <img
            src="/assets/rise-above-logo.png"
            alt="Rise Above"
            className="h-16 sm:h-20 w-auto object-contain"
          />
        </div>
        <EditableText
          id="menu.subtitle"
          defaultText="ISM, Maintenance and daily operations"
          as="p"
          className="text-muted-foreground text-sm mt-1"
        />

        {/* Today's schedule shortcut */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setLocation(findTodaysScheduleHref())}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span>Today&apos;s schedule</span>
          </button>
        </div>
      </header>

      {/* Menu items */}
      <div className="flex-1 px-4 max-w-lg mx-auto w-full space-y-3">
        <MenuItem
          icon="🕒"
          id="watch"
          label="Watch Duties"
          href="/watch"
          description="Watch calendar, running log & engine room inspections"
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
          icon="🧾"
          id="expenses"
          label="Expense intake"
          href="/expenses"
          description="Snap receipts, auto-read amounts, file to spreadsheet"
        />
        <MenuItem
          icon="⚙️"
          id="settings"
          label="Settings"
          href="/settings"
          description="Name, preferences"
        />
        {role === 'admin' && (
          <MenuItem
            icon="📣"
            id="admin-notify"
            label="Send Notification"
            href="/admin/notify"
            description="Push schedule updates to selected crew &amp; guests"
          />
        )}
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
