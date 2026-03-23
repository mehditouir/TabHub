import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FIXTURES } from '@/test/mocks/fixtures'
import { OrderCard } from './OrderCard'

describe('OrderCard', () => {
  const mockOnUpdated   = vi.fn()
  const mockOnCancelled = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders table number and items', () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByText('Table 5')).toBeInTheDocument()
    expect(screen.getByText('Cappuccino')).toBeInTheDocument()
    expect(screen.getByText('Croissant')).toBeInTheDocument()
  })

  it('renders item quantity', () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByText('2×')).toBeInTheDocument()
  })

  it('renders item notes', () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByText('(extra butter)')).toBeInTheDocument()
  })

  it('renders total price', () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByText('12.500 TND')).toBeInTheDocument()
  })

  it('shows Pending status badge', () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows advance button for Pending order', () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByRole('button', { name: 'Mark In Progress' })).toBeInTheDocument()
  })

  it('shows Cancel button for non-terminal order', () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('does not show Cancel button for Completed order', () => {
    render(<OrderCard order={FIXTURES.orderCompleted} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('does not show advance button for Completed order', () => {
    render(<OrderCard order={FIXTURES.orderCompleted} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.queryByText(/^Mark/)).not.toBeInTheDocument()
  })

  it('calls onUpdated after advancing status', async () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    await userEvent.click(screen.getByRole('button', { name: 'Mark In Progress' }))
    await waitFor(() => expect(mockOnUpdated).toHaveBeenCalledOnce())
  })

  it('calls onCancelled after confirming cancellation', async () => {
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(mockOnCancelled).toHaveBeenCalledWith(FIXTURES.order.id))
  })

  it('does not cancel when user dismisses confirm dialog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<OrderCard order={FIXTURES.order} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockOnCancelled).not.toHaveBeenCalled()
  })

  it('shows InProgress status for InProgress order', () => {
    render(<OrderCard order={FIXTURES.orderInProgress} onUpdated={mockOnUpdated} onCancelled={mockOnCancelled} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark Ready' })).toBeInTheDocument()
  })
})
