import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { makeToken } from '@/test/mocks/handlers'
import { Login } from './Login'

const BASE = 'http://localhost:5000'

// useNavigate needs to be inside a Router context
function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login page', () => {
  it('renders the sign-in form', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Sign in to TabHub' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tenant (slug)')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows loading state while submitting', async () => {
    // Delay the response so we can observe loading
    server.use(
      http.post(`${BASE}/auth/login`, async () => {
        await new Promise(r => setTimeout(r, 50))
        const token = makeToken({ sub: 'mgr@cafe.com', display_name: 'Mgr', role: 'owner', tenant_id: 't1' })
        return HttpResponse.json({ accessToken: token, manager: { id: '1', email: 'mgr@cafe.com', displayName: 'Mgr' } })
      }),
    )

    renderLogin()
    await userEvent.type(screen.getByLabelText('Tenant (slug)'), 'cafejasmine')
    await userEvent.type(screen.getByLabelText('Email'), 'mgr@cafe.com')
    await userEvent.type(screen.getByLabelText('Password'), 'pass')

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  })

  it('shows error message on failed login', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 }),
      ),
    )

    renderLogin()
    await userEvent.type(screen.getByLabelText('Tenant (slug)'), 'cafejasmine')
    await userEvent.type(screen.getByLabelText('Email'), 'bad@email.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument())
  })

  it('stores token and tenant in localStorage on success', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText('Tenant (slug)'), 'cafejasmine')
    await userEvent.type(screen.getByLabelText('Email'), 'manager@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'pass')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(localStorage.getItem('tabhub_token')).toBeTruthy())
    expect(localStorage.getItem('tabhub_tenant')).toBe('cafejasmine')
  })
})
