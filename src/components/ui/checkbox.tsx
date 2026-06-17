import React from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  indent?: 0 | 1 | 2
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, indent = 0, id, ...props }, ref) => {
    const paddingLeft = indent === 1 ? 'pl-6' : indent === 2 ? 'pl-12' : ''

    return (
      <label
        htmlFor={id}
        className={cn(
          'flex items-start gap-3 py-3 cursor-pointer select-none active:bg-secondary/50 rounded-lg px-2 -mx-2 transition-colors',
          paddingLeft,
          props.disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex-shrink-0 mt-0.5">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className={cn(
              'h-6 w-6 rounded border-2 border-border bg-input accent-primary cursor-pointer',
              className
            )}
            style={{ accentColor: 'hsl(var(--primary))' }}
            {...props}
          />
        </div>
        {label && (
          <span className="text-base text-foreground leading-snug">{label}</span>
        )}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'