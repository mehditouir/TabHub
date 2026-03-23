// Public takeaway display screen — no auth required.
// Route: /takeaway/:tenant
// Shows live takeaway orders grouped by status (Pending → Preparing → Ready).
// Driven by SignalR; falls back to HTTP poll on reconnect.

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import { customerHubUrl } from '@/lib/api/client'
import { getTakeawayBoard } from '@/lib/api/orders'
import type { Order } from '@/lib/types'

const STATUS_COLUMNS: { key: Order['status']; label: string; bg: string; dot: string }[] = [
  { key: 'Pending',    label: 'En attente',  bg: 'bg-yellow-950', dot: 'bg-yellow-400' },
  { key: 'InProgress', label: 'En prépa.',   bg: 'bg-blue-950',   dot: 'bg-blue-400'   },
  { key: 'Ready',      label: 'Prêt',        bg: 'bg-green-950',  dot: 'bg-green-400'  },
]

export function TakeawayDisplay() {
  const { tenant } = useParams<{ tenant: string }>()
  const [orders, setOrders]       = useState<Order[]>([])
  const [connected, setConnected] = useState(false)
  const connectionRef             = useRef<signalR.HubConnection | null>(null)

  const load = useCallback(async () => {
    if (!tenant) return
    try {
      const data = await getTakeawayBoard(tenant)
      setOrders(data)
    } catch {
      // silently ignore — display stays on screen
    }
  }, [tenant])

  useEffect(() => {
    if (!tenant) return

    load()

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(customerHubUrl(tenant))
      .withAutomaticReconnect()
      .build()

    connection.on('OrderPlaced', (order: Order) => {
      if (order.orderType !== 'Takeaway') return
      setOrders(prev => [order, ...prev])
    })

    connection.on('OrderStatusChanged', (updated: Order) => {
      if (updated.orderType !== 'Takeaway') return
      const active: Order['status'][] = ['Pending', 'InProgress', 'Ready']
      setOrders(prev => {
        const without = prev.filter(o => o.id !== updated.id)
        return active.includes(updated.status) ? [...without, updated] : without
      })
    })

    connection.on('OrderCancelled', (cancelled: Order) => {
      setOrders(prev => prev.filter(o => o.id !== cancelled.id))
    })

    connection.onreconnected(() => { setConnected(true); load() })
    connection.onclose(() => setConnected(false))

    connection.start()
      .then(() => setConnected(true))
      .catch(console.error)

    connectionRef.current = connection
    return () => { connection.stop() }
  }, [tenant, load])

  const byStatus = (status: Order['status']) =>
    orders
      .filter(o => o.status === status)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-wide uppercase">Commandes à emporter</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{tenant}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
          <span className="text-zinc-400">{connected ? 'Connecté' : 'Reconnexion…'}</span>
        </div>
      </header>

      {/* Columns */}
      <div className="flex flex-1 divide-x divide-zinc-800">
        {STATUS_COLUMNS.map(col => {
          const items = byStatus(col.key)
          return (
            <div key={col.key} className={`flex-1 flex flex-col ${col.bg}`}>
              {/* Column header */}
              <div className="flex items-center gap-2 px-6 py-4 border-b border-zinc-800">
                <span className={`h-3 w-3 rounded-full ${col.dot}`} />
                <span className="text-lg font-semibold uppercase tracking-wider">{col.label}</span>
                <span className="ms-auto text-2xl font-bold text-zinc-300">{items.length}</span>
              </div>

              {/* Order cards */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {items.length === 0 && (
                  <p className="text-center text-zinc-600 mt-12 text-sm">Aucune commande</p>
                )}
                {items.map(order => (
                  <OrderCard key={order.id} order={order} dotColor={col.dot} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrderCard({ order, dotColor }: { order: Order; dotColor: string }) {
  const time = new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="rounded-xl bg-zinc-900/70 border border-zinc-700 p-4 space-y-3">
      {/* Sequence + time */}
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold tracking-widest">
          #{order.sequenceNumber?.slice(-4) ?? order.id.slice(0, 6).toUpperCase()}
        </span>
        <span className="text-xs text-zinc-500">{time}</span>
      </div>

      {/* Items */}
      <ul className="space-y-1">
        {order.items.map(item => (
          <li key={item.id} className="flex justify-between text-sm">
            <span className="text-zinc-200">
              <span className={`inline-block h-2 w-2 rounded-full ${dotColor} me-1.5 align-middle`} />
              {item.menuItemName}
            </span>
            <span className="text-zinc-400 ml-2">×{item.quantity}</span>
          </li>
        ))}
      </ul>

      {/* Notes */}
      {order.notes && (
        <p className="text-xs text-zinc-500 italic border-t border-zinc-700 pt-2">{order.notes}</p>
      )}
    </div>
  )
}
