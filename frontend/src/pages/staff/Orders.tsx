// Live order queue for staff (waiters, kitchen, cashier).
// Connected to SignalR — new orders appear instantly, no manual refresh needed.

import { useState } from 'react'
import { useOrderHub }  from '@/lib/hooks/useOrderHub'
import { OrderCard }    from '@/components/orders/OrderCard'
import { Button }       from '@/components/ui/Button'
import type { Order, OrderStatus } from '@/lib/types'

const STATUS_FILTERS: { label: string; value: OrderStatus | 'All' }[] = [
  { label: 'All',         value: 'All'        },
  { label: 'Pending',     value: 'Pending'    },
  { label: 'In Progress', value: 'InProgress' },
  { label: 'Ready',       value: 'Ready'      },
  { label: 'Completed',   value: 'Completed'  },
]

export function StaffOrders() {
  const [filter, setFilter] = useState<OrderStatus | 'All'>('All')
  const { orders, connected, refresh } = useOrderHub(
    filter === 'All' ? undefined : filter
  )

  function handleUpdated(_updated: Order) {
    refresh() // refresh full list to reflect DB state
  }

  function handleCancelled(_id: string) {
    refresh()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm text-zinc-400">{connected ? 'Live' : 'Reconnecting…'}</span>
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-brand text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="text-zinc-400 hover:text-white">
          Refresh
        </Button>
      </div>

      {/* Order grid */}
      <div className="flex-1 overflow-auto p-4">
        {orders.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-600">
            No orders{filter !== 'All' ? ` with status "${filter}"` : ''}.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdated={handleUpdated}
                onCancelled={handleCancelled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
