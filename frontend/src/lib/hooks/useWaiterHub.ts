// SignalR hub hook for the waiter web app.
// Mirrors the mobile useWaiterHub but uses tabhub_token/tabhub_tenant from localStorage.
// Groups are assigned server-side on connect based on the staff JWT:
//   - tenant_{schema}       (all tenant events)
//   - staff_{staffId}       (zone-targeted notifications)

import { useEffect, useRef, useState, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { hubUrl } from '@/lib/api/client'
import { getOrders } from '@/lib/api/orders'
import type { Order, PendingAlert } from '@/lib/types'

export function useWaiterHub(enabled: boolean) {
  const [orders,    setOrders]    = useState<Order[]>([])
  const [alerts,    setAlerts]    = useState<PendingAlert[]>([])
  const [connected, setConnected] = useState(false)
  const connRef = useRef<signalR.HubConnection | null>(null)

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('tabhub_token')) return
    try {
      setOrders(await getOrders())
    } catch { /* ignore */ }
  }, [])

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  useEffect(() => {
    if (!enabled) return

    refresh()

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl())
      .withAutomaticReconnect()
      .build()

    connection.on('OrderPlaced', (order: Order) => {
      setOrders(prev => [order, ...prev])
    })

    connection.on('OrderStatusChanged', (updated: Order) => {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    })

    connection.on('OrderCancelled', (cancelled: Order) => {
      setOrders(prev => prev.map(o => o.id === cancelled.id ? cancelled : o))
    })

    connection.on('NewOrderNotification', (payload: { notificationId: string; order: Order }) => {
      setAlerts(prev => [{
        id:          payload.notificationId,
        type:        'NewOrder',
        tableId:     payload.order.tableId,
        tableNumber: payload.order.tableNumber,
        orderId:     payload.order.id,
        order:       payload.order,
        createdAt:   new Date().toISOString(),
      }, ...prev])
      setOrders(prev => prev.find(o => o.id === payload.order.id) ? prev : [payload.order, ...prev])
    })

    connection.on('WaiterCalled', (payload: { tableId: string; tableNumber: string }) => {
      setAlerts(prev => [{
        id: crypto.randomUUID(), type: 'WaiterCalled',
        tableId: payload.tableId, tableNumber: payload.tableNumber,
        orderId: null, order: null, createdAt: new Date().toISOString(),
      }, ...prev])
    })

    connection.on('BillRequested', (payload: { tableId: string; tableNumber: string }) => {
      setAlerts(prev => [{
        id: crypto.randomUUID(), type: 'BillRequested',
        tableId: payload.tableId, tableNumber: payload.tableNumber,
        orderId: null, order: null, createdAt: new Date().toISOString(),
      }, ...prev])
    })

    connection.onreconnected(() => { setConnected(true); refresh() })
    connection.onclose(() => setConnected(false))
    connection.start().then(() => setConnected(true)).catch(console.error)

    connRef.current = connection
    return () => { connection.stop() }
  }, [enabled, refresh])

  return { orders, setOrders, alerts, connected, refresh, dismissAlert }
}
