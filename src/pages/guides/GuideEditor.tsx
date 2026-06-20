import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MenuLayout } from '@/components/MenuLayout'
import { GuideMarkdown } from '@/components/GuideMarkdown'
import { FieldCombo } from '@/components/FieldCombo'
import { Button } from '@/components/ui/button'
import { fetchGuide, prettifyGuide, saveGuide, uploadGuidePhoto, GUIDE_CATEGORIES } from '@/lib/guides'
import { getCrewName } from '@/lib/auth'

type PhotoEntry = {
  id: string
  url: string
  caption: string
  uploading?: boolean
  error?: string
}

type Step = {
  id: string
  text: string
  photos: PhotoEntry[]
}

type Mode = 'one' | 'step'
type Stage = 'edit' | 'preview' | 'saving'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      // strip "data:image/...;base64,"
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function GuideEditorPage() {
  const [, params] = useRoute('/guides/:id/edit')
  const [, paramsNew] = useRoute('/guides/new')
  const editingId = params?.id || ''
  const isNew = !!paramsNew || !editingId
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const { data: existing } = useQuery({
    queryKey: ['guide', editingId],
    queryFn: () => fetchGuide(editingId),
    enabled: !!editingId,
  })

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [mode, setMode] = useState<Mode>('one')

  // One-form mode state
  const [draft, setDraft] = useState('')
  const [photos, setPhotos] = useState<PhotoEntry[]>([])

  // Step-by-step mode state
  const [steps, setSteps] = useState<Step[]>([{ id: uid(), text: '', photos: [] }])

  // Output
  const [stage, setStage] = useState<Stage>('edit')
  const [markdown, setMarkdown] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [versionNote, setVersionNote] = useState('')

  // When editing, pre-fill with the existing markdown (treat as one-form mode)
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (isNew || hydratedRef.current || !existing) return
    hydratedRef.current = true
    setTitle(existing.Title || '')
    setCategory(existing.Category || '')
    setMarkdown(existing.Markdown || '')
    setDraft(existing.Markdown || '')
    setMode('one')
    setStage('preview') // Edit existing → start from preview
  }, [existing, isNew])

  function addPhotoTo(target: 'global' | string, files: FileList | null) {
    if (!files || files.length === 0) return
    const newPhotos: PhotoEntry[] = Array.from(files).map(f => ({
      id: uid(),
      url: '',
      caption: '',
      uploading: true,
    }))

    if (target === 'global') {
      setPhotos(prev => [...prev, ...newPhotos])
    } else {
      setSteps(prev => prev.map(s => s.id === target ? { ...s, photos: [...s.photos, ...newPhotos] } : s))
    }

    // Upload each
    Array.from(files).forEach(async (file, idx) => {
      const localId = newPhotos[idx].id
      try {
        const b64 = await fileToBase64(file)
        const url = await uploadGuidePhoto(b64, title || 'guide')
        if (target === 'global') {
          setPhotos(prev => prev.map(p => p.id === localId ? { ...p, url, uploading: false } : p))
        } else {
          setSteps(prev => prev.map(s => s.id === target
            ? { ...s, photos: s.photos.map(p => p.id === localId ? { ...p, url, uploading: false } : p) }
            : s,
          ))
        }
      } catch (e: any) {
        const err = e?.message || 'Upload failed'
        if (target === 'global') {
          setPhotos(prev => prev.map(p => p.id === localId ? { ...p, uploading: false, error: err } : p))
        } else {
          setSteps(prev => prev.map(s => s.id === target
            ? { ...s, photos: s.photos.map(p => p.id === localId ? { ...p, uploading: false, error: err } : p) }
            : s,
          ))
        }
      }
    })
  }

  function removePhoto(target: 'global' | string, id: string) {
    if (target === 'global') {
      setPhotos(prev => prev.filter(p => p.id !== id))
    } else {
      setSteps(prev => prev.map(s => s.id === target ? { ...s, photos: s.photos.filter(p => p.id !== id) } : s))
    }
  }

  function updatePhotoCaption(target: 'global' | string, id: string, caption: string) {
    if (target === 'global') {
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p))
    } else {
      setSteps(prev => prev.map(s => s.id === target
        ? { ...s, photos: s.photos.map(p => p.id === id ? { ...p, caption } : p) }
        : s,
      ))
    }
  }

  function buildDraftAndPhotos(): { draft: string; photos: { url: string; caption: string }[] } {
    if (mode === 'one') {
      return {
        draft: draft.trim(),
        photos: photos.filter(p => p.url).map(p => ({ url: p.url, caption: p.caption || '' })),
      }
    }
    // step mode → assemble draft as "Step 1: ...\n  [photos]\nStep 2: ..."
    const lines: string[] = []
    const allPhotos: { url: string; caption: string }[] = []
    steps.forEach((s, i) => {
      if (s.text.trim() || s.photos.some(p => p.url)) {
        lines.push(`Step ${i + 1}: ${s.text.trim()}`)
        s.photos.forEach(p => {
          if (p.url) {
            const cap = p.caption || `step ${i + 1}`
            lines.push(`[photo: ${cap}]`)
            allPhotos.push({ url: p.url, caption: cap })
          }
        })
        lines.push('')
      }
    })
    return { draft: lines.join('\n'), photos: allPhotos }
  }

  async function runPrettify() {
    setError(null)
    if (!title.trim()) {
      setError('Please add a title first.')
      return
    }
    const { draft: rawDraft, photos: rawPhotos } = buildDraftAndPhotos()
    if (!rawDraft.trim() && rawPhotos.length === 0) {
      setError('Add some text or photos before generating.')
      return
    }
    setBusy(true)
    try {
      const result = await prettifyGuide({
        title: title.trim(),
        category: category.trim(),
        draft: rawDraft,
        photos: rawPhotos,
      })
      setMarkdown(result.markdown)
      setStage('preview')
    } catch (e: any) {
      setError(e?.message || 'AI prettify failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!title.trim() || !markdown.trim()) {
      setError('Title and content are required.')
      return
    }
    setError(null)
    setStage('saving')
    try {
      const result = await saveGuide({
        id: editingId || undefined,
        title: title.trim(),
        category: category.trim(),
        markdown,
        note: versionNote.trim() || undefined,
        user: getCrewName() || 'crew',
      })
      queryClient.invalidateQueries({ queryKey: ['guides'] })
      queryClient.invalidateQueries({ queryKey: ['guide', result.id] })
      setLocation(`/guides/${result.id}`)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
      setStage('preview')
    }
  }

  // PREVIEW stage
  if (stage === 'preview' || stage === 'saving') {
    return (
      <MenuLayout title="Review" showBack backHref={isNew ? '/guides/new' : `/guides/${editingId}`}>
        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm font-semibold"
          />
          <FieldCombo
            h={10}
            label="Category"
            value={category}
            options={GUIDE_CATEGORIES}
            onChange={setCategory}
          />

          <div className="text-xs text-muted-foreground">
            Edit the markdown directly, or go back to add more content.
          </div>
          <textarea
            value={markdown}
            onChange={e => setMarkdown(e.target.value)}
            rows={14}
            spellCheck
            className="w-full p-3 rounded-lg bg-card border border-border text-sm font-mono"
          />

          <details className="rounded-lg border border-border bg-card/40 px-3 py-2">
            <summary className="text-sm cursor-pointer">Live preview</summary>
            <div className="mt-3">
              <GuideMarkdown>{markdown}</GuideMarkdown>
            </div>
          </details>

          <input
            value={versionNote}
            onChange={e => setVersionNote(e.target.value)}
            placeholder="What changed? (optional)"
            className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm"
          />

          {error && (
            <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setStage('edit')} disabled={stage === 'saving'} className="h-11">
              Back to edit
            </Button>
            <Button onClick={handleSave} disabled={stage === 'saving'} className="h-11">
              {stage === 'saving' ? 'Saving…' : 'Post Guide'}
            </Button>
          </div>
        </div>
      </MenuLayout>
    )
  }

  // EDIT stage
  return (
    <MenuLayout title={isNew ? 'New Guide' : 'Edit Guide'} showBack backHref={isNew ? '/guides' : `/guides/${editingId}`}>
      <div className="space-y-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title (e.g. Starting the Main Engines)"
          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm font-semibold"
        />
        <FieldCombo
          h={10}
          label="Category"
          value={category}
          options={GUIDE_CATEGORIES}
          onChange={setCategory}
        />

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setMode('one')}
            className={`flex-1 h-10 text-sm font-medium ${mode === 'one' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Single form
          </button>
          <button
            onClick={() => setMode('step')}
            className={`flex-1 h-10 text-sm font-medium ${mode === 'step' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Step-by-step
          </button>
        </div>

        {mode === 'one' ? (
          <SingleForm
            draft={draft}
            setDraft={setDraft}
            photos={photos}
            onAddPhotos={files => addPhotoTo('global', files)}
            onRemovePhoto={id => removePhoto('global', id)}
            onUpdateCaption={(id, c) => updatePhotoCaption('global', id, c)}
          />
        ) : (
          <StepForm
            steps={steps}
            setSteps={setSteps}
            onAddPhotos={(stepId, files) => addPhotoTo(stepId, files)}
            onRemovePhoto={(stepId, id) => removePhoto(stepId, id)}
            onUpdateCaption={(stepId, id, c) => updatePhotoCaption(stepId, id, c)}
          />
        )}

        {error && (
          <div className="text-red-500 text-sm p-3 rounded-lg border border-red-900/40 bg-red-950/30">{error}</div>
        )}

        <Button onClick={runPrettify} disabled={busy} className="w-full h-12 text-base">
          {busy ? 'Formatting…' : '✨ Format with AI'}
        </Button>
        {!isNew && (
          <Button variant="outline" onClick={() => setStage('preview')} className="w-full h-11">
            Skip AI, edit markdown directly
          </Button>
        )}
      </div>
    </MenuLayout>
  )
}

function SingleForm({
  draft,
  setDraft,
  photos,
  onAddPhotos,
  onRemovePhoto,
  onUpdateCaption,
}: {
  draft: string
  setDraft: (v: string) => void
  photos: PhotoEntry[]
  onAddPhotos: (files: FileList | null) => void
  onRemovePhoto: (id: string) => void
  onUpdateCaption: (id: string, c: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-3">
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={10}
        placeholder="Write your procedure step by step. The AI will turn it into a clean numbered guide with bold key terms, safety callouts, and section headers."
        className="w-full p-3 rounded-lg bg-card border border-border text-sm"
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Photos</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-sm text-primary underline"
          >
            + Add photos
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => {
              onAddPhotos(e.target.files)
              if (fileRef.current) fileRef.current.value = ''
            }}
          />
        </div>
        {photos.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed border-border text-center">
            No photos yet. AI will place each photo where you describe it in the text.
          </div>
        ) : (
          <div className="space-y-2">
            {photos.map(p => (
              <PhotoCard key={p.id} photo={p} onRemove={() => onRemovePhoto(p.id)} onUpdateCaption={c => onUpdateCaption(p.id, c)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StepForm({
  steps,
  setSteps,
  onAddPhotos,
  onRemovePhoto,
  onUpdateCaption,
}: {
  steps: Step[]
  setSteps: (updater: (prev: Step[]) => Step[]) => void
  onAddPhotos: (stepId: string, files: FileList | null) => void
  onRemovePhoto: (stepId: string, id: string) => void
  onUpdateCaption: (stepId: string, id: string, c: string) => void
}) {
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <StepCard
          key={s.id}
          index={i}
          step={s}
          canRemove={steps.length > 1}
          onUpdateText={t => setSteps(prev => prev.map(x => x.id === s.id ? { ...x, text: t } : x))}
          onRemoveStep={() => setSteps(prev => prev.filter(x => x.id !== s.id))}
          onAddPhotos={files => onAddPhotos(s.id, files)}
          onRemovePhoto={id => onRemovePhoto(s.id, id)}
          onUpdateCaption={(id, c) => onUpdateCaption(s.id, id, c)}
        />
      ))}
      <button
        onClick={() => setSteps(prev => [...prev, { id: uid(), text: '', photos: [] }])}
        className="w-full h-11 rounded-lg border border-dashed border-border text-sm text-muted-foreground"
      >
        + Add step
      </button>
    </div>
  )
}

function StepCard({
  index,
  step,
  canRemove,
  onUpdateText,
  onRemoveStep,
  onAddPhotos,
  onRemovePhoto,
  onUpdateCaption,
}: {
  index: number
  step: Step
  canRemove: boolean
  onUpdateText: (t: string) => void
  onRemoveStep: () => void
  onAddPhotos: (files: FileList | null) => void
  onRemovePhoto: (id: string) => void
  onUpdateCaption: (id: string, c: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="p-3 rounded-xl border border-border bg-card space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">Step {index + 1}</div>
        {canRemove && (
          <button onClick={onRemoveStep} className="text-xs text-red-400 underline">Remove</button>
        )}
      </div>
      <textarea
        value={step.text}
        onChange={e => onUpdateText(e.target.value)}
        rows={3}
        placeholder={`Describe step ${index + 1}…`}
        className="w-full p-3 rounded-lg bg-background border border-border text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{step.photos.length} photo(s)</span>
        <button onClick={() => fileRef.current?.click()} className="text-xs text-primary underline">+ Add photo</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            onAddPhotos(e.target.files)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
      </div>
      {step.photos.length > 0 && (
        <div className="space-y-2">
          {step.photos.map(p => (
            <PhotoCard
              key={p.id}
              photo={p}
              onRemove={() => onRemovePhoto(p.id)}
              onUpdateCaption={c => onUpdateCaption(p.id, c)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoCard({
  photo,
  onRemove,
  onUpdateCaption,
}: {
  photo: PhotoEntry
  onRemove: () => void
  onUpdateCaption: (c: string) => void
}) {
  return (
    <div className="flex gap-2 items-start p-2 rounded-lg border border-border bg-background">
      <div className="w-16 h-16 rounded-md bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
        {photo.uploading ? (
          <span className="text-xs text-muted-foreground">…</span>
        ) : photo.error ? (
          <span className="text-xs text-red-400">!</span>
        ) : photo.url ? (
          <img src={photo.url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">?</span>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <input
          value={photo.caption}
          onChange={e => onUpdateCaption(e.target.value)}
          placeholder="Caption (helps AI place it correctly)"
          className="w-full h-8 px-2 rounded bg-card border border-border text-xs"
        />
        {photo.error && (
          <div className="text-xs text-red-400 truncate">{photo.error}</div>
        )}
        <button onClick={onRemove} className="text-xs text-red-400 underline">Remove</button>
      </div>
    </div>
  )
}
