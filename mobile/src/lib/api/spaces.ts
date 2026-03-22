import { apiFetch } from './client'
import type { Space, Table } from '../types'

export function getSpaces() {
  return apiFetch<Space[]>('/spaces')
}

export function getTables(spaceId?: string) {
  const qs = spaceId ? `?spaceId=${spaceId}` : ''
  return apiFetch<Table[]>(`/tables${qs}`)
}
