// Waiter tablet app — web rewrite of the Ionic mobile app.
// Route: /waiter/:tenant
// PIN login → 3 tabs: Floor Plan | Orders | Sessions
// Notification banner overlays all tabs with ACK support.

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { StaffPinLogin } from '@/components/StaffPinLogin'
import { useWaiterHub } from '@/lib/hooks/useWaiterHub'
import { ackNotification } from '@/lib/api/notifications'
import { getWaiterZones } from '@/lib/api/staff'
import { getSpaces, getTables } from '@/lib/api/spaces'
import { getSessions, closeSession, moveSession, mergeSession } from '@/lib/api/sessions'
import { getOrders, updateOrderStatus, cancelOrder, placeStaffOrder, fetchBillBlobUrl } from '@/lib/api/orders'
import { getPublicMenu } from '@/lib/api/menu'
import { ApiError } from '@/lib/api/client'
import { formatPrice, formatTime } from '@/lib/utils'
import type {
  StaffUser, Order, OrderStatus, PendingAlert, AlertType,
  Space, Table, Session, WaiterZone, PublicCategory,
} from '@/lib/types'

// ── Context ──────────────────────────────────────────────────────────────────

interface WaiterCtx {
  user:         StaffUser
  orders:       Order[]
  setOrders:    React.Dispatch<React.SetStateAction<Order[]>>
  alerts:       PendingAlert[]
  dismissAlert: (id: string) => void
  connected:    boolean
  refresh:      () => Promise<void>
}
const WaiterContext = createContext<WaiterCtx | null>(null)
const useWaiter = () => useContext(WaiterContext)!

// ── Root ─────────────────────────────────────────────────────────────────────

export function WaiterApp() {
  const [user, setUser] = useState<StaffUser | null>(null)

  if (!user) {
    return <StaffPinLogin appName="Serveur" allowedRole="waiter" onSuccess={setUser} />
  }

  return <WaiterShell user={user} onLogout={() => {
    localStorage.removeItem('tabhub_token')
    localStorage.removeItem('tabhub_tenant')
    setUser(null)
  }} />
}

// ── Shell ─────────────────────────────────────────────────────────────────────

type Tab = 'floor' | 'orders' | 'sessions'

function WaiterShell({ user, onLogout }: { user: StaffUser; onLogout: () => void }) {
  const hub = useWaiterHub(true)
  const [tab, setTab] = useState<Tab>('floor')

  const ctx: WaiterCtx = { user, ...hub }

  return (
    <WaiterContext.Provider value={ctx}>
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        {/* Notification banner */}
        <NotificationBanner alerts={hub.alerts} onDismiss={hub.dismissAlert} />

        {/* Header */}
        <header className="bg-white border-b border-zinc-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${hub.connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="font-bold text-zinc-900">Serveur — {user.displayName}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
              {([['floor', 'Plan salle'], ['orders', 'Commandes'], ['sessions', 'Sessions']] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {label}
                  {t === 'orders' && hub.orders.filter(o => o.status === 'Pending').length > 0 && (
                    <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold">
                      {hub.orders.filter(o => o.status === 'Pending').length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors ml-2">
              Déconnexion
            </button>
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'floor'    && <FloorPlanTab />}
          {tab === 'orders'   && <OrdersTab />}
          {tab === 'sessions' && <SessionsTab />}
        </div>
      </div>
    </WaiterContext.Provider>
  )
}

// ── Notification Banner ───────────────────────────────────────────────────────

const ALERT_STYLES: Record<AlertType, { border: string; icon: string; label: string; bg: string }> = {
  NewOrder:      { border: 'border-orange-500', icon: '🛎',  label: 'Nouvelle commande', bg: 'bg-orange-50' },
  WaiterCalled:  { border: 'border-blue-500',   icon: '📣',  label: 'Appel serveur',      bg: 'bg-blue-50'   },
  BillRequested: { border: 'border-green-500',  icon: '🧾',  label: 'Demande addition',   bg: 'bg-green-50'  },
}

function NotificationBanner({ alerts, onDismiss }: { alerts: PendingAlert[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 space-y-1 p-2">
      {alerts.slice(0, 4).map(alert => (
        <AlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function AlertCard({ alert, onDismiss }: { alert: PendingAlert; onDismiss: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [taken,   setTaken]   = useState(false)
  const style = ALERT_STYLES[alert.type]

  async function handleAck() {
    if (alert.type !== 'NewOrder') { onDismiss(alert.id); return }
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

  return (
    <div className={`flex items-center gap-3 rounded-xl border-l-4 ${style.border} ${style.bg} px-4 py-2.5 shadow-lg`}>
      <span className="text-xl">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-zinc-900">
          {style.label}{alert.tableNumber && ` — Table ${alert.tableNumber}`}
        </div>
        {alert.type === 'NewOrder' && alert.order && (
          <div className="text-xs text-zinc-500">
            {alert.order.items.length} article{alert.order.items.length !== 1 ? 's' : ''} · {formatPrice(alert.order.total)}
          </div>
        )}
        {taken && <div className="text-xs text-red-500">Déjà pris par un autre serveur</div>}
      </div>
      <button
        onClick={handleAck}
        disabled={loading || taken}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
          alert.type === 'NewOrder'
            ? 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
            : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
        }`}
      >
        {loading ? '…' : alert.type === 'NewOrder' ? 'Prendre' : '✕'}
      </button>
    </div>
  )
}

// ── Floor Plan Tab ────────────────────────────────────────────────────────────

type TableStatus = 'free' | 'occupied' | 'attention'
const STATUS_COLOR: Record<TableStatus, string> = { free: '#22c55e', occupied: '#f97316', attention: '#ef4444' }
const STATUS_LABEL: Record<TableStatus, string>  = { free: 'Libre', occupied: 'Occupée', attention: 'Attention' }

function tableStatus(table: Table, sessions: Session[], orders: Order[]): TableStatus {
  const session = sessions.find(s => s.tableId === table.id && s.isOpen)
  if (!session) return 'free'
  const urgent = orders.some(o => o.tableId === table.id && (o.status === 'Pending' || o.status === 'InProgress'))
  return urgent ? 'attention' : 'occupied'
}

function inZone(table: Table, zones: WaiterZone[], spaceId: string): boolean {
  return zones.some(z =>
    z.spaceId === spaceId &&
    table.col >= z.colStart && table.col <= z.colEnd &&
    table.row >= z.rowStart && table.row <= z.rowEnd,
  )
}

function FloorPlanTab() {
  const { user, orders } = useWaiter()
  const [spaces,      setSpaces]      = useState<Space[]>([])
  const [tables,      setTables]      = useState<Table[]>([])
  const [sessions,    setSessions]    = useState<Session[]>([])
  const [zones,       setZones]       = useState<WaiterZone[]>([])
  const [activeSpace, setActiveSpace] = useState<Space | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState<Table | null>(null)
  const [placeOrder,  setPlaceOrder]  = useState<{ tableId: string; sessionId?: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sp, sess, zns] = await Promise.all([
        getSpaces(),
        getSessions({ isOpen: true }),
        getWaiterZones(user.staffId),
      ])
      const active = sp.filter(s => s.isActive)
      setSpaces(active)
      setSessions(sess)
      setZones(zns)
      if (active.length > 0) setActiveSpace(prev => prev ?? active[0])
    } finally { setLoading(false) }
  }, [user.staffId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!activeSpace) return
    getTables(activeSpace.id).then(t => setTables(t.filter(x => x.isActive))).catch(console.error)
  }, [activeSpace])

  if (loading) return <div className="flex h-full items-center justify-center text-zinc-400">Chargement…</div>

  const cols = activeSpace?.cols ?? 0
  const rows = activeSpace?.rows ?? 0
  const grid: (Table | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))
  tables.forEach(t => { if (t.row >= 1 && t.row <= rows && t.col >= 1 && t.col <= cols) grid[t.row - 1][t.col - 1] = t })

  const selSession = sessions.find(s => s.tableId === selected?.id && s.isOpen) ?? null
  const selStatus  = selected ? tableStatus(selected, sessions, orders) : 'free'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Space tabs */}
      {spaces.length > 1 && (
        <div className="flex gap-1 px-4 pt-3 pb-0">
          {spaces.map(sp => (
            <button
              key={sp.id}
              onClick={() => setActiveSpace(sp)}
              className={`px-4 py-1.5 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
                activeSpace?.id === sp.id
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {sp.name}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 border-b border-zinc-200 bg-white text-xs text-zinc-500">
        {(['free', 'occupied', 'attention'] as TableStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border border-dashed border-zinc-300 bg-zinc-100" />
          Hors zone
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        {spaces.length === 0 ? (
          <p className="text-center text-zinc-400 mt-16">Aucun espace actif.</p>
        ) : (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(56px, 80px))` }}
          >
            {grid.flat().map((table, idx) => {
              if (!table) return <div key={idx} className="h-14" />
              const myZone = inZone(table, zones, activeSpace?.id ?? '')
              const status = tableStatus(table, sessions, orders)
              return (
                <button
                  key={table.id}
                  onClick={() => myZone && setSelected(table)}
                  className="h-14 rounded-lg flex items-center justify-center font-bold text-sm transition-all"
                  style={{
                    border: myZone ? `2px solid ${STATUS_COLOR[status]}` : '2px dashed #d1d5db',
                    backgroundColor: myZone ? `${STATUS_COLOR[status]}22` : '#f9fafb',
                    color: myZone ? STATUS_COLOR[status] : '#9ca3af',
                    cursor: myZone ? 'pointer' : 'default',
                  }}
                >
                  {table.number}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Table detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-80 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xl text-zinc-900">Table {selected.number}</h3>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full text-white"
                style={{ backgroundColor: STATUS_COLOR[selStatus] }}
              >
                {STATUS_LABEL[selStatus]}
              </span>
            </div>
            {selSession && (
              <div className="text-sm text-zinc-500 mb-4 space-y-1">
                <div>Ouverte depuis {formatTime(selSession.openedAt)}</div>
                <div>{selSession.orderCount} commande{selSession.orderCount !== 1 ? 's' : ''}</div>
                {selSession.staffName && <div>Assignée à {selSession.staffName}</div>}
              </div>
            )}
            <button
              onClick={() => { setPlaceOrder({ tableId: selected.id, sessionId: selSession?.id }); setSelected(null) }}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-700 text-white font-semibold text-sm transition-colors"
            >
              Passer une commande
            </button>
          </div>
        </div>
      )}

      {/* Place order modal */}
      {placeOrder && (
        <PlaceOrderModal
          tenant={user.tenant}
          tableId={placeOrder.tableId}
          sessionId={placeOrder.sessionId}
          onClose={() => setPlaceOrder(null)}
        />
      )}
    </div>
  )
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Pending: 'InProgress', InProgress: 'Ready', Ready: 'Completed',
}
const STATUS_BADGE: Record<OrderStatus, string> = {
  Pending:   'bg-yellow-100 text-yellow-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Ready:     'bg-green-100 text-green-700',
  Completed: 'bg-zinc-100 text-zinc-500',
  Cancelled: 'bg-red-100 text-red-500',
}
const STATUS_LABEL_FR: Record<OrderStatus, string> = {
  Pending: 'En attente', InProgress: 'En prépa.', Ready: 'Prêt', Completed: 'Servi', Cancelled: 'Annulé',
}

const ORDER_FILTERS = ['All', 'Pending', 'InProgress', 'Ready', 'Completed'] as const

function OrdersTab() {
  const { orders, setOrders, refresh, connected } = useWaiter()
  const [filter, setFilter] = useState<typeof ORDER_FILTERS[number]>('All')

  const visible = filter === 'All' ? orders : orders.filter(o => o.status === filter)

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white overflow-x-auto">
        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        {ORDER_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {f === 'All' ? 'Tout' : STATUS_LABEL_FR[f as OrderStatus]}
          </button>
        ))}
        <button onClick={refresh} className="ml-auto text-xs text-zinc-400 hover:text-zinc-700 flex-shrink-0">Actualiser</button>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visible.length === 0 && (
          <p className="text-center text-zinc-400 mt-16 text-sm">Aucune commande.</p>
        )}
        {visible.map(order => (
          <WaiterOrderCard
            key={order.id}
            order={order}
            onUpdated={updated => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))}
          />
        ))}
      </div>
    </div>
  )
}

function WaiterOrderCard({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const [advancing, setAdvancing] = useState(false)
  const next = NEXT_STATUS[order.status]

  async function advance() {
    if (!next) return
    setAdvancing(true)
    try { onUpdated(await updateOrderStatus(order.id, next)) }
    catch { /* ignore */ }
    finally { setAdvancing(false) }
  }

  async function doCancel() {
    if (!confirm('Annuler cette commande ?')) return
    await cancelOrder(order.id)
    onUpdated({ ...order, status: 'Cancelled' })
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-zinc-900">
          {order.tableNumber ? `Table ${order.tableNumber}` : `À emporter #${order.sequenceNumber?.slice(-4)}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{formatTime(order.createdAt)}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status]}`}>
            {STATUS_LABEL_FR[order.status]}
          </span>
        </div>
      </div>
      <ul className="text-sm text-zinc-600 space-y-0.5 mb-3">
        {order.items.map(item => (
          <li key={item.id}>
            <span className="font-medium">{item.quantity}×</span> {item.menuItemName}
            {item.notes && <span className="text-zinc-400"> ({item.notes})</span>}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
        <span className="text-sm font-semibold">{formatPrice(order.total)}</span>
        <div className="flex gap-2">
          {order.status !== 'Cancelled' && order.status !== 'Completed' && (
            <button onClick={doCancel} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors">
              Annuler
            </button>
          )}
          {next && (
            <button
              onClick={advance}
              disabled={advancing}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {advancing ? '…' : `→ ${STATUS_LABEL_FR[next]}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [tables,    setTables]    = useState<Table[]>([])
  const [loading,   setLoading]   = useState(true)
  const [billUrl,   setBillUrl]   = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null) // session id being processed
  const [modal, setModal] = useState<{ session: Session; action: 'move' | 'merge' } | null>(null)
  const [targetId, setTargetId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sess, tbls] = await Promise.all([getSessions({ isOpen: true }), getTables()])
      setSessions(sess)
      setTables(tbls.filter(t => t.isActive))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function doClose(session: Session) {
    if (!confirm(`Fermer la session de la Table ${session.tableNumber} ?`)) return
    setProcessing(session.id)
    try {
      await closeSession(session.id)
      await load()
      const tableOrders = await getOrders({ tableId: session.tableId })
      const latest = tableOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      if (latest) setBillUrl(await fetchBillBlobUrl(latest.id))
    } catch { alert('Erreur lors de la fermeture.') }
    finally { setProcessing(null) }
  }

  async function doMove() {
    if (!modal || !targetId) return
    setProcessing(modal.session.id)
    try { await moveSession(modal.session.id, targetId); setModal(null); setTargetId(''); await load() }
    catch { alert('Erreur lors du déplacement.') }
    finally { setProcessing(null) }
  }

  async function doMerge() {
    if (!modal || !targetId) return
    setProcessing(modal.session.id)
    try { await mergeSession(modal.session.id, targetId); setModal(null); setTargetId(''); await load() }
    catch { alert('Erreur lors de la fusion.') }
    finally { setProcessing(null) }
  }

  const openTables    = tables.filter(t => !sessions.some(s => s.tableId === t.id && s.isOpen))
  const otherSessions = sessions.filter(s => s.id !== modal?.session.id)

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-zinc-900">Sessions ouvertes</h2>
        <button onClick={load} className="text-xs text-zinc-400 hover:text-zinc-700">Actualiser</button>
      </div>

      {loading && <p className="text-zinc-400 text-sm">Chargement…</p>}
      {!loading && sessions.length === 0 && <p className="text-zinc-400 text-sm">Aucune session ouverte.</p>}

      <div className="space-y-3">
        {sessions.map(session => (
          <div key={session.id} className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-zinc-900">Table {session.tableNumber}</span>
              <span className="text-xs text-zinc-400">{session.orderCount} commande{session.orderCount !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Depuis {formatTime(session.openedAt)}{session.staffName ? ` · ${session.staffName}` : ''}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setModal({ session, action: 'move' }); setTargetId('') }}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs hover:bg-zinc-50 transition-colors"
              >
                Déplacer
              </button>
              <button
                onClick={() => { setModal({ session, action: 'merge' }); setTargetId('') }}
                disabled={otherSessions.length === 0}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs hover:bg-zinc-50 disabled:opacity-40 transition-colors"
              >
                Fusionner
              </button>
              <button
                onClick={() => doClose(session)}
                disabled={processing === session.id}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {processing === session.id ? 'Fermeture…' : 'Fermer + Addition'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Move / Merge modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-80 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900">
                {modal.action === 'move'
                  ? `Déplacer Table ${modal.session.tableNumber} vers…`
                  : `Fusionner Table ${modal.session.tableNumber} avec…`}
              </h3>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {(modal.action === 'move' ? openTables : otherSessions).length === 0 && (
                <li className="px-5 py-4 text-sm text-zinc-400">
                  {modal.action === 'move' ? 'Aucune table disponible.' : 'Aucune autre session.'}
                </li>
              )}
              {modal.action === 'move' && openTables.map(t => (
                <li
                  key={t.id}
                  onClick={() => setTargetId(t.id)}
                  className={`px-5 py-3 text-sm cursor-pointer hover:bg-zinc-50 flex items-center justify-between ${targetId === t.id ? 'bg-orange-50 font-semibold' : ''}`}
                >
                  Table {t.number}
                  {targetId === t.id && <span className="text-orange-500">✓</span>}
                </li>
              ))}
              {modal.action === 'merge' && otherSessions.map(s => (
                <li
                  key={s.id}
                  onClick={() => setTargetId(s.id)}
                  className={`px-5 py-3 text-sm cursor-pointer hover:bg-zinc-50 flex items-center justify-between ${targetId === s.id ? 'bg-orange-50 font-semibold' : ''}`}
                >
                  Table {s.tableNumber} ({s.orderCount} cmd)
                  {targetId === s.id && <span className="text-orange-500">✓</span>}
                </li>
              ))}
            </ul>
            <div className="px-5 py-4 border-t border-zinc-100">
              <button
                onClick={modal.action === 'move' ? doMove : doMerge}
                disabled={!targetId || !!processing}
                className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
              >
                {processing ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF bill modal */}
      {billUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setBillUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
              <span className="font-semibold text-zinc-900">Addition</span>
              <div className="flex gap-3">
                <a href={billUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Ouvrir</a>
                <button onClick={() => setBillUrl(null)} className="text-zinc-400 hover:text-zinc-700">✕</button>
              </div>
            </div>
            <iframe src={billUrl} className="flex-1 rounded-b-2xl" title="Addition PDF" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Place Order Modal ─────────────────────────────────────────────────────────

function PlaceOrderModal({ tenant, tableId, sessionId, onClose }: {
  tenant: string; tableId: string; sessionId?: string; onClose: () => void
}) {
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [cart,       setCart]       = useState<{ menuItemId: string; name: string; price: number; quantity: number }[]>([])
  const [placing,    setPlacing]    = useState(false)
  const [success,    setSuccess]    = useState(false)

  useEffect(() => {
    getPublicMenu(tenant).then(r => setCategories(r.categories)).catch(console.error)
  }, [tenant])

  function addItem(id: string, name: string, price: number) {
    setCart(prev => {
      const ex = prev.find(l => l.menuItemId === id)
      if (ex) return prev.map(l => l.menuItemId === id ? { ...l, quantity: l.quantity + 1 } : l)
      return [...prev, { menuItemId: id, name, price, quantity: 1 }]
    })
  }

  function removeItem(id: string) {
    setCart(prev => {
      const ex = prev.find(l => l.menuItemId === id)
      if (!ex) return prev
      if (ex.quantity === 1) return prev.filter(l => l.menuItemId !== id)
      return prev.map(l => l.menuItemId === id ? { ...l, quantity: l.quantity - 1 } : l)
    })
  }

  const cartTotal = cart.reduce((s, l) => s + l.price * l.quantity, 0)
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0)

  async function submit() {
    if (cart.length === 0) return
    setPlacing(true)
    try {
      await placeStaffOrder(tableId, cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity })), sessionId)
      setSuccess(true)
      setTimeout(onClose, 1200)
    } catch { alert('Erreur lors de la commande.') }
    finally { setPlacing(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h3 className="font-bold text-zinc-900">Nouvelle commande</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>

        {success ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="font-semibold text-zinc-900">Commande envoyée !</p>
            </div>
          </div>
        ) : (
          <>
            {/* Menu */}
            <div className="flex-1 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id}>
                  <div className="px-5 py-2 bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {cat.name}
                  </div>
                  {cat.items.filter(i => i.isAvailable).map(item => {
                    const qty = cart.find(l => l.menuItemId === item.id)?.quantity ?? 0
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-5 py-3 border-b border-zinc-100">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-zinc-800">{item.name}</div>
                          <div className="text-xs text-orange-500 font-semibold mt-0.5">{formatPrice(item.price)}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {qty > 0 && (
                            <>
                              <button onClick={() => removeItem(item.id)} className="h-8 w-8 rounded-full bg-zinc-100 hover:bg-zinc-200 font-bold flex items-center justify-center">−</button>
                              <span className="w-4 text-center font-semibold text-sm">{qty}</span>
                            </>
                          )}
                          <button onClick={() => addItem(item.id, item.name, item.price)} className="h-8 w-8 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white font-bold flex items-center justify-center">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Submit bar */}
            {cartCount > 0 && (
              <div className="flex items-center gap-4 px-5 py-4 border-t border-zinc-200">
                <div className="flex-1">
                  <div className="text-xs text-zinc-400">{cartCount} article{cartCount !== 1 ? 's' : ''}</div>
                  <div className="font-bold text-zinc-900">{formatPrice(cartTotal)}</div>
                </div>
                <button
                  onClick={submit}
                  disabled={placing}
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
                >
                  {placing ? 'Envoi…' : 'Commander'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
