import { apiFetch } from './client'
import type { WaiterZone } from '../types'

export function getMyZones(staffId: string) {
  return apiFetch<WaiterZone[]>(`/staff/${staffId}/zones`)
}
