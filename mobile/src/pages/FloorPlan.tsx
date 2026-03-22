// Floor plan tab — waiter sees the dining room grid filtered to their assigned zones.
// Tables are colour-coded by status derived from open sessions and live orders.

import React, { useEffect, useState, useCallback } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonModal,
  IonSpinner,
  IonText,
  IonButtons,
  IonBackButton,
  useIonRouter,
} from '@ionic/react'
import { getSpaces, getTables } from '../lib/api/spaces'
import { getSessions } from '../lib/api/sessions'
import { getMyZones } from '../lib/api/staff'
import { useWaiter } from '../contexts/WaiterContext'
import type { Space, Table, Session, WaiterZone } from '../lib/types'

type TableStatus = 'free' | 'occupied' | 'attention'

function tableStatus(table: Table, sessions: Session[], orders: { tableId: string | null; status: string }[]): TableStatus {
  const session = sessions.find(s => s.tableId === table.id && s.isOpen)
  if (!session) return 'free'
  const hasUrgent = orders.some(
    o => o.tableId === table.id && (o.status === 'Pending' || o.status === 'InProgress'),
  )
  return hasUrgent ? 'attention' : 'occupied'
}

function inZone(table: Table, zones: WaiterZone[], spaceId: string): boolean {
  return zones.some(
    z =>
      z.spaceId === spaceId &&
      table.col >= z.colStart &&
      table.col <= z.colEnd &&
      table.row >= z.rowStart &&
      table.row <= z.rowEnd,
  )
}

const STATUS_COLOR: Record<TableStatus, string> = {
  free:      '#22c55e',
  occupied:  '#f97316',
  attention: '#ef4444',
}
const STATUS_LABEL: Record<TableStatus, string> = {
  free:      'Free',
  occupied:  'Occupied',
  attention: 'Needs Attention',
}

interface TableDetailModalProps {
  table:    Table | null
  session:  Session | null
  status:   TableStatus
  onClose:  () => void
  onNewOrder: (tableId: string, sessionId?: string) => void
}

function TableDetailModal({ table, session, status, onClose, onNewOrder }: TableDetailModalProps) {
  if (!table) return null
  return (
    <IonModal isOpen={!!table} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Table {table.number}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>Close</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ marginBottom: 16 }}>
          <span
            style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 99,
              backgroundColor: STATUS_COLOR[status], color: '#fff', fontWeight: 600, fontSize: 14,
            }}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {session && (
          <div style={{ marginBottom: 20, color: '#374151' }}>
            <div><strong>Session open since:</strong> {new Date(session.openedAt).toLocaleTimeString()}</div>
            <div><strong>Orders in session:</strong> {session.orderCount}</div>
            {session.staffName && <div><strong>Assigned to:</strong> {session.staffName}</div>}
          </div>
        )}

        <IonButton
          expand="block"
          color="primary"
          onClick={() => onNewOrder(table.id, session?.id)}
          style={{ marginBottom: 8 }}
        >
          Place New Order
        </IonButton>
      </IonContent>
    </IonModal>
  )
}

export const FloorPlan: React.FC = () => {
  const { user, orders } = useWaiter()
  const router = useIonRouter()

  const [spaces, setSpaces]     = useState<Space[]>([])
  const [tables, setTables]     = useState<Table[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [zones, setZones]       = useState<WaiterZone[]>([])
  const [activeSpace, setActiveSpace] = useState<Space | null>(null)
  const [loading, setLoading]   = useState(true)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [sp, sess, zns] = await Promise.all([
        getSpaces(),
        getSessions({ isOpen: true }),
        getMyZones(user.staffId),
      ])
      setSpaces(sp.filter(s => s.isActive))
      setSessions(sess)
      setZones(zns)
      if (sp.length > 0 && !activeSpace) {
        setActiveSpace(sp.find(s => s.isActive) ?? sp[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user, activeSpace])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!activeSpace) return
    getTables(activeSpace.id).then(setTables).catch(console.error)
  }, [activeSpace])

  if (loading) {
    return (
      <IonPage>
        <IonHeader><IonToolbar color="primary"><IonTitle>Floor Plan</IonTitle></IonToolbar></IonHeader>
        <IonContent className="ion-padding" style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <IonSpinner name="crescent" />
        </IonContent>
      </IonPage>
    )
  }

  const spaceTables = tables.filter(t => t.isActive)
  const cols = activeSpace?.cols ?? 0
  const rows = activeSpace?.rows ?? 0

  const grid: (Table | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))
  spaceTables.forEach(t => {
    if (t.row >= 1 && t.row <= rows && t.col >= 1 && t.col <= cols) {
      grid[t.row - 1][t.col - 1] = t
    }
  })

  const selectedSession = sessions.find(s => s.tableId === selectedTable?.id && s.isOpen) ?? null
  const selectedStatus  = selectedTable
    ? tableStatus(selectedTable, sessions, orders)
    : 'free'

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Floor Plan</IonTitle>
        </IonToolbar>
        {spaces.length > 1 && (
          <IonToolbar>
            <IonSegment
              value={activeSpace?.id ?? ''}
              onIonChange={e => {
                const s = spaces.find(sp => sp.id === e.detail.value)
                if (s) setActiveSpace(s)
              }}
              scrollable
            >
              {spaces.map(sp => (
                <IonSegmentButton key={sp.id} value={sp.id}>
                  <IonLabel>{sp.name}</IonLabel>
                </IonSegmentButton>
              ))}
            </IonSegment>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderBottom: '1px solid #e5e7eb' }}>
          {(['free', 'occupied', 'attention'] as TableStatus[]).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: STATUS_COLOR[s] }} />
              {STATUS_LABEL[s]}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#e5e7eb', border: '1px dashed #9ca3af' }} />
            Outside zone
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding: 16, overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(56px, 1fr))`,
              gap: 6,
              minWidth: cols * 62,
            }}
          >
            {grid.flat().map((table, idx) => {
              if (!table) {
                return <div key={idx} style={{ height: 56 }} />
              }
              const myZone = inZone(table, zones, activeSpace?.id ?? '')
              const status = tableStatus(table, sessions, orders)
              return (
                <button
                  key={table.id}
                  onClick={() => myZone && setSelectedTable(table)}
                  style={{
                    height: 56,
                    borderRadius: 8,
                    border: myZone ? `2px solid ${STATUS_COLOR[status]}` : '2px dashed #d1d5db',
                    backgroundColor: myZone ? `${STATUS_COLOR[status]}22` : '#f9fafb',
                    cursor: myZone ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: myZone ? STATUS_COLOR[status] : '#9ca3af',
                  }}
                >
                  <span>{table.number}</span>
                </button>
              )
            })}
          </div>
        </div>

        {spaces.length === 0 && (
          <IonText color="medium" style={{ display: 'block', textAlign: 'center', marginTop: 48 }}>
            No active spaces found.
          </IonText>
        )}
      </IonContent>

      <TableDetailModal
        table={selectedTable}
        session={selectedSession}
        status={selectedStatus}
        onClose={() => setSelectedTable(null)}
        onNewOrder={(tableId, sessionId) => {
          setSelectedTable(null)
          router.push(`/app/place-order/${tableId}${sessionId ? `?sessionId=${sessionId}` : ''}`)
        }}
      />
    </IonPage>
  )
}
