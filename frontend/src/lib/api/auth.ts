import { apiFetch } from './client'
import type { LoginResponse } from '@/lib/types'

export function login(tenant: string, email: string, password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, tenant)
}

export function logout(tenant: string) {
  return apiFetch<void>('/auth/logout', { method: 'POST' }, tenant)
}
