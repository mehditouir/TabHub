import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FIXTURES } from '@/test/mocks/fixtures'
import { StaffOrders } from './Orders'

const mockRefresh = vi.fn()
const mockOrderHub = {
  orders:    [FIXTURES.order, FIXTURES.orderInProgress] as typeof FIXTURES.order[],
  connected: true,
  refresh:   mockRefresh,
}

// Mock useOrderHub — avoids needing a real SignalR server in tests
vi.mock('@/lib/hooks/useOrderHub', () => ({
  useOrderHub: vi.fn(() => mockOrderHub),
}))

// Import after mock so vi.mocked works
import { useOrderHub } from '@/lib/hooks/useOrderHub'

describe('StaffOrders', () => {
  beforeEach(() => {
    vi.mocked(useOrderHub).mockReturnValue({
      orders:    [FIXTURES.order, FIXTURES.orderInProgress],
      connected: true,
      refresh:   mockRefresh,
    })
  })

  it('renders live connection indicator', () => {
    render(<StaffOrders />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders order cards', () => {
    render(<StaffOrders />)
    expect(screen.getByText('Table 5')).toBeInTheDocument()
    expect(screen.getByText('Table 3')).toBeInTheDocument()
  })

  it('renders status filter buttons', () => {
    render(<StaffOrders />)
    for (const label of ['All', 'Pending', 'In Progress', 'Ready', 'Completed']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('renders Refresh button', () => {
    render(<StaffOrders />)
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('shows disconnected state', () => {
    vi.mocked(useOrderHub).mockReturnValueOnce({ orders: [], connected: false, refresh: vi.fn() })
    render(<StaffOrders />)
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument()
  })

  it('shows empty state message when no orders', () => {
    vi.mocked(useOrderHub).mockReturnValueOnce({ orders: [], connected: true, refresh: vi.fn() })
    render(<StaffOrders />)
    expect(screen.getByText('No orders.')).toBeInTheDocument()
  })
})
