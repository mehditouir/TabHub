import { StatusBadge, NEXT_STATUS } from './StatusBadge'
import { Button } from '@/components/ui/Button'
import { formatTime, formatPrice } from '@/lib/utils'
import { updateOrderStatus, cancelOrder } from '@/lib/api/orders'
import type { Order } from '@/lib/types'

interface Props {
  order:     Order
  onUpdated: (updated: Order) => void
  onCancelled: (id: string) => void
}

export function OrderCard({ order, onUpdated, onCancelled }: Props) {
  const next = NEXT_STATUS[order.status]

  async function advance() {
    if (!next) return
    const updated = await updateOrderStatus(order.id, next)
    onUpdated(updated)
  }

  async function cancel() {
    if (!confirm('Cancel this order?')) return
    await cancelOrder(order.id)
    onCancelled(order.id)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-bold text-zinc-900">Table {order.tableNumber}</span>
          <span className="ml-2 text-sm text-zinc-400">{formatTime(order.createdAt)}</span>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Items */}
      <ul className="divide-y divide-zinc-100 text-sm">
        {order.items.map(item => (
          <li key={item.id} className="flex justify-between py-1.5">
            <span>
              <span className="font-medium">{item.quantity}×</span>{' '}
              {item.menuItemName}
              {item.notes && <span className="ml-1 text-zinc-400">({item.notes})</span>}
            </span>
            <span className="text-zinc-500">{formatPrice(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
        <span className="font-semibold text-zinc-900">{formatPrice(order.total)}</span>
        <div className="flex gap-2">
          {order.status !== 'Completed' && order.status !== 'Cancelled' && (
            <Button variant="ghost" size="sm" onClick={cancel} className="text-red-500 hover:bg-red-50">
              Cancel
            </Button>
          )}
          {next && (
            <Button size="sm" onClick={advance}>
              Mark {next === 'InProgress' ? 'In Progress' : next}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
