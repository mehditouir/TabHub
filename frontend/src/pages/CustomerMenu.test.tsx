import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { CustomerMenu } from './CustomerMenu'

const BASE = 'http://localhost:5000'

function renderMenu(tenant = 'cafejasmine', tableParam = '?table=qr-token-123') {
  return render(
    <MemoryRouter initialEntries={[`/menu/${tenant}${tableParam}`]}>
      <Routes>
        <Route path="/menu/:tenant" element={<CustomerMenu />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CustomerMenu', () => {
  it('shows loading state initially', () => {
    renderMenu()
    expect(screen.getByText('Loading menu…')).toBeInTheDocument()
  })

  it('renders menu categories and items after load', async () => {
    renderMenu()
    await waitFor(() => expect(screen.getByText('Hot Drinks')).toBeInTheDocument())
    expect(screen.getByText('Cappuccino')).toBeInTheDocument()
    expect(screen.getByText('Pastries')).toBeInTheDocument()
    expect(screen.getByText('Croissant')).toBeInTheDocument()
  })

  it('shows item price', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Cappuccino'))
    expect(screen.getByText('4.500 TND')).toBeInTheDocument()
  })

  it('shows item description when available', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Espresso with steamed milk'))
  })

  it('shows error message when API fails', async () => {
    server.use(
      http.get(`${BASE}/menu`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
    )
    renderMenu()
    await waitFor(() => expect(screen.getByText('Unable to load menu. Please try again.')).toBeInTheDocument())
  })

  it('adds item to cart and shows floating cart', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Cappuccino'))

    const addButtons = screen.getAllByRole('button', { name: '+ Add' })
    await userEvent.click(addButtons[0])

    expect(screen.getByText(/1×/)).toBeInTheDocument()
    expect(screen.getByText(/Place order/)).toBeInTheDocument()
  })

  it('increments cart count when same item added again', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Cappuccino'))

    const addButtons = screen.getAllByRole('button', { name: '+ Add' })
    await userEvent.click(addButtons[0])
    await userEvent.click(addButtons[0])

    expect(screen.getByText(/2×/)).toBeInTheDocument()
  })

  it('removes item from cart when ✕ is clicked', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Cappuccino'))

    const addButtons = screen.getAllByRole('button', { name: '+ Add' })
    await userEvent.click(addButtons[0])

    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByText(/1×/)).not.toBeInTheDocument()
  })

  it('shows order confirmation after successful order', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Cappuccino'))

    const addButtons = screen.getAllByRole('button', { name: '+ Add' })
    await userEvent.click(addButtons[0])
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => expect(screen.getByText('Your order has been received')).toBeInTheDocument())
  })

  it('shows "Order more" button after order success', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Cappuccino'))

    const addButtons = screen.getAllByRole('button', { name: '+ Add' })
    await userEvent.click(addButtons[0])
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => screen.getByRole('button', { name: 'Order more items' }))
  })

  it('returns to menu when "Order more" is clicked', async () => {
    renderMenu()
    await waitFor(() => screen.getByText('Cappuccino'))

    const addButtons = screen.getAllByRole('button', { name: '+ Add' })
    await userEvent.click(addButtons[0])
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => screen.getByRole('button', { name: 'Order more items' }))
    await userEvent.click(screen.getByRole('button', { name: 'Order more items' }))

    expect(screen.getByText('Hot Drinks')).toBeInTheDocument()
  })

  it('disables Place order when no qrToken in URL', async () => {
    renderMenu('cafejasmine', '') // no ?table= param
    await waitFor(() => screen.getByText('Cappuccino'))

    const addButtons = screen.getAllByRole('button', { name: '+ Add' })
    await userEvent.click(addButtons[0])

    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled()
    expect(screen.getByText('No table QR token found in URL.')).toBeInTheDocument()
  })
})
