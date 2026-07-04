import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { DECKHAND_DUTIES_SECTIONS, type DeckhandSection } from '@/data/deckhand-duties'

interface TileProps {
  onClick: () => void
  title: string
  description: string
  tone: DeckhandSection['tone']
  itemCount: number
  icon: React.ReactNode
}

function Tile({ onClick, title, description, tone, itemCount, icon }: TileProps) {
  const toneClasses: Record<DeckhandSection['tone'], { border: string; bg: string; iconBg: string; iconColor: string; hover: string }> = {
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
        <div className="text-sm text-muted-foreground mt-0.5">{description} · {itemCount} {itemCount === 1 ? 'item' : 'items'}</div>
      </div>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  'morning': (
    // sunrise
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 18a5 5 0 0 0-10 0"/>
      <line x1="12" y1="2" x2="12" y2="9"/>
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
      <line x1="1" y1="18" x2="3" y2="18"/>
      <line x1="21" y1="18" x2="23" y2="18"/>
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
      <line x1="23" y1="22" x2="1" y2="22"/>
      <polyline points="8 6 12 2 16 6"/>
    </svg>
  ),
  'toys-beach-club': (
    // life ring / swim
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="3.5"/>
      <line x1="4.9" y1="4.9" x2="9.5" y2="9.5"/>
      <line x1="14.5" y1="14.5" x2="19.1" y2="19.1"/>
      <line x1="19.1" y1="4.9" x2="14.5" y2="9.5"/>
      <line x1="9.5" y1="14.5" x2="4.9" y2="19.1"/>
    </svg>
  ),
  'afternoon': (
    // sun
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/>
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/>
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
    </svg>
  ),
  'after-toys': (
    // spray / clean
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6l-1 3H10L9 3z"/>
      <path d="M9 6v3a2 2 0 002 2h2a2 2 0 002-2V6"/>
      <rect x="8" y="11" width="8" height="10" rx="2"/>
      <line x1="18" y1="4" x2="20" y2="4"/>
      <line x1="18" y1="7" x2="21" y2="7"/>
      <line x1="18" y1="10" x2="20" y2="10"/>
    </svg>
  ),
  'evening': (
    // moon
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  ),
  'general-notes': (
    // clipboard / notes
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  ),
}

export function DeckhandDutiesPage() {
  const [, setLocation] = useLocation()

  return (
    <MenuLayout title="Exterior Daily Duties" showBack backHref="/ism">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Deckhand Duties SOP</h2>
          <p className="text-sm text-muted-foreground mt-1">M/Y Rise Above · Guests on board</p>
        </div>

        <div className="space-y-3">
          {DECKHAND_DUTIES_SECTIONS.map(section => (
            <Tile
              key={section.id}
              onClick={() => setLocation(`/ism/deckhand-duties/${section.id}`)}
              title={section.title}
              description={section.description}
              tone={section.tone}
              itemCount={section.items.length}
              icon={SECTION_ICONS[section.id] ?? SECTION_ICONS['general-notes']}
            />
          ))}
        </div>
      </div>
    </MenuLayout>
  )
}
