import { apiFetch } from './client'
import type { Order, OrderStatus, CartItem } from '../types'

export function getOrders(params?: { status?: OrderStatus; tableId?: string }) {
  const qs = new URLSearchParams()
  if (params?.status)  qs.set('status', params.status)
  if (params?.tableId) qs.set('tableId', params.tableId)
  const query = qs.size > 0 ? `?${qs}` : ''
  return apiFetch<Order[]>(`/orders${query}`)
}

export function getOrder(id: string) {
  return apiFetch<Order>(`/orders/${id}`)
}

/** Waiter / cashier: place order directly at InProgress, no QR token needed. */
export function placeStaffOrder(tableId: string, items: CartItem[], sessionId?: string, notes?: string) {
  return apiFetch<Order>('/orders/staff', {
    method: 'POST',
    body: JSON.stringify({
      tableId,
      items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || undefined })),
      ...(sessionId ? { sessionId } : {}),
      ...(notes ? { notes } : {}),
    }),
  })
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  return apiFetch<Order>(`/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function cancelOrder(id: string) {
  return apiFetch<void>(`/orders/${id}`, { method: 'DELETE' })
}
