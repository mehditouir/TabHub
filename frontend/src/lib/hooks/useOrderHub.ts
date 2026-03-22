// Manages the SignalR connection to the order hub.
// Returns the live order list and unacknowledged notifications, automatically
// updated as events arrive.
//
// Group membership is handled server-side in OnConnectedAsync:
//   - All clients → tenant_{schema}
//   - Manager JWT → manager_{schema}
//   - Staff JWT   → staff_{staffId}
// withAutomaticReconnect() ensures OnConnectedAsync re-runs on reconnect,
// so group membership is automatically restored without extra client logic.

import { useEffect, useRef, useState, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { hubUrl } from '@/lib/api/client'
import { getOrders } from '@/lib/api/orders'
import type { Notification, Order, OrderStatus } from '@/lib/types'

export function useOrderHub(filterStatus?: OrderStatus) {
  const [orders, setOrders]               = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [connected, setConnected]         = useState(false)
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  const visible = filterStatus
    ? orders.filter(o => o.status === filterStatus)
    : orders

  const refresh = useCallback(async () => {
    const fresh = await getOrders()
    setOrders(fresh)
  }, [])

  useEffect(() => {
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

    // Zone-targeted notification for waiters/managers — first-writer-wins ACK
    connection.on('NewOrderNotification', (payload: { notificationId: string; order: Order }) => {
      const notif: Notification = {
        id:                     payload.notificationId,
        eventType:              'OrderPlaced',
        orderId:                payload.order.id,
        tableId:                payload.order.tableId,
        isAcknowledged:         false,
        acknowledgedByStaffId:  null,
        acknowledgedByStaffName: null,
        acknowledgedAt:         null,
        createdAt:              new Date().toISOString(),
        order:                  payload.order,
      }
      setNotifications(prev => [notif, ...prev])
    })

    connection.onreconnected(() => {
      setConnected(true)
      // Refresh order list on reconnect — groups are restored server-side automatically
      refresh()
    })
    connection.onclose(() => setConnected(false))

    connection.start()
      .then(() => setConnected(true))
      .catch(console.error)

    connectionRef.current = connection

    return () => { connection.stop() }
  }, [refresh])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return { orders: visible, notifications, connected, refresh, dismissNotification }
}
