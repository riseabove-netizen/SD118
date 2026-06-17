import React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none'

    const variants = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
      outline: 'border border-border bg-transparent hover:bg-secondary active:bg-secondary/80 text-foreground',
      ghost: 'bg-transparent hover:bg-secondary active:bg-secondary/80 text-foreground',
      destructive: 'bg-destructive text-primary-foreground hover:bg-destructive/90',
      secondary: 'bg-secondary text-foreground hover:bg-secondary/80',
    }

    const sizes = {
      default: 'h-11 px-4 text-base min-w-[44px]',
      sm: 'h-9 px-3 text-sm min-w-[44px]',
      lg: 'h-14 px-6 text-lg min-w-[44px]',
      icon: 'h-11 w-11',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'