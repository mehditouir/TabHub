// Sessions tab — manage active table sessions.
// Waiter can move a session to another table, merge two sessions, close a session,
// or generate and view the PDF bill for the most recent order in a session.

import React, { useEffect, useState, useCallback } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonModal,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonAlert,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
} from '@ionic/react'
import { refreshOutline } from 'ionicons/icons'
import { IonIcon } from '@ionic/react'
import { getSessions, closeSession, moveSession, mergeSession } from '../lib/api/sessions'
import { getOrders } from '../lib/api/orders'
import { getTables } from '../lib/api/spaces'
import { fetchBillBlobUrl } from '../lib/api/client'
import type { Session, Table, Order } from '../lib/types'

export const Sessions: React.FC = () => {
  const [sessions, setSessions]   = useState<Session[]>([])
  const [tables, setTables]       = useState<Table[]>([])
  const [loading, setLoading]     = useState(true)
  const [actionSession, setActionSession] = useState<Session | null>(null)
  const [action, setAction]       = useState<'move' | 'merge' | null>(null)
  const [targetId, setTargetId]   = useState('')
  const [processing, setProcessing] = useState(false)
  const [closeTarget, setCloseTarget] = useState<Session | null>(null)
  const [billUrl, setBillUrl]     = useState<string | null>(null)
  const [billError, setBillError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sess, tbls] = await Promise.all([
        getSessions({ isOpen: true }),
        getTables(),
      ])
      setSessions(sess)
      setTables(tbls.filter(t => t.isActive))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRefresh = async (e: CustomEvent) => {
    await load()
    ;(e.target as HTMLIonRefresherElement).complete()
  }

  const doMove = async () => {
    if (!actionSession || !targetId) return
    setProcessing(true)
    try {
      await moveSession(actionSession.id, targetId)
      setAction(null)
      setActionSession(null)
      setTargetId('')
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  const doMerge = async () => {
    if (!actionSession || !targetId) return
    setProcessing(true)
    try {
      await mergeSession(actionSession.id, targetId)
      setAction(null)
      setActionSession(null)
      setTargetId('')
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  const doClose = async (session: Session) => {
    setProcessing(true)
    try {
      await closeSession(session.id)
      await load()
      // Offer bill generation
      const tableOrders = await getOrders({ tableId: session.tableId })
      const latest = tableOrders.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0] as Order | undefined
      if (latest) {
        setBillError('')
        try {
          const url = await fetchBillBlobUrl(latest.id)
          setBillUrl(url)
        } catch {
          setBillError('Could not generate bill PDF.')
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
      setCloseTarget(null)
    }
  }

  const openTables = tables.filter(t => !sessions.some(s => s.tableId === t.id && s.isOpen))
  const otherSessions = sessions.filter(s => s.id !== actionSession?.id)

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Sessions</IonTitle>
          <IonButtons slot="end">
            <IonIcon icon={refreshOutline} onClick={load} style={{ marginRight: 16, color: '#fff', cursor: 'pointer' }} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}>
            <IonSpinner name="crescent" />
          </div>
        ) : sessions.length === 0 ? (
          <IonText color="medium" style={{ display: 'block', textAlign: 'center', marginTop: 60 }}>
            No open sessions
          </IonText>
        ) : (
          sessions.map(session => (
            <IonCard key={session.id} style={{ margin: '8px 12px' }}>
              <IonCardHeader style={{ paddingBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <IonCardTitle style={{ fontSize: 16 }}>Table {session.tableNumber}</IonCardTitle>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {session.orderCount} order{session.orderCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  Open since {new Date(session.openedAt).toLocaleTimeString()}
                  {session.staffName && ` · ${session.staffName}`}
                </div>
              </IonCardHeader>

              <IonCardContent style={{ paddingTop: 4 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <IonButton
                    size="small"
                    fill="outline"
                    onClick={() => { setActionSession(session); setAction('move') }}
                  >
                    Move Table
                  </IonButton>
                  <IonButton
                    size="small"
                    fill="outline"
                    color="secondary"
                    onClick={() => { setActionSession(session); setAction('merge') }}
                    disabled={otherSessions.length === 0}
                  >
                    Merge
                  </IonButton>
                  <IonButton
                    size="small"
                    fill="outline"
                    color="danger"
                    onClick={() => setCloseTarget(session)}
                  >
                    Close + Bill
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>
          ))
        )}
      </IonContent>

      {/* Move modal */}
      <IonModal isOpen={action === 'move'} onDidDismiss={() => { setAction(null); setTargetId('') }}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Move Table {actionSession?.tableNumber} to…</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => { setAction(null); setTargetId('') }}>Cancel</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            {openTables.length === 0 && (
              <IonItem>
                <IonLabel color="medium">No available tables</IonLabel>
              </IonItem>
            )}
            {openTables.map(t => (
              <IonItem
                key={t.id}
                button
                detail={false}
                onClick={() => setTargetId(t.id)}
                style={{ '--background': targetId === t.id ? '#fff7ed' : undefined }}
              >
                <IonLabel>
                  Table {t.number}
                  {targetId === t.id && ' ✓'}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
          <div className="ion-padding">
            <IonButton
              expand="block"
              disabled={!targetId || processing}
              onClick={doMove}
            >
              {processing ? <IonSpinner name="crescent" /> : 'Confirm Move'}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      {/* Merge modal */}
      <IonModal isOpen={action === 'merge'} onDidDismiss={() => { setAction(null); setTargetId('') }}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Merge into Table {actionSession?.tableNumber}…</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => { setAction(null); setTargetId('') }}>Cancel</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            {otherSessions.map(s => (
              <IonItem
                key={s.id}
                button
                detail={false}
                onClick={() => setTargetId(s.id)}
                style={{ '--background': targetId === s.id ? '#fff7ed' : undefined }}
              >
                <IonLabel>
                  Table {s.tableNumber} ({s.orderCount} orders)
                  {targetId === s.id && ' ✓'}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
          <div className="ion-padding">
            <IonButton
              expand="block"
              disabled={!targetId || processing}
              onClick={doMerge}
            >
              {processing ? <IonSpinner name="crescent" /> : 'Confirm Merge'}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      {/* Close confirmation */}
      <IonAlert
        isOpen={!!closeTarget}
        onDidDismiss={() => setCloseTarget(null)}
        header="Close Session?"
        message={`Close session for Table ${closeTarget?.tableNumber} and generate the bill?`}
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Close + Bill',
            handler: () => { if (closeTarget) doClose(closeTarget) },
          },
        ]}
      />

      {/* Bill PDF modal */}
      <IonModal isOpen={!!billUrl || !!billError} onDidDismiss={() => { setBillUrl(null); setBillError('') }}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Bill</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => { setBillUrl(null); setBillError('') }}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {billError ? (
            <IonText color="danger" className="ion-padding" style={{ display: 'block' }}>{billError}</IonText>
          ) : billUrl ? (
            <iframe
              src={billUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Bill PDF"
            />
          ) : null}
        </IonContent>
      </IonModal>
    </IonPage>
  )
}
