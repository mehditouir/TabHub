// Orders tab — live queue of all orders for this waiter's tables.
// Orders arrive via SignalR (useWaiterHub) and can be advanced or cancelled here.

import React, { useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonText,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  IonButtons,
} from '@ionic/react'
import { refreshOutline } from 'ionicons/icons'
import { updateOrderStatus, cancelOrder } from '../lib/api/orders'
import { useWaiter } from '../contexts/WaiterContext'
import type { Order, OrderStatus } from '../lib/types'

const STATUS_COLOR: Record<OrderStatus, string> = {
  Pending:   'warning',
  InProgress: 'primary',
  Ready:     'success',
  Completed: 'medium',
  Cancelled: 'danger',
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Pending:    'InProgress',
  InProgress: 'Ready',
  Ready:      'Completed',
}

const FILTERS = ['All', 'Pending', 'InProgress', 'Ready', 'Completed'] as const
type Filter = typeof FILTERS[number]

function OrderCard({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const [advancing, setAdvancing] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const next = NEXT_STATUS[order.status]

  const advance = async () => {
    if (!next) return
    setAdvancing(true)
    try {
      const updated = await updateOrderStatus(order.id, next)
      onUpdated(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setAdvancing(false)
    }
  }

  const cancel = async () => {
    try {
      await cancelOrder(order.id)
      onUpdated({ ...order, status: 'Cancelled' })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <IonCard style={{ margin: '8px 12px' }}>
      <IonCardHeader style={{ paddingBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <IonCardTitle style={{ fontSize: 16 }}>
            {order.tableNumber ? `Table ${order.tableNumber}` : `Takeaway #${order.sequenceNumber}`}
          </IonCardTitle>
          <IonBadge color={STATUS_COLOR[order.status]}>{order.status}</IonBadge>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {new Date(order.createdAt).toLocaleTimeString()}
          {' · '}
          {order.total.toFixed(3)} TND
        </div>
      </IonCardHeader>

      <IonCardContent style={{ paddingTop: 4 }}>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: '#374151' }}>
          {order.items.map(item => (
            <li key={item.id}>
              {item.quantity}× {item.menuItemName}
              {item.notes && <span style={{ color: '#9ca3af' }}> — {item.notes}</span>}
            </li>
          ))}
        </ul>

        {order.notes && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
            Note: {order.notes}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {next && (
            <IonButton
              size="small"
              color="primary"
              disabled={advancing}
              onClick={advance}
              style={{ flex: 1 }}
            >
              {advancing ? <IonSpinner name="crescent" style={{ width: 16, height: 16 }} /> : `→ ${next}`}
            </IonButton>
          )}
          {order.status !== 'Cancelled' && order.status !== 'Completed' && (
            <IonButton
              size="small"
              fill="outline"
              color="danger"
              onClick={() => setShowCancel(true)}
            >
              Cancel
            </IonButton>
          )}
        </div>
      </IonCardContent>

      <IonAlert
        isOpen={showCancel}
        onDidDismiss={() => setShowCancel(false)}
        header="Cancel Order?"
        message={`Cancel order for ${order.tableNumber ? `Table ${order.tableNumber}` : `Takeaway #${order.sequenceNumber}`}?`}
        buttons={[
          { text: 'No', role: 'cancel' },
          { text: 'Yes, Cancel', handler: cancel },
        ]}
      />
    </IonCard>
  )
}

export const Orders: React.FC = () => {
  const { orders, setOrders, refresh, connected } = useWaiter()
  const [filter, setFilter] = useState<Filter>('All')

  const visible = filter === 'All'
    ? orders
    : orders.filter(o => o.status === filter)

  const handleUpdated = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const handleRefresh = async (e: CustomEvent) => {
    await refresh()
    ;(e.target as HTMLIonRefresherElement).complete()
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Orders</IonTitle>
          <IonButtons slot="end">
            <div style={{ marginRight: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: connected ? '#22c55e' : '#ef4444',
              }} />
              <IonIcon icon={refreshOutline} onClick={refresh} style={{ cursor: 'pointer', color: '#fff' }} />
            </div>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={filter}
            onIonChange={e => setFilter(e.detail.value as Filter)}
            scrollable
          >
            {FILTERS.map(f => (
              <IonSegmentButton key={f} value={f}>
                <IonLabel>{f}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {visible.length === 0 ? (
          <IonText color="medium" style={{ display: 'block', textAlign: 'center', marginTop: 60 }}>
            No {filter !== 'All' ? filter.toLowerCase() : ''} orders
          </IonText>
        ) : (
          visible.map(order => (
            <OrderCard key={order.id} order={order} onUpdated={handleUpdated} />
          ))
        )}
      </IonContent>
    </IonPage>
  )
}

