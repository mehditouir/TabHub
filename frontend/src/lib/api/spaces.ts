import { apiFetch } from './client'
import type { Space, Table, TableResolveResponse } from '@/lib/types'

// Public: resolve a QR token to tableId + tableNumber (no auth required)
export function resolveTable(tenant: string, qrToken: string) {
  return apiFetch<TableResolveResponse>(`/tables/resolve?qrToken=${qrToken}`, {}, tenant)
}

export function getSpaces() {
  return apiFetch<Space[]>('/spaces')
}

export function createSpace(data: { name: string; cols: number; rows: number; sortOrder?: number }) {
  return apiFetch<Space>('/spaces', {
    method: 'POST',
    body: JSON.stringify({ sortOrder: 0, ...data }),
  })
}

export function updateSpace(id: string, data: { name: string; cols: number; rows: number; sortOrder: number; isActive: boolean }) {
  return apiFetch<Space>(`/spaces/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteSpace(id: string) {
  return apiFetch<void>(`/spaces/${id}`, { method: 'DELETE' })
}

export function getTables(spaceId?: string) {
  const qs = spaceId ? `?spaceId=${spaceId}` : ''
  return apiFetch<Table[]>(`/tables${qs}`)
}

export function createTable(data: { spaceId: string; number: string; col: number; row: number }) {
  return apiFetch<Table>('/tables', { method: 'POST', body: JSON.stringify(data) })
}

export function updateTable(id: string, data: { number: string; col: number; row: number; isActive: boolean }) {
  return apiFetch<Table>(`/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteTable(id: string) {
  return apiFetch<void>(`/tables/${id}`, { method: 'DELETE' })
}
