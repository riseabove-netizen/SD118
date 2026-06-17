export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

export function formatDateTime(date: Date): string {
  return date.toISOString()
}