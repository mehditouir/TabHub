import { apiFetch } from './client'
import type { RevenueReport, TopItem, OrderSummary, BusyHour } from '@/lib/types'

export function getRevenue(from?: Date, to?: Date) {
  const qs = new URLSearchParams()
  if (from) qs.set('from', from.toISOString())
  if (to)   qs.set('to',   to.toISOString())
  return apiFetch<RevenueReport>(`/reports/revenue${qs.size > 0 ? `?${qs}` : ''}`)
}

export function getTopItems(limit = 10) {
  return apiFetch<TopItem[]>(`/reports/top-items?limit=${limit}`)
}

export function getOrderSummary() {
  return apiFetch<OrderSummary>('/reports/orders/summary')
}

export function getBusiestHours() {
  return apiFetch<BusyHour[]>('/reports/busiest-hours')
}
