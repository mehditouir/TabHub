import { apiFetch } from './client'
import type { LoginResponse, StaffLoginResponse } from '@/lib/types'

export function login(tenant: string, email: string, password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, tenant)
}

export function logout(tenant: string) {
  return apiFetch<void>('/auth/logout', { method: 'POST' }, tenant)
}

export function staffPinLogin(tenant: string, pin: string) {
  return apiFetch<StaffLoginResponse>(
    '/auth/staff/pin-login',
    { method: 'POST', body: JSON.stringify({ pin }) },
    tenant,
  )
}
