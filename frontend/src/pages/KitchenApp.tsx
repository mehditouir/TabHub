// Kitchen display — always-on screen for kitchen staff.
// Route: /kitchen/:tenant
// PIN login → two-column kanban: Pending | InProgress
// Advance orders (Pending → InProgress → Ready) and reject (cancel) them.
// SignalR-driven; live updates without any manual refresh.

import { useState, useEffect, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { StaffPinLogin } from '@/components/StaffPinLogin'
import { hubUrl } from '@/lib/api/client'
import { getOrders, updateOrderStatus, cancelOrder } from '@/lib/api/orders'
import type { Order, OrderStatus, StaffUser } from '@/lib/types'
import { formatTime } from '@/lib/utils'

const COLUMNS: { status: OrderStatus; label: string; next: OrderStatus; accent: string; border: string }[] = [
  { status: 'Pending',    label: 'En attente',   next: 'InProgress', accent: 'text-yellow-400', border: 'border-yellow-900' },
  { status: 'InProgress', label: 'En préparation', next: 'Ready',    accent: 'text-blue-400',   border: 'border-blue-900'   },
]

export function KitchenApp() {
  const [user, setUser] = useState<StaffUser | null>(null)

  if (!user) {
    return <StaffPinLogin appName="Cuisine" allowedRole="kitchen" onSuccess={setUser} />
  }

  return <KitchenBoard user={user} onLogout={() => {
    localStorage.removeItem('tabhub_token')
    localStorage.removeItem('tabhub_tenant')
    setUser(null)
  }} />
}

function KitchenBoard({ user, onLogout }: { user: StaffUser; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState(new Date())

  const load = useCallback(async () => {
    const all = await getOrders()
    setOrders(all.filter(o => o.status === 'Pending' || o.status === 'InProgress'))
  }, [])

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    load()

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl())
      .withAutomaticReconnect()
      .build()

    connection.on('OrderPlaced', (order: Order) => {
      setOrders(prev => [order, ...prev])
    })

    connection.on('OrderStatusChanged', (updated: Order) => {
      setOrders(prev => {
        const active = ['Pending', 'InProgress'] as OrderStatus[]
        const without = prev.filter(o => o.id !== updated.id)
        return active.includes(updated.status) ? [...without, updated] : without
      })
    })

    connection.on('OrderCancelled', (cancelled: Order) => {
      setOrders(prev => prev.filter(o => o.id !== cancelled.id))
    })

    connection.onreconnected(() => { setConnected(true); load() })
    connection.onclose(() => setConnected(false))
    connection.start().then(() => setConnected(true)).catch(console.error)

    return () => { connection.stop() }
  }, [load])

  async function advance(order: Order, next: OrderStatus) {
    await updateOrderStatus(order.id, next)
    setOrders(prev => prev.filter(o => o.id !== order.id))
  }

  async function reject(order: Order) {
    if (!confirm(`Annuler la commande ${order.tableNumber ? `Table ${order.tableNumber}` : `#${order.sequenceNumber?.slice(-4)}`} ?`)) return
    await cancelOrder(order.id)
    setOrders(prev => prev.filter(o => o.id !== order.id))
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
          <span className="font-bold text-lg">Cuisine — {user.displayName}</span>
        </div>
        <span className="text-2xl font-mono text-zinc-300">
          {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <button onClick={onLogout} className="text-sm text-zinc-500 hover:text-white transition-colors">
          Déconnexion
        </button>
      </header>

      {/* Kanban columns */}
      <div className="flex flex-1 divide-x divide-zinc-800">
        {COLUMNS.map(col => {
          const colOrders = orders
            .filter(o => o.status === col.status)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

          return (
            <div key={col.status} className="flex-1 flex flex-col">
              {/* Column header */}
              <div className={`flex items-center justify-between px-5 py-3 border-b ${col.border} bg-zinc-900/50`}>
                <span className={`font-semibold uppercase tracking-wider text-sm ${col.accent}`}>{col.label}</span>
                <span className="text-2xl font-bold text-zinc-300">{colOrders.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {colOrders.length === 0 && (
                  <p className="text-center text-zinc-700 mt-16 text-sm">Aucune commande</p>
                )}
                {colOrders.map(order => (
                  <KitchenCard
                    key={order.id}
                    order={order}
                    col={col}
                    onAdvance={() => advance(order, col.next)}
                    onReject={() => reject(order)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KitchenCard({
  order, col, onAdvance, onReject,
}: {
  order: Order
  col: typeof COLUMNS[number]
  onAdvance: () => void
  onReject:  () => void
}) {
  const label = order.orderType === 'Takeaway'
    ? `À emporter #${order.sequenceNumber?.slice(-4) ?? '—'}`
    : `Table ${order.tableNumber ?? '—'}`

  const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)

  return (
    <div className={`rounded-xl border ${col.border} bg-zinc-900 p-4 space-y-3`}>
      {/* Order header */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-lg">{label}</span>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{formatTime(order.createdAt)}</span>
          {elapsed > 0 && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${elapsed >= 15 ? 'bg-red-900 text-red-300' : 'bg-zinc-800 text-zinc-400'}`}>
              {elapsed}m
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        {order.items.map(item => (
          <li key={item.id} className="flex gap-2 text-sm">
            <span className={`font-bold ${col.accent}`}>{item.quantity}×</span>
            <span className="text-zinc-200">{item.menuItemName}</span>
            {item.notes && <span className="text-zinc-500 italic ml-1">({item.notes})</span>}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-2">Note: {order.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onReject}
          className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-red-900 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
        >
          Rejeter
        </button>
        <button
          onClick={onAdvance}
          className={`flex-2 flex-grow-[2] py-2 rounded-lg text-sm font-semibold transition-colors ${
            col.status === 'Pending'
              ? 'bg-yellow-700 hover:bg-yellow-600 text-white'
              : 'bg-blue-700 hover:bg-blue-600 text-white'
          }`}
        >
          {col.status === 'Pending' ? 'Commencer' : 'Prêt ✓'}
        </button>
      </div>
    </div>
  )
}
