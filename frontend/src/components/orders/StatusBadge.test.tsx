import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, NEXT_STATUS } from './StatusBadge'
import type { OrderStatus } from '@/lib/types'

describe('StatusBadge', () => {
  const cases: [OrderStatus, string][] = [
    ['Pending',    'Pending'],
    ['InProgress', 'In Progress'],
    ['Ready',      'Ready'],
    ['Completed',  'Completed'],
    ['Cancelled',  'Cancelled'],
  ]

  it.each(cases)('renders correct label for %s', (status, expectedLabel) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })
})

describe('NEXT_STATUS', () => {
  it('Pending advances to InProgress', () => {
    expect(NEXT_STATUS['Pending']).toBe('InProgress')
  })

  it('InProgress advances to Ready', () => {
    expect(NEXT_STATUS['InProgress']).toBe('Ready')
  })

  it('Ready advances to Completed', () => {
    expect(NEXT_STATUS['Ready']).toBe('Completed')
  })

  it('Completed has no next status', () => {
    expect(NEXT_STATUS['Completed']).toBeUndefined()
  })

  it('Cancelled has no next status', () => {
    expect(NEXT_STATUS['Cancelled']).toBeUndefined()
  })
})
