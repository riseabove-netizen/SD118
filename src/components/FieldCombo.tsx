import React from 'react'

/**
 * Dropdown that lets the user pick a preset value OR type a new custom one.
 * Pass `options` = full list of known values (presets + previously-used).
 */
export function FieldCombo({
  label,
  value,
  options,
  onChange,
  placeholder,
  h = 11,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  placeholder?: string
  h?: 10 | 11
}) {
  const isCustom = value !== '' && !options.includes(value)
  const [customMode, setCustomMode] = React.useState(isCustom)

  React.useEffect(() => {
    if (value && options.includes(value)) setCustomMode(false)
  }, [value, options])

  const heightCls = h === 10 ? 'h-10' : 'h-11'

  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {customMode ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || 'Type a new value'}
            autoFocus
            className={`flex-1 ${heightCls} px-3 rounded-lg bg-secondary border border-primary`}
          />
          <button
            type="button"
            onClick={() => { onChange(''); setCustomMode(false) }}
            className={`${heightCls} px-3 rounded-lg bg-secondary border border-border text-xs text-muted-foreground`}
            title="Pick from list instead"
          >
            ✕
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={e => {
            const v = e.target.value
            if (v === '__new__') {
              onChange('')
              setCustomMode(true)
            } else {
              onChange(v)
            }
          }}
          className={`w-full ${heightCls} px-3 rounded-lg bg-secondary border border-border`}
        >
          <option value="">— pick one —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="__new__">+ New custom value…</option>
        </select>
      )}
    </div>
  )
}
