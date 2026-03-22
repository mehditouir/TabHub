// SignalR hub for the waiter tablet app.
// Maintains the live order list and surfaced alerts (new orders, waiter-called, bill-requested).
// Groups are assigned server-side on connect based on the staff JWT:
//   - tenant_{schema} (all events)
//   - staff_{staffId} (zone-targeted notifications)

import { useEffect, useRef, useState, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { hubUrl } from '../api/client'
import { getOrders } from '../api/orders'
import type { Order, PendingAlert } from '../types'

export function useWaiterHub(enabled: boolean) {
  const [orders, setOrders]   = useState<Order[]>([])
  const [alerts, setAlerts]   = useState<PendingAlert[]>([])
  const [connected, setConnected] = useState(false)
  const connRef = useRef<signalR.HubConnection | null>(null)

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('waiter_token')) return
    try {
      const fresh = await getOrders()
      setOrders(fresh)
    } catch { /* ignore network errors */ }
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

    // Zone-targeted: new order placed at a table in this waiter's zone
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
      setOrders(prev => {
        const exists = prev.find(o => o.id === payload.order.id)
        return exists ? prev : [payload.order, ...prev]
      })
    })

    // Customer pressed "Call Waiter"
    connection.on('WaiterCalled', (payload: { tableId: string; tableNumber: string }) => {
      setAlerts(prev => [{
        id:          crypto.randomUUID(),
        type:        'WaiterCalled',
        tableId:     payload.tableId,
        tableNumber: payload.tableNumber,
        orderId:     null,
        order:       null,
        createdAt:   new Date().toISOString(),
      }, ...prev])
    })

    // Customer pressed "Request Bill"
    connection.on('BillRequested', (payload: { tableId: string; tableNumber: string }) => {
      setAlerts(prev => [{
        id:          crypto.randomUUID(),
        type:        'BillRequested',
        tableId:     payload.tableId,
        tableNumber: payload.tableNumber,
        orderId:     null,
        order:       null,
        createdAt:   new Date().toISOString(),
      }, ...prev])
    })

    connection.onreconnected(() => {
      setConnected(true)
      refresh()
    })
    connection.onclose(() => setConnected(false))

    connection.start()
      .then(() => setConnected(true))
      .catch(console.error)

    connRef.current = connection

    return () => { connection.stop() }
  }, [enabled, refresh])

  return { orders, setOrders, alerts, connected, refresh, dismissAlert }
}
