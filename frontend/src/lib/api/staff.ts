import { apiFetch } from './client'
import type { StaffMember, WaiterZone } from '@/lib/types'

export function getStaff() {
  return apiFetch<StaffMember[]>('/staff')
}

export function createStaff(data: { displayName: string; role: string; pin: string }) {
  return apiFetch<StaffMember>('/staff', { method: 'POST', body: JSON.stringify(data) })
}

export function updateStaff(id: string, data: { displayName: string; role: string; isActive: boolean }) {
  return apiFetch<StaffMember>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function setStaffPin(id: string, pin: string) {
  return apiFetch<void>(`/staff/${id}/pin`, { method: 'PUT', body: JSON.stringify({ pin }) })
}

export function deleteStaff(id: string) {
  return apiFetch<void>(`/staff/${id}`, { method: 'DELETE' })
}

// ── Waiter zones ──────────────────────────────────────────────────────────────

export function getWaiterZones(staffId: string) {
  return apiFetch<WaiterZone[]>(`/staff/${staffId}/zones`)
}

export function createWaiterZone(staffId: string, data: {
  spaceId: string; colStart: number; colEnd: number; rowStart: number; rowEnd: number
}) {
  return apiFetch<WaiterZone>(`/staff/${staffId}/zones`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deleteWaiterZone(staffId: string, zoneId: string) {
  return apiFetch<void>(`/staff/${staffId}/zones/${zoneId}`, { method: 'DELETE' })
}
