import { useState, useCallback } from 'react'
import { staffPinLogin } from '../api/auth'
import type { StaffUser } from '../types'

function decodeJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return {}
  }
}

function loadUser(): StaffUser | null {
  const token = localStorage.getItem('waiter_token')
  if (!token) return null
  try {
    const claims = decodeJwt(token)
    return {
      staffId:     claims['sub'] as string,
      displayName: claims['name'] as string,
      role:        claims['role'] as string,
      tenantId:    claims['tenant_id'] as string,
      tenant:      localStorage.getItem('waiter_tenant') ?? '',
    }
  } catch {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<StaffUser | null>(loadUser)

  const login = useCallback(async (tenant: string, pin: string) => {
    const res = await staffPinLogin(tenant, pin)
    localStorage.setItem('waiter_token', res.accessToken)
    localStorage.setItem('waiter_tenant', tenant)
    const claims = decodeJwt(res.accessToken)
    setUser({
      staffId:     res.staffId,
      displayName: res.displayName,
      role:        res.role,
      tenantId:    claims['tenant_id'] as string,
      tenant,
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('waiter_token')
    localStorage.removeItem('waiter_tenant')
    setUser(null)
  }, [])

  return { user, login, logout }
}
