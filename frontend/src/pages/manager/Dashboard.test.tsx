import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('shows loading state initially', () => {
    render(<Dashboard />)
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
  })

  it('renders KPI cards after load', async () => {
    render(<Dashboard />)
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('renders total orders count', async () => {
    render(<Dashboard />)
    await waitFor(() => screen.getByText('Total'))
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders avg completion time', async () => {
    render(<Dashboard />)
    await waitFor(() => screen.getByText('Average completion time'))
    expect(screen.getByText('18 min')).toBeInTheDocument()
  })

  it('renders revenue section', async () => {
    render(<Dashboard />)
    await waitFor(() => screen.getByText('Revenue — last 30 days'))
    expect(screen.getByText('1250.500 TND')).toBeInTheDocument()
  })

  it('renders top items section', async () => {
    render(<Dashboard />)
    await waitFor(() => screen.getByText('Top selling items'))
    expect(screen.getByText('Cappuccino')).toBeInTheDocument()
    expect(screen.getByText('Croissant')).toBeInTheDocument()
  })

  it('shows sold quantities for top items', async () => {
    render(<Dashboard />)
    await waitFor(() => screen.getByText('80 sold'))
    expect(screen.getByText('45 sold')).toBeInTheDocument()
  })
})
