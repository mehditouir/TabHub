import { Badge } from '@/components/ui/Badge'
import type { OrderStatus } from '@/lib/types'

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: React.ComponentProps<typeof Badge>['color'] }> = {
  Pending:    { label: 'Pending',     color: 'yellow'  },
  InProgress: { label: 'In Progress', color: 'blue'    },
  Ready:      { label: 'Ready',       color: 'orange'  },
  Completed:  { label: 'Completed',   color: 'green'   },
  Cancelled:  { label: 'Cancelled',   color: 'red'     },
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, color } = STATUS_CONFIG[status] ?? { label: status, color: 'gray' }
  return <Badge color={color}>{label}</Badge>
}

// Next-status actions for staff (what they can advance to)
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Pending:    'InProgress',
  InProgress: 'Ready',
  Ready:      'Completed',
}
