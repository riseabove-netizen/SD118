import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { OPERATING_FORMS, EMERGENCY_FORMS } from '@/data/forms-catalog'

export function IsmIndexPage() {
  const [, setLocation] = useLocation()

  return (
    <MenuLayout title="ISM Logs" showBack backHref="/menu">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Safety Management System</h2>
          <p className="text-sm text-muted-foreground mt-1">
            M/Y Rise Above · All procedures
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setLocation('/ism/operating')}
            className="w-full flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-secondary active:bg-secondary/80 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
                <path d="M9 12h6M9 16h4"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base">Operating Procedures</div>
              <div className="text-sm text-muted-foreground mt-0.5">{OPERATING_FORMS.length} procedures</div>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <button
            onClick={() => setLocation('/ism/emergency')}
            className="w-full flex items-center gap-4 p-5 rounded-xl border border-destructive/30 bg-card hover:bg-destructive/5 active:bg-destructive/10 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base">Emergency Procedures</div>
              <div className="text-sm text-muted-foreground mt-0.5">{EMERGENCY_FORMS.length} procedures</div>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </MenuLayout>
  )
}