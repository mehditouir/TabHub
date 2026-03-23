import { apiFetch } from './client'
import type { Order, CreateOrderRequest, OrderStatus } from '@/lib/types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

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

export function placeStaffOrder(tableId: string, items: { menuItemId: string; quantity: number; notes?: string }[], sessionId?: string) {
  return apiFetch<Order>('/orders/staff', {
    method: 'POST',
    body: JSON.stringify({ tableId, items, ...(sessionId ? { sessionId } : {}) }),
  })
}

export function placeTakeawayOrder(items: { menuItemId: string; quantity: number }[], notes?: string) {
  return apiFetch<Order>('/orders/takeaway', {
    method: 'POST',
    body: JSON.stringify({ items, ...(notes ? { notes } : {}) }),
  })
}

export async function fetchBillBlobUrl(orderId: string): Promise<string> {
  const token  = localStorage.getItem('tabhub_token') ?? ''
  const tenant = localStorage.getItem('tabhub_tenant') ?? ''
  const res = await fetch(`${API_URL}/orders/${orderId}/bill.pdf`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant': tenant },
  })
  if (!res.ok) throw new Error('Failed to fetch bill')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
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
