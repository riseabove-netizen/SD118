import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { OPERATING_FORMS, EMERGENCY_FORMS } from '@/data/forms-catalog'

export function IsmListPage() {
  const [location, setLocation] = useLocation()
  const category = location.includes('operating') ? 'operating' : 'emergency'

  const isOperating = category === 'operating'
  const forms = isOperating ? OPERATING_FORMS : EMERGENCY_FORMS
  const title = isOperating ? 'Operating Procedures' : 'Emergency Procedures'

  return (
    <MenuLayout title={title} showBack backHref="/ism">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {forms.length} procedures · M/Y Rise Above
          </p>
        </div>

        <div className="space-y-2">
          {forms.map((form, index) => (
            <button
              key={form.formId}
              onClick={() => setLocation(`/ism/form/${form.formId}`)}
              className={`
                w-full flex items-center gap-4 p-4 rounded-xl border bg-card
                hover:bg-secondary active:bg-secondary/80 transition-colors text-left
                ${!isOperating ? 'border-destructive/20 hover:bg-destructive/5' : 'border-border'}
              `}
            >
              <span className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${isOperating ? 'bg-blue-500/10 text-blue-400' : 'bg-destructive/10 text-destructive'}
              `}>
                {index + 1}
              </span>
              <span className="flex-1 text-base font-medium">{form.formName}</span>
              {!isOperating && form.alarmBanner && (
                <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded font-medium flex-shrink-0">
                  ALARM
                </span>
              )}
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </MenuLayout>
  )
}