// Auth state — reads/writes localStorage, decodes JWT for user info.
// Components call useAuth() to get the current user and login/logout actions.

import { useState, useCallback } from 'react'
import { login as apiLogin, logout as apiLogout } from '@/lib/api/auth'
import type { AuthUser } from '@/lib/types'

const TOKEN_KEY  = 'tabhub_token'
const TENANT_KEY = 'tabhub_tenant'

/** Decode the JWT payload without verifying the signature (client-side only). */
function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return {
      email:       payload.sub,
      displayName: payload.display_name ?? payload.sub,
      role:        payload.role,
      tenantId:    payload.tenant_id,
      tenant:      localStorage.getItem(TENANT_KEY) ?? '',
    }
  } catch {
    return null
  }
}

function loadUser(): AuthUser | null {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? decodeToken(token) : null
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  const login = useCallback(async (tenant: string, email: string, password: string) => {
    const res = await apiLogin(tenant, email, password)
    localStorage.setItem(TOKEN_KEY, res.accessToken)
    localStorage.setItem(TENANT_KEY, tenant)
    setUser(decodeToken(res.accessToken))
  }, [])

  const logout = useCallback(async () => {
    try { await apiLogout(localStorage.getItem(TENANT_KEY) ?? '') } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TENANT_KEY)
    setUser(null)
  }, [])

  return { user, login, logout, isAuthenticated: user !== null }
}
