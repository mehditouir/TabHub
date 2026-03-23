import { apiFetch } from './client'
import type { Session } from '@/lib/types'

export function getSessions(params?: { isOpen?: boolean }) {
  const qs = params?.isOpen !== undefined ? `?isOpen=${params.isOpen}` : ''
  return apiFetch<Session[]>(`/sessions${qs}`)
}

export function closeSession(id: string) {
  return apiFetch<Session>(`/sessions/${id}/close`, { method: 'PUT' })
}

export function moveSession(id: string, newTableId: string) {
  return apiFetch<Session>(`/sessions/${id}/move`, {
    method: 'PUT',
    body: JSON.stringify({ newTableId }),
  })
}

export function mergeSession(id: string, sourceSessionId: string) {
  return apiFetch<Session>(`/sessions/${id}/merge`, {
    method: 'PUT',
    body: JSON.stringify({ sourceSessionId }),
  })
}
