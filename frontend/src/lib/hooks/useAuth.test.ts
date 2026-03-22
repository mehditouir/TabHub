import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { makeToken } from '@/test/mocks/handlers'
import { useAuth } from './useAuth'

const BASE = 'http://localhost:5000'

beforeEach(() => {
  localStorage.clear()
})

describe('useAuth', () => {
  it('starts unauthenticated with no stored token', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('loads user from localStorage on mount', () => {
    const token = makeToken({
      sub:          'owner@cafe.com',
      display_name: 'Owner',
      role:         'owner',
      tenant_id:    'tenant-1',
    })
    localStorage.setItem('tabhub_token',  token)
    localStorage.setItem('tabhub_tenant', 'cafejasmine')

    const { result } = renderHook(() => useAuth())
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('owner@cafe.com')
    expect(result.current.user?.role).toBe('owner')
    expect(result.current.user?.tenant).toBe('cafejasmine')
  })

  it('logs in and decodes user from returned token', async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('cafejasmine', 'manager@example.com', 'pass123')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('manager@example.com')
    expect(result.current.user?.role).toBe('owner')
    expect(localStorage.getItem('tabhub_token')).toBeTruthy()
    expect(localStorage.getItem('tabhub_tenant')).toBe('cafejasmine')
  })

  it('throws on login failure', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 }),
      ),
    )

    const { result } = renderHook(() => useAuth())

    await expect(
      act(async () => {
        await result.current.login('cafejasmine', 'bad@email.com', 'wrong')
      }),
    ).rejects.toThrow()
  })

  it('clears state and localStorage on logout', async () => {
    const token = makeToken({ sub: 'mgr@cafe.com', display_name: 'Mgr', role: 'owner', tenant_id: 't1' })
    localStorage.setItem('tabhub_token',  token)
    localStorage.setItem('tabhub_tenant', 'cafejasmine')

    const { result } = renderHook(() => useAuth())
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => { await result.current.logout() })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('tabhub_token')).toBeNull()
    expect(localStorage.getItem('tabhub_tenant')).toBeNull()
  })

  it('still logs out even if API call fails', async () => {
    server.use(
      http.post(`${BASE}/auth/logout`, () => HttpResponse.json({ error: 'Server error' }, { status: 500 })),
    )
    const token = makeToken({ sub: 'mgr@cafe.com', display_name: 'Mgr', role: 'owner', tenant_id: 't1' })
    localStorage.setItem('tabhub_token',  token)
    localStorage.setItem('tabhub_tenant', 'cafejasmine')

    const { result } = renderHook(() => useAuth())

    await act(async () => { await result.current.logout() })

    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('tabhub_token')).toBeNull()
  })
})
