import { apiFetch } from './client'
import type { Order, CreateOrderRequest, OrderStatus } from '@/lib/types'

// Public — customer places an order via QR token
export function placeOrder(tenant: string, req: CreateOrderRequest) {
  return apiFetch<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(req),
  }, tenant)
}

// Staff — list & manage orders
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

export function updateOrderStatus(id: string, status: OrderStatus) {
  return apiFetch<Order>(`/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function cancelOrder(id: string) {
  return apiFetch<void>(`/orders/${id}`, { method: 'DELETE' })
}

// Public: takeaway board (anonymous, for display screen)
export function getTakeawayBoard(tenant: string) {
  return apiFetch<Order[]>('/orders/takeaway-board', {}, tenant)
}

// Customer anonymous actions
export function callWaiter(tenant: string, qrToken: string) {
  return apiFetch<void>('/orders/call-waiter', {
    method: 'POST',
    body: JSON.stringify({ qrToken }),
  }, tenant)
}

export function requestBill(tenant: string, qrToken: string) {
  return apiFetch<void>('/orders/request-bill', {
    method: 'POST',
    body: JSON.stringify({ qrToken }),
  }, tenant)
}
