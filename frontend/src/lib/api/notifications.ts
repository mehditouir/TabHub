import { apiFetch } from './client'

/** Competing-consumer ACK: first caller wins, 409 means already taken. */
export function ackNotification(id: string) {
  return apiFetch<void>(`/notifications/${id}/ack`, { method: 'PUT' })
}
