import React from 'react'
import { useLocation, useRoute } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { getDeckhandSection, type DeckhandSection } from '@/data/deckhand-duties'

const TONE_CLASSES: Record<DeckhandSection['tone'], { border: string; accent: string; dot: string }> = {
  blue:   { border: 'border-border',           accent: 'text-blue-400',       dot: 'bg-blue-400' },
  red:    { border: 'border-destructive/30',   accent: 'text-destructive',    dot: 'bg-destructive' },
  orange: { border: 'border-orange-500/30',    accent: 'text-orange-400',     dot: 'bg-orange-400' },
  amber:  { border: 'border-amber-500/30',     accent: 'text-amber-400',      dot: 'bg-amber-400' },
}

export function DeckhandDutiesSectionPage() {
  const [, params] = useRoute<{ sectionId: string }>('/ism/deckhand-duties/:sectionId')
  const [, setLocation] = useLocation()
  const section = params?.sectionId ? getDeckhandSection(params.sectionId) : undefined

  if (!section) {
    return (
      <MenuLayout title="Section not found" showBack backHref="/ism/deckhand-duties">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">The requested duties section could not be found.</p>
          <button
            onClick={() => setLocation('/ism/deckhand-duties')}
            className="text-primary underline"
          >
            Back to Exterior Daily Duties
          </button>
        </div>
      </MenuLayout>
    )
  }

  const tone = TONE_CLASSES[section.tone]

  return (
    <MenuLayout title={section.title} showBack backHref="/ism/deckhand-duties">
      <div className="space-y-6">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wide ${tone.accent}`}>
            Deckhand Duties SOP
          </div>
          <h2 className="text-xl font-bold mt-1">{section.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
        </div>

        <div className={`rounded-xl border ${tone.border} bg-card p-4 sm:p-5`}>
          <ol className="space-y-3">
            {section.items.map((item, idx) => (
              <li key={idx} className="flex gap-3 items-start">
                <div className="flex-shrink-0 mt-1.5">
                  <div className={`w-2 h-2 rounded-full ${tone.dot}`} />
                </div>
                <div className="flex-1 text-sm leading-relaxed">
                  <span className="text-muted-foreground font-mono text-xs mr-2">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {item}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {section.items.length} {section.items.length === 1 ? 'duty' : 'duties'} · M/Y Rise Above
        </p>
      </div>
    </MenuLayout>
  )
}
