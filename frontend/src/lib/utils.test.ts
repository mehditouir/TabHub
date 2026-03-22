import { describe, it, expect } from 'vitest'
import { cn, formatPrice, formatTime, formatDate } from './utils'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignores falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('handles conditional objects', () => {
    expect(cn({ active: true, hidden: false })).toBe('active')
  })

  it('returns empty string for no args', () => {
    expect(cn()).toBe('')
  })
})

describe('formatPrice', () => {
  it('formats with 3 decimal places and TND suffix', () => {
    expect(formatPrice(4.5)).toBe('4.500 TND')
  })

  it('uses custom currency', () => {
    expect(formatPrice(10, 'EUR')).toBe('10.000 EUR')
  })

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('0.000 TND')
  })

  it('handles large numbers', () => {
    expect(formatPrice(1250.5)).toBe('1250.500 TND')
  })
})

describe('formatTime', () => {
  it('returns HH:MM string from ISO date', () => {
    // Use a date with a predictable UTC hour
    const result = formatTime('2026-01-15T10:30:00Z')
    // Result depends on system locale, but should be a time string (contain ':')
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatDate', () => {
  it('returns a readable date string from ISO date', () => {
    const result = formatDate('2026-01-15T10:30:00Z')
    // Should contain '2026' and be non-empty
    expect(result).toContain('2026')
    expect(result.length).toBeGreaterThan(4)
  })
})
