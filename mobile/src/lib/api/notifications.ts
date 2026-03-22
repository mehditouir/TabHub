import { apiFetch } from './client'
import type { DbNotification } from '../types'

export function getNotifications() {
  return apiFetch<DbNotification[]>('/notifications')
}

/** Competing-consumer ACK: first caller wins, 409 means already taken. */
export function ackNotification(id: string) {
  return apiFetch<DbNotification>(`/notifications/${id}/ack`, { method: 'PUT' })
}
