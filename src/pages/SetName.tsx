import React, { useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setCrewName } from '@/lib/auth'

export function SetNamePage() {
  const [, setLocation] = useLocation()
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCrewName(name.trim())
    setLocation('/menu')
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Your Name</h1>
          <p className="text-muted-foreground mt-2">
            This will be used as your signature on all ISM forms.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g. John Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              autoComplete="name"
              className="h-14 text-lg"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-base"
            disabled={!name.trim()}
          >
            Continue
          </Button>
        </form>
      </div>
    </div>
  )
}