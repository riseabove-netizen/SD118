import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { OPERATING_FORMS, EMERGENCY_FORMS } from '@/data/forms-catalog'

interface TileProps {
  onClick: () => void
  title: string
  description: string
  tone: 'blue' | 'red' | 'orange' | 'amber'
  icon: React.ReactNode
}

function Tile({ onClick, title, description, tone, icon }: TileProps) {
  const toneClasses: Record<TileProps['tone'], { border: string; bg: string; iconBg: string; iconColor: string; hover: string }> = {
    blue:   { border: 'border-border',           bg: 'bg-card', iconBg: 'bg-blue-500/10',    iconColor: 'text-blue-400',    hover: 'hover:bg-secondary active:bg-secondary/80' },
    red:    { border: 'border-destructive/30',   bg: 'bg-card', iconBg: 'bg-destructive/10', iconColor: 'text-destructive', hover: 'hover:bg-destructive/5 active:bg-destructive/10' },
    orange: { border: 'border-orange-500/30',    bg: 'bg-card', iconBg: 'bg-orange-500/10',  iconColor: 'text-orange-400',  hover: 'hover:bg-orange-500/5 active:bg-orange-500/10' },
    amber:  { border: 'border-amber-500/30',     bg: 'bg-card', iconBg: 'bg-amber-500/10',   iconColor: 'text-amber-400',   hover: 'hover:bg-amber-500/5 active:bg-amber-500/10' },
  }
  const t = toneClasses[tone]
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-5 rounded-xl border ${t.border} ${t.bg} ${t.hover} transition-colors text-left`}
    >
      <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
        <span className={`w-6 h-6 ${t.iconColor}`}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base">{title}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
      </div>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

export function IsmIndexPage() {
  const [, setLocation] = useLocation()

  return (
    <MenuLayout title="ISM" showBack backHref="/menu">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Safety Management System</h2>
          <p className="text-sm text-muted-foreground mt-1">
            M/Y Rise Above · All procedures
          </p>
        </div>

        <div className="space-y-3">
          <Tile
            onClick={() => setLocation('/ism/operating')}
            title="Operating Procedures"
            description={`${OPERATING_FORMS.length} procedures`}
            tone="blue"
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
                <path d="M9 12h6M9 16h4"/>
              </svg>
            }
          />

          <Tile
            onClick={() => setLocation('/ism/emergency')}
            title="Emergency Procedures"
            description={`${EMERGENCY_FORMS.length} procedures`}
            tone="red"
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            }
          />

          <Tile
            onClick={() => setLocation('/ism/fire-safety')}
            title="Life Saving Equipment"
            description="Plan, life-saving appliances, equipment list"
            tone="orange"
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>
              </svg>
            }
          />

          <Tile
            onClick={() => setLocation('/ism/anchor-watch')}
            title="Anchor Watchkeeper Log"
            description="Shared hourly watch with PDF export to Drive"
            tone="red"
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2"/>
                <path d="M12 7v14"/>
                <path d="M5 18a7 7 0 0014 0"/>
                <path d="M8 11h8"/>
              </svg>
            }
          />

          <Tile
            onClick={() => setLocation('/ism/drills')}
            title="Drills / Testing"
            description="Mandatory drills and equipment testing schedule"
            tone="amber"
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            }
          />
        </div>
      </div>
    </MenuLayout>
  )
}
