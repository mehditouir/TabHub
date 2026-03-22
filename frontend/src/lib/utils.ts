import { clsx, type ClassValue } from 'clsx'

/** Merge Tailwind classes conditionally. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Format a price number as a currency string. */
export function formatPrice(amount: number, currency = 'TND') {
  return `${amount.toFixed(3)} ${currency}`
}

/** Format an ISO date string to a readable local time. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Format an ISO date string to a readable date. */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}
