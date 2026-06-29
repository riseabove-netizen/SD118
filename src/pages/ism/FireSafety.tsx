import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'

interface TileProps {
  onClick: () => void
  title: string
  description: string
  icon: React.ReactNode
}

function Tile({ onClick, title, description, icon }: TileProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-5 rounded-xl border border-orange-500/30 bg-card hover:bg-orange-500/5 active:bg-orange-500/10 transition-colors text-left"
    >
      <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
        <span className="w-6 h-6 text-orange-400">{icon}</span>
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

export function FireSafetyIndexPage() {
  const [, setLocation] = useLocation()

  return (
    <MenuLayout title="Fire Safety" showBack backHref="/ism">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Fire Safety</h2>
          <p className="text-sm text-muted-foreground mt-1">
            M/Y Rise Above
          </p>
        </div>

        <div className="space-y-3">
          <Tile
            onClick={() => setLocation('/ism/fire-safety/plan')}
            title="Fire and Life Saving Appliances Plan"
            description="Vessel safety equipment diagrams (manual pages B-77 to B-91)"
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
              </svg>
            }
          />

          <Tile
            onClick={() => setLocation('/ism/fire-safety/equipment')}
            title="Fire & Safety Equipment List"
            description="Extinguishers, life rafts, flares, jackets, EPIRB, med kit (editable)"
            icon={
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="15" y2="17"/>
              </svg>
            }
          />
        </div>
      </div>
    </MenuLayout>
  )
}
