import React from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'

export function SuccessPage() {
  const [, setLocation] = useLocation()

  return (
    <MenuLayout title="Saved">
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Log Saved</h2>
          <p className="text-muted-foreground mt-2">
            Engine readings have been recorded to the Google Sheet.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Button
            onClick={() => setLocation('/runlog/upload')}
            className="w-full h-12"
          >
            New Entry
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation('/menu')}
            className="w-full h-12"
          >
            Back to Menu
          </Button>
        </div>
      </div>
    </MenuLayout>
  )
}