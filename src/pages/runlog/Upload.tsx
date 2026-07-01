import React, { useState, useCallback, useRef } from 'react'
import { useLocation } from 'wouter'
import { MenuLayout } from '@/components/MenuLayout'
import { Button } from '@/components/ui/button'
import { extractFromImages } from '@/lib/api'
import { compressImageToJpegBase64 } from '@/lib/imageCompress'
import { useMutation } from '@tanstack/react-query'

/**
 * Merge multiple extraction responses — for each field, take the first
 * non-null value across the chunks. This lets us split a large photo batch
 * into multiple API calls (to stay under Vercel's 4.5 MB body limit) and
 * still produce a single unified reading set for the review page.
 */
function mergeExtractions(parts: Record<string, unknown>[]): Record<string, unknown> {
  if (parts.length === 0) return {}
  if (parts.length === 1) return parts[0]

  const out: Record<string, unknown> = {}
  for (const p of parts) {
    for (const [k, v] of Object.entries(p)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const existing = (out[k] as Record<string, unknown> | undefined) || {}
        const incoming = v as Record<string, unknown>
        const merged: Record<string, unknown> = { ...existing }
        for (const [ik, iv] of Object.entries(incoming)) {
          if (merged[ik] === undefined || merged[ik] === null || merged[ik] === '') {
            merged[ik] = iv
          }
        }
        out[k] = merged
      } else {
        if (out[k] === undefined || out[k] === null || out[k] === '') out[k] = v
      }
    }
  }
  // Reflect the actual chunking in _meta so we can debug in the field.
  const totalImages = parts.reduce(
    (acc, p) => acc + (((p as any)._meta?.images_processed as number) || 0),
    0,
  )
  out._meta = { chunks: parts.length, images_processed: totalImages }
  return out
}

export function UploadPage() {
  const [, setLocation] = useLocation()
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  // Vercel's request body limit is 4.5 MB. Base64 inflates payload by ~33 %,
  // so we target a per-photo budget of ~450 KB and split into multiple API
  // calls if the batch would exceed the limit — then merge the results.
  const MAX_BODY_BYTES = 4_000_000

  const mutation = useMutation({
    mutationFn: async (fileList: File[]) => {
      // Compress every photo to 1200 px on the long edge at JPEG quality 0.78.
      // Digital engine displays stay crisp — Claude Vision downscales anything
      // larger than ~1568 px anyway, so uploading higher-res wastes bandwidth
      // and tokens without improving accuracy.
      const images: string[] = []
      for (const file of fileList) {
        const b64 = await compressImageToJpegBase64(file, { maxDim: 1200, quality: 0.78 })
        images.push(b64)
      }

      // Split the compressed batch into chunks that each fit under the body
      // limit, run each chunk through the extractor, and deep-merge results.
      const chunks: string[][] = []
      let bucket: string[] = []
      let bucketBytes = 0
      for (const img of images) {
        const bytes = img.length // rough proxy for JSON body cost
        if (bucket.length > 0 && bucketBytes + bytes > MAX_BODY_BYTES) {
          chunks.push(bucket)
          bucket = []
          bucketBytes = 0
        }
        bucket.push(img)
        bucketBytes += bytes
      }
      if (bucket.length > 0) chunks.push(bucket)

      const results: Record<string, unknown>[] = []
      for (const c of chunks) {
        results.push(await extractFromImages(c))
      }
      return mergeExtractions(results)
    },
    onSuccess: data => {
      sessionStorage.setItem('extractedData', JSON.stringify(data))
      setLocation('/runlog/review')
    },
  })

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return
    setFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleSubmit = () => {
    if (files.length > 0) {
      mutation.mutate(files)
    }
  }

  return (
    <MenuLayout title="Running Log" showBack backHref="/menu">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Upload Engine Photos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Take photos of your engine gauges. AI will extract the readings.
          </p>
        </div>

        {/* Hidden file inputs (separate for camera vs library) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          className="hidden"
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          className="hidden"
        />

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="h-20 flex flex-col items-center justify-center gap-1"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span className="text-sm font-medium">Take Photo</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => libraryInputRef.current?.click()}
            className="h-20 flex flex-col items-center justify-center gap-1"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-sm font-medium">Choose Photos</span>
          </Button>
        </div>

        {/* Drop zone (desktop) */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => libraryInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
            ${dragOver ? 'border-primary bg-primary/10' : 'border-border bg-card'}
          `}
        >
          <p className="text-sm text-muted-foreground">
            or drag & drop photos here
          </p>
        </div>

        {/* Selected files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{files.length} file{files.length > 1 ? 's' : ''} selected</p>
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-muted-foreground hover:text-destructive text-xs px-2"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {mutation.isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="text-sm font-medium text-destructive">Extraction failed</p>
            <p className="mt-1 text-xs text-destructive/90 break-words">
              {mutation.error instanceof Error ? mutation.error.message : 'Please try again.'}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Try fewer or smaller photos, retry in a moment, or use “Skip — Fill Manually” below.
            </p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={files.length === 0 || mutation.isPending}
          className="w-full h-14 text-base"
        >
          {mutation.isPending ? 'Extracting readings…' : 'Extract Readings'}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setLocation('/runlog/review')}
          disabled={mutation.isPending}
          className="w-full h-12 text-sm"
        >
          Skip — Fill Manually
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Photos are read by Claude Vision AI to auto-fill engine gauges.
        </p>
      </div>
    </MenuLayout>
  )
}