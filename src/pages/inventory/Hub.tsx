import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'

function HubCard({ icon, label, description, href }: { icon: string; label: string; description: string; href: string }) {
  const [, setLocation] = useLocation()
  return (
    <button
      onClick={() => setLocation(href)}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left min-h-[72px]"
    >
      <span className="text-2xl flex-shrink-0 w-10 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold">{label}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
      </div>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

export function InventoryHubPage() {
  return (
    <MenuLayout title="Inventory" showBack backHref="/menu">
      <div className="space-y-3">
        <HubCard icon="🪄" label="Bulk Add (AI)" description="Dictate or photograph multiple items at once" href="/inventory/bulk-add" />
        <HubCard icon="🔧" label="Spares" description="Mechanical parts by part number" href="/inventory/spares" />
        <HubCard icon="📦" label="Consumables" description="Interior, exterior, galley supplies" href="/inventory/consumables" />
        <HubCard icon="📜" label="Transactions" description="Recent quantity changes" href="/inventory/transactions" />
      </div>
    </MenuLayout>
  )
}