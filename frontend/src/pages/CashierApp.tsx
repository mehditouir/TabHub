// Cashier kiosk — for cashier staff to create and bill orders.
// Route: /cashier/:tenant
// PIN login → two tabs: New Order | Sessions
// New Order: Takeaway (item picker + notes) or Table (pick table → item picker)
// Sessions: list open sessions → close + print PDF bill

import { useState, useEffect, useCallback } from 'react'
import { StaffPinLogin } from '@/components/StaffPinLogin'
import { getPublicMenu } from '@/lib/api/menu'
import { getTables } from '@/lib/api/spaces'
import { getSessions, closeSession } from '@/lib/api/sessions'
import { placeStaffOrder, placeTakeawayOrder, getOrders, fetchBillBlobUrl } from '@/lib/api/orders'
import type { PublicCategory, Table, Session, StaffUser, Order } from '@/lib/types'
import { formatPrice, formatTime } from '@/lib/utils'

// ── Root ────────────────────────────────────────────────────────────────────

export function CashierApp() {
  const [user, setUser] = useState<StaffUser | null>(null)

  if (!user) {
    return <StaffPinLogin appName="Caisse" allowedRole="cashier" onSuccess={setUser} />
  }

  return <CashierKiosk user={user} onLogout={() => {
    localStorage.removeItem('tabhub_token')
    localStorage.removeItem('tabhub_tenant')
    setUser(null)
  }} />
}

// ── Main kiosk ───────────────────────────────────────────────────────────────

type Tab = 'order' | 'sessions'

function CashierKiosk({ user, onLogout }: { user: StaffUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('order')

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-zinc-900 text-lg">Caisse — {user.displayName}</span>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
            {([['order', 'Nouvelle commande'], ['sessions', 'Sessions']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors">
            Déconnexion
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'order'    && <NewOrderTab tenant={user.tenant} />}
        {tab === 'sessions' && <SessionsTab tenant={user.tenant} />}
      </div>
    </div>
  )
}

// ── New Order Tab ─────────────────────────────────────────────────────────────

type OrderType = 'takeaway' | 'table'

interface CartLine { menuItemId: string; name: string; price: number; quantity: number }

function NewOrderTab({ tenant }: { tenant: string }) {
  const [orderType, setOrderType]   = useState<OrderType>('takeaway')
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [tables, setTables]         = useState<Table[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [cart, setCart]             = useState<CartLine[]>([])
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]       = useState<string | null>(null)
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    const [menu, tableList] = await Promise.all([
      getPublicMenu(tenant),
      getTables(),
    ])
    setCategories(menu.categories)
    setTables(tableList.filter(t => t.isActive))
  }, [tenant])

  useEffect(() => { load() }, [load])

  function addItem(id: string, name: string, price: number) {
    setCart(prev => {
      const existing = prev.find(l => l.menuItemId === id)
      if (existing) return prev.map(l => l.menuItemId === id ? { ...l, quantity: l.quantity + 1 } : l)
      return [...prev, { menuItemId: id, name, price, quantity: 1 }]
    })
  }

  function removeItem(id: string) {
    setCart(prev => {
      const existing = prev.find(l => l.menuItemId === id)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter(l => l.menuItemId !== id)
      return prev.map(l => l.menuItemId === id ? { ...l, quantity: l.quantity - 1 } : l)
    })
  }

  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0)

  async function handleSubmit() {
    if (cart.length === 0) { setError('Ajoutez au moins un article.'); return }
    if (orderType === 'table' && !selectedTable) { setError('Sélectionnez une table.'); return }
    setError('')
    setSubmitting(true)
    try {
      const items = cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity }))
      if (orderType === 'takeaway') {
        const order = await placeTakeawayOrder(items, notes || undefined)
        setSuccess(`Commande à emporter #${order.sequenceNumber?.slice(-4)} créée.`)
      } else {
        await placeStaffOrder(selectedTable, items)
        const tbl = tables.find(t => t.id === selectedTable)
        setSuccess(`Commande créée pour la Table ${tbl?.number ?? ''}.`)
      }
      setCart([])
      setNotes('')
      setSelectedTable('')
    } catch {
      setError('Erreur lors de la création de la commande.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex">
      {/* Left: menu */}
      <div className="flex-1 overflow-y-auto p-5 border-r border-zinc-200">
        {/* Order type toggle */}
        <div className="flex gap-2 mb-5">
          {(['takeaway', 'table'] as OrderType[]).map(t => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                orderType === t
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {t === 'takeaway' ? 'À emporter' : 'Sur table'}
            </button>
          ))}
        </div>

        {/* Table selector */}
        {orderType === 'table' && (
          <select
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            className="w-full mb-5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-800 focus:outline-none focus:border-zinc-400"
          >
            <option value="">-- Sélectionner une table --</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>Table {t.number}</option>
            ))}
          </select>
        )}

        {/* Menu items */}
        {categories.map(cat => (
          <div key={cat.id} className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{cat.name}</h3>
            <div className="space-y-1">
              {cat.items.filter(i => i.isAvailable).map(item => {
                const qty = cart.find(l => l.menuItemId === item.id)?.quantity ?? 0
                return (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-100 transition-colors">
                    <div>
                      <span className="text-sm font-medium text-zinc-800">{item.name}</span>
                      <span className="ml-2 text-sm text-zinc-400">{formatPrice(item.price)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {qty > 0 && (
                        <>
                          <button onClick={() => removeItem(item.id)} className="h-7 w-7 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold text-base flex items-center justify-center transition-colors">−</button>
                          <span className="w-5 text-center font-semibold text-sm">{qty}</span>
                        </>
                      )}
                      <button onClick={() => addItem(item.id, item.name, item.price)} className="h-7 w-7 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white font-bold text-base flex items-center justify-center transition-colors">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Right: cart */}
      <div className="w-80 flex flex-col bg-white p-5">
        <h2 className="font-bold text-zinc-900 mb-4">Commande</h2>

        {cart.length === 0 ? (
          <p className="text-sm text-zinc-400 flex-1">Aucun article sélectionné.</p>
        ) : (
          <ul className="flex-1 space-y-2 overflow-y-auto mb-4">
            {cart.map(line => (
              <li key={line.menuItemId} className="flex justify-between text-sm">
                <span className="text-zinc-700">{line.quantity}× {line.name}</span>
                <span className="text-zinc-500">{formatPrice(line.price * line.quantity)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Notes (takeaway only) */}
        {orderType === 'takeaway' && (
          <textarea
            placeholder="Note client (optionnel)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 mb-4 rounded-xl border border-zinc-200 text-sm text-zinc-800 resize-none focus:outline-none focus:border-zinc-400"
          />
        )}

        {/* Total */}
        <div className="flex justify-between font-bold text-zinc-900 mb-4 pt-3 border-t border-zinc-100">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>

        {error   && <p className="text-red-500 text-xs mb-3">{error}</p>}
        {success && <p className="text-green-600 text-xs mb-3">{success}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
          className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          {submitting ? 'Envoi…' : 'Valider la commande'}
        </button>
      </div>
    </div>
  )
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────

function SessionsTab({ tenant: _tenant }: { tenant: string }) {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [loading,   setLoading]   = useState(true)
  const [billUrl,   setBillUrl]   = useState<string | null>(null)
  const [closing,   setClosing]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await getSessions({ isOpen: true }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleClose(session: Session) {
    setClosing(session.id)
    try {
      await closeSession(session.id)
      // Fetch latest order for this table to print the bill
      const orders: Order[] = await getOrders({ tableId: session.tableId })
      const latest = orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      if (latest) {
        const url = await fetchBillBlobUrl(latest.id)
        setBillUrl(url)
      }
      await load()
    } catch {
      alert('Erreur lors de la fermeture de la session.')
    } finally {
      setClosing(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-zinc-900 text-lg">Sessions ouvertes</h2>
        <button onClick={load} className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors">Actualiser</button>
      </div>

      {loading && <p className="text-zinc-400 text-sm">Chargement…</p>}

      {!loading && sessions.length === 0 && (
        <p className="text-zinc-400 text-sm">Aucune session ouverte.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map(session => (
          <div key={session.id} className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-zinc-900">Table {session.tableNumber ?? '—'}</span>
              <span className="text-xs text-zinc-400">{formatTime(session.openedAt)}</span>
            </div>
            <button
              onClick={() => handleClose(session)}
              disabled={closing === session.id}
              className="w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {closing === session.id ? 'Fermeture…' : 'Fermer & Imprimer'}
            </button>
          </div>
        ))}
      </div>

      {/* PDF bill viewer */}
      {billUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setBillUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
              <span className="font-semibold text-zinc-900">Facture</span>
              <div className="flex gap-2">
                <a href={billUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Ouvrir dans un onglet</a>
                <button onClick={() => setBillUrl(null)} className="text-zinc-400 hover:text-zinc-700 ml-3">✕</button>
              </div>
            </div>
            <iframe src={billUrl} className="flex-1 rounded-b-2xl" title="Facture PDF" />
          </div>
        </div>
      )}
    </div>
  )
}
