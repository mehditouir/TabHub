import { apiFetch } from './client'
import type { PublicMenuResponse } from '../types'

/** Public menu — no auth required, uses tenant from localStorage. */
export function getPublicMenu() {
  const tenant = localStorage.getItem('waiter_tenant') ?? ''
  return apiFetch<PublicMenuResponse>('/menu', {}, tenant)
}
