import { apiFetch } from './client'
import type { StaffLoginResponse } from '../types'

export function staffPinLogin(tenant: string, pin: string) {
  return apiFetch<StaffLoginResponse>(
    '/auth/staff/pin-login',
    { method: 'POST', body: JSON.stringify({ pin }) },
    tenant,
  )
}
