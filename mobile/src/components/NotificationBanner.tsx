// Sticky alert panel at the top of the screen.
// NewOrder alerts require a server-side ACK (competing consumer — first tap wins).
// WaiterCalled and BillRequested are SignalR-only; dismissed locally.

import React, { useState } from 'react'
import {
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner,
} from '@ionic/react'
import { checkmarkCircle, callSharp, receiptOutline, closeCircle } from 'ionicons/icons'
import { ackNotification } from '../lib/api/notifications'
import { ApiError } from '../lib/api/client'
import type { PendingAlert } from '../lib/types'

interface Props {
  alerts:       PendingAlert[]
  onDismiss:    (id: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  NewOrder:     'New Order',
  WaiterCalled: 'Waiter Called',
  BillRequested: 'Bill Requested',
}

const TYPE_ICONS: Record<string, string> = {
  NewOrder:     checkmarkCircle,
  WaiterCalled: callSharp,
  BillRequested: receiptOutline,
}

const TYPE_COLORS: Record<string, string> = {
  NewOrder:     '#f97316',
  WaiterCalled: '#3b82f6',
  BillRequested: '#10b981',
}

function AlertCard({ alert, onDismiss }: { alert: PendingAlert; onDismiss: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [taken, setTaken]     = useState(false)

  const handleAck = async () => {
    if (alert.type !== 'NewOrder') {
      onDismiss(alert.id)
      return
    }
    setLoading(true)
    try {
      await ackNotification(alert.id)
      onDismiss(alert.id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setTaken(true)
        setTimeout(() => onDismiss(alert.id), 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  const color = TYPE_COLORS[alert.type] ?? '#f97316'

  return (
    <IonCard style={{ margin: '4px 8px', borderLeft: `4px solid ${color}` }}>
      <IonCardContent style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <IonIcon icon={TYPE_ICONS[alert.type]} style={{ color, fontSize: 24, flexShrink: 0 }} />

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {TYPE_LABELS[alert.type]}
            {alert.tableNumber && (
              <IonBadge color="medium" style={{ marginLeft: 6 }}>
                Table {alert.tableNumber}
              </IonBadge>
            )}
          </div>
          {alert.type === 'NewOrder' && alert.order && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {alert.order.items.length} item{alert.order.items.length !== 1 ? 's' : ''} •{' '}
              {alert.order.total.toFixed(3)} TND
            </div>
          )}
          {taken && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>
              Already acknowledged by another waiter
            </div>
          )}
        </div>

        <IonButton
          size="small"
          fill={alert.type === 'NewOrder' ? 'solid' : 'outline'}
          color={alert.type === 'NewOrder' ? 'primary' : 'medium'}
          disabled={loading || taken}
          onClick={handleAck}
          style={{ flexShrink: 0 }}
        >
          {loading ? (
            <IonSpinner name="crescent" style={{ width: 16, height: 16 }} />
          ) : alert.type === 'NewOrder' ? (
            'Take'
          ) : (
            <IonIcon icon={closeCircle} />
          )}
        </IonButton>
      </IonCardContent>
    </IonCard>
  )
}

export const NotificationBanner: React.FC<Props> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, paddingTop: 'env(safe-area-inset-top)' }}>
      {alerts.slice(0, 4).map(alert => (
        <AlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
