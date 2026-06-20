import React from 'react'

interface PhotoSourcePickerProps {
  open: boolean
  onClose: () => void
  onPick: (files: FileList | null) => void
  /** When true, the dialog accepts ANY file type (not just images) on "Choose file" */
  allowAnyFile?: boolean
  /** When true, the file inputs allow multiple selection */
  multiple?: boolean
}

/**
 * Bottom-sheet that asks the user how they want to provide a photo:
 *   - Take Photo (camera)
 *   - Choose from Library (image picker)
 *   - Choose File (any file)
 *
 * Renders 3 hidden <input type="file"> elements with different accept/capture
 * combos so iOS Safari opens the right native picker for each one.
 */
export function PhotoSourcePicker({ open, onClose, onPick, allowAnyFile = true, multiple = false }: PhotoSourcePickerProps) {
  const cameraRef = React.useRef<HTMLInputElement | null>(null)
  const libraryRef = React.useRef<HTMLInputElement | null>(null)
  const fileRef = React.useRef<HTMLInputElement | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    e.target.value = ''
    onClose()
    onPick(files)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border p-3 space-y-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-base font-semibold pb-2 border-b border-border px-1">Add photo</div>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="w-full h-12 rounded-lg bg-secondary text-foreground font-medium flex items-center gap-3 px-4 text-left"
        >
          <span className="text-xl">📷</span>
          <div className="flex-1">
            <div>Take Photo</div>
            <div className="text-xs text-muted-foreground">Use the camera</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          className="w-full h-12 rounded-lg bg-secondary text-foreground font-medium flex items-center gap-3 px-4 text-left"
        >
          <span className="text-xl">🖼️</span>
          <div className="flex-1">
            <div>Choose from Library</div>
            <div className="text-xs text-muted-foreground">Pick from photo gallery</div>
          </div>
        </button>
        {allowAnyFile && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-12 rounded-lg bg-secondary text-foreground font-medium flex items-center gap-3 px-4 text-left"
          >
            <span className="text-xl">📁</span>
            <div className="flex-1">
              <div>Choose File</div>
              <div className="text-xs text-muted-foreground">Browse files on this device</div>
            </div>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 rounded-lg text-muted-foreground text-sm mt-1"
        >
          Cancel
        </button>

        {/* Hidden inputs — separate elements so iOS opens the correct native picker */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
        />
        <input
          ref={fileRef}
          type="file"
          accept={allowAnyFile ? '*/*' : 'image/*'}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
