// Customer-facing menu page, accessed by scanning a table's QR code.
// URL: /menu/:tenant?table=<qrToken>
// No authentication required.

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as signalR from '@microsoft/signalr'
import { getPublicMenu }                       from '@/lib/api/menu'
import { placeOrder, callWaiter, requestBill } from '@/lib/api/orders'
import { resolveTable }                        from '@/lib/api/spaces'
import { customerHubUrl }                      from '@/lib/api/client'
import { Button }                              from '@/components/ui/Button'
import { formatPrice }                         from '@/lib/utils'
import type {
  Order, PublicMenuResponse, PublicMenuItem,
  PublicModifierGroup, CartSyncItem,
} from '@/lib/types'

// ── Cart types ────────────────────────────────────────────────────────────────

type SelectedModifiers = Record<string, string[]>  // groupId → selected optionIds

type CartItem = {
  item: PublicMenuItem
  quantity: number
  selectedModifiers: SelectedModifiers
}

function itemUnitPrice(item: PublicMenuItem, mods: SelectedModifiers): number {
  let delta = 0
  for (const [gid, oids] of Object.entries(mods)) {
    const group = item.modifierGroups.find(g => g.id === gid)
    if (!group) continue
    for (const oid of oids) delta += group.options.find(o => o.id === oid)?.priceDelta ?? 0
  }
  return item.price + delta
}

function cartItemPrice(c: CartItem): number {
  return itemUnitPrice(c.item, c.selectedModifiers) * c.quantity
}

function modifiersLabel(item: PublicMenuItem, mods: SelectedModifiers): string {
  const labels: string[] = []
  for (const [gid, oids] of Object.entries(mods)) {
    const group = item.modifierGroups.find(g => g.id === gid)
    if (!group) continue
    for (const oid of oids) {
      const opt = group.options.find(o => o.id === oid)
      if (opt) labels.push(opt.name)
    }
  }
  return labels.join(', ')
}

function findMenuItemById(menu: PublicMenuResponse, itemId: string): PublicMenuItem | undefined {
  for (const cat of menu.categories)
    for (const item of cat.items)
      if (item.id === itemId) return item
}

const STATUS_STEPS = ['Pending', 'InProgress', 'Ready', 'Completed'] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomerMenu() {
  const { tenant }   = useParams<{ tenant: string }>()
  const [params]     = useSearchParams()
  const qrToken      = params.get('table') ?? ''
  const { t }        = useTranslation()

  // Menu
  const [menu, setMenu]       = useState<PublicMenuResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Resolved table UUID (needed for SignalR group)
  const [tableId, setTableId] = useState<string | null>(null)

  // Cart
  const [cart, setCart]       = useState<CartItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Modifier modal
  const [modalItem, setModalItem]                = useState<PublicMenuItem | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifiers>({})
  const [modifierError, setModifierError]         = useState('')

  // Order tracking
  const [view, setView]               = useState<'menu' | 'tracking'>('menu')
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [orderStatus, setOrderStatus] = useState('')

  // Customer action feedback
  const [actionMsg, setActionMsg] = useState('')
  const [cartSyncMsg, setCartSyncMsg] = useState(false)

  // Refs for SignalR handlers (avoid stale closures)
  const hubRef          = useRef<signalR.HubConnection | null>(null)
  const menuRef         = useRef<PublicMenuResponse | null>(null)
  const activeOrderRef  = useRef<Order | null>(null)
  const isRemoteUpdate  = useRef(false)

  menuRef.current        = menu
  activeOrderRef.current = activeOrder

  // ── Load menu ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenant) return
    getPublicMenu(tenant)
      .then(setMenu)
      .catch(() => setPageError(t('customer.menuLoadError')))
      .finally(() => setLoading(false))
  }, [tenant, t])

  // ── Resolve qrToken → tableId ───────────────────────────────────────────────

  useEffect(() => {
    if (!tenant || !qrToken) return
    resolveTable(tenant, qrToken)
      .then(r => setTableId(r.tableId))
      .catch(() => { /* no-op: shared cart unavailable, ordering still works */ })
  }, [tenant, qrToken])

  // ── Unified SignalR connection ──────────────────────────────────────────────

  useEffect(() => {
    if (!tenant || !tableId) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(customerHubUrl(tenant, tableId))
      .withAutomaticReconnect()
      .build()

    // Real-time order status updates
    connection.on('OrderStatusChanged', (order: Order) => {
      if (activeOrderRef.current?.id === order.id) setOrderStatus(order.status)
    })

    // Shared cart: another device updated the cart
    connection.on('CartUpdated', (syncItems: CartSyncItem[]) => {
      const currentMenu = menuRef.current
      if (!currentMenu) return
      const reconstructed = syncItems
        .map(sync => {
          const item = findMenuItemById(currentMenu, sync.itemId)
          if (!item) return null
          return { item, quantity: sync.quantity, selectedModifiers: sync.selectedModifiers }
        })
        .filter(Boolean) as CartItem[]
      isRemoteUpdate.current = true
      setCart(reconstructed)
      setCartSyncMsg(true)
      setTimeout(() => setCartSyncMsg(false), 2500)
    })

    connection.start().catch(console.error)
    hubRef.current = connection

    return () => { connection.stop(); hubRef.current = null }
  }, [tenant, tableId])

  // ── Broadcast cart to other devices on same table ──────────────────────────

  useEffect(() => {
    // Skip if this update came from a remote broadcast (prevents echo loop)
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false
      return
    }
    const connection = hubRef.current
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !tableId) return
    const syncItems: CartSyncItem[] = cart.map(c => ({
      itemId:            c.item.id,
      quantity:          c.quantity,
      selectedModifiers: c.selectedModifiers,
    }))
    connection.invoke('BroadcastCart', tableId, syncItems).catch(console.error)
  }, [cart, tableId])

  // ── Modifier modal helpers ──────────────────────────────────────────────────

  function openAddModal(item: PublicMenuItem) {
    if (!item.isAvailable) return
    if (item.modifierGroups.length === 0) {
      addToCart(item, {})
    } else {
      setSelectedModifiers({})
      setModifierError('')
      setModalItem(item)
    }
  }

  function toggleModifier(group: PublicModifierGroup, optionId: string) {
    setSelectedModifiers(prev => {
      const current = prev[group.id] ?? []
      if (group.maxSelections === 1) return { ...prev, [group.id]: [optionId] }
      if (current.includes(optionId)) return { ...prev, [group.id]: current.filter(id => id !== optionId) }
      if (current.length >= group.maxSelections) return prev
      return { ...prev, [group.id]: [...current, optionId] }
    })
  }

  function confirmModal() {
    if (!modalItem) return
    for (const group of modalItem.modifierGroups) {
      const selected = selectedModifiers[group.id] ?? []
      if (group.isRequired && selected.length < group.minSelections) {
        setModifierError(
          `Please select at least ${group.minSelections} option(s) for "${group.name}".`
        )
        return
      }
    }
    addToCart(modalItem, selectedModifiers)
    setModalItem(null)
  }

  // ── Cart helpers ────────────────────────────────────────────────────────────

  function addToCart(item: PublicMenuItem, mods: SelectedModifiers) {
    const key = `${item.id}|${JSON.stringify(mods)}`
    setCart(prev => {
      const idx = prev.findIndex(c => `${c.item.id}|${JSON.stringify(c.selectedModifiers)}` === key)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 }
        return updated
      }
      return [...prev, { item, quantity: 1, selectedModifiers: mods }]
    })
  }

  function removeFromCart(index: number) {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const total     = cart.reduce((sum, c) => sum + cartItemPrice(c), 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  // ── Submit order ────────────────────────────────────────────────────────────

  async function submitOrder() {
    if (!tenant || cart.length === 0 || !qrToken) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const order = await placeOrder(tenant, {
        qrToken,
        items: cart.map(c => ({
          menuItemId: c.item.id,
          quantity:   c.quantity,
          notes:      modifiersLabel(c.item, c.selectedModifiers) || undefined,
        })),
      })
      setActiveOrder(order)
      setOrderStatus(order.status)
      setCart([])
      setView('tracking')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t('customer.serverError'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Customer action buttons ────────────────────────────────────────────────

  function showActionMsg(msg: string) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 3000)
  }

  async function handleCallWaiter() {
    if (!tenant || !qrToken) return
    try {
      await callWaiter(tenant, qrToken)
      showActionMsg(t('customer.waiterCalled'))
    } catch {
      showActionMsg(t('customer.serverError'))
    }
  }

  async function handleRequestBill() {
    if (!tenant || !qrToken) return
    try {
      await requestBill(tenant, qrToken)
      showActionMsg(t('customer.billRequested'))
    } catch {
      showActionMsg(t('customer.serverError'))
    }
  }

  // ── Render: loading / error ────────────────────────────────────────────────

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center text-zinc-500">
      {t('customer.loadingMenu')}
    </div>
  )

  if (pageError) return (
    <div className="flex min-h-screen items-center justify-center text-red-500 px-6 text-center">
      {pageError}
    </div>
  )

  const statusLabels: Record<string, string> = {
    Pending:    t('customer.statusReceived'),
    InProgress: t('customer.statusPreparing'),
    Ready:      t('customer.statusReady'),
    Completed:  t('customer.statusServed'),
  }

  // ── Render: order tracking view ────────────────────────────────────────────

  if (view === 'tracking' && activeOrder) {
    const isCancelled = orderStatus === 'Cancelled'
    const currentStep = STATUS_STEPS.indexOf(orderStatus as typeof STATUS_STEPS[number])

    return (
      <div className="mx-auto max-w-md px-4 py-8 min-h-screen flex flex-col">
        <h1 className="text-xl font-bold text-zinc-900 mb-1">{menu?.tenant}</h1>
        <p className="text-sm text-zinc-500 mb-6">{t('customer.orderReceived')}</p>

        {isCancelled ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center text-red-600 font-medium mb-6">
            {t('customer.orderCancelled')}
          </div>
        ) : (
          <div className="mb-6 bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-start justify-between">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1
                    ${i <= currentStep ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                    {i < currentStep ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs text-center leading-tight
                    ${i <= currentStep ? 'text-zinc-800 font-medium' : 'text-zinc-400'}`}>
                    {statusLabels[step]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-4 mb-4">
          <h3 className="font-semibold text-zinc-800 mb-3">{t('customer.orderSummary')}</h3>
          {activeOrder.items.map(item => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-zinc-700">
                {item.quantity}× {item.menuItemName}
                {item.notes && <span className="text-zinc-400 ml-1">({item.notes})</span>}
              </span>
              <span className="text-zinc-500 ml-4 shrink-0">{formatPrice(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-zinc-100 mt-3 pt-3 flex justify-between font-semibold">
            <span>{t('customer.total')}</span>
            <span>{formatPrice(activeOrder.total)}</span>
          </div>
        </div>

        {actionMsg && (
          <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-center py-2 px-4 mb-4">
            {actionMsg}
          </div>
        )}

        {qrToken && (
          <div className="flex gap-3 mb-4">
            <Button variant="secondary" className="flex-1" onClick={handleCallWaiter}>
              🛎 {t('customer.callWaiter')}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={handleRequestBill}>
              🧾 {t('customer.requestBill')}
            </Button>
          </div>
        )}

        <Button variant="ghost" className="w-full" onClick={() => setView('menu')}>
          {t('customer.orderMore')}
        </Button>
      </div>
    )
  }

  // ── Render: menu browse view ───────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-36">
      <h1 className="mb-1 text-2xl font-bold text-zinc-900">{menu?.tenant}</h1>
      <p className="mb-5 text-sm text-zinc-500">{t('customer.tagline')}</p>

      {qrToken && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleCallWaiter}
            className="flex-1 py-2.5 px-3 text-sm rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            🛎 {t('customer.callWaiter')}
          </button>
          <button
            onClick={handleRequestBill}
            className="flex-1 py-2.5 px-3 text-sm rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            🧾 {t('customer.requestBill')}
          </button>
        </div>
      )}

      {actionMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-center py-2 px-4 mb-4">
          {actionMsg}
        </div>
      )}

      {menu?.categories.map(cat => (
        <section key={cat.id} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-zinc-800">{cat.name}</h2>
          <div className="flex flex-col gap-3">
            {cat.items.map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-xl border p-4 bg-white
                  ${item.isAvailable ? 'border-zinc-200' : 'border-zinc-100 opacity-50'}`}
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                  {item.modifierGroups.length > 0 && item.isAvailable && (
                    <p className="text-xs text-zinc-400 mt-1">{t('customer.customizable')}</p>
                  )}
                  <p className="mt-1 font-semibold text-brand">{formatPrice(item.price)}</p>
                </div>
                <div className="shrink-0 self-center">
                  {item.isAvailable ? (
                    <Button size="sm" onClick={() => openAddModal(item)}>
                      {t('customer.add')}
                    </Button>
                  ) : (
                    <span className="text-xs text-zinc-400">{t('customer.unavailable')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Floating cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 shadow-2xl">
          <div className="mx-auto max-w-2xl px-4 py-4">
            {cartSyncMsg && (
              <p className="text-xs text-zinc-500 text-center mb-2">
                🔄 {t('customer.cartSynced')}
              </p>
            )}
            <div className="mb-3 flex flex-col gap-1.5">
              {cart.map((c, i) => {
                const label = modifiersLabel(c.item, c.selectedModifiers)
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-800 truncate flex-1 mr-2">
                      {c.quantity}× {c.item.name}
                      {label && <span className="text-zinc-400 ml-1">({label})</span>}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-zinc-500">{formatPrice(cartItemPrice(c))}</span>
                      <button
                        onClick={() => removeFromCart(i)}
                        className="text-zinc-400 hover:text-zinc-700 text-base leading-none"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {submitError && <p className="text-xs text-red-500 mb-2">{submitError}</p>}

            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-900">
                {cartCount} item{cartCount !== 1 ? 's' : ''} · {formatPrice(total)}
              </span>
              <Button onClick={submitOrder} disabled={submitting || !qrToken}>
                {submitting ? t('customer.placing') : t('customer.placeOrder')}
              </Button>
            </div>
            {!qrToken && (
              <p className="mt-1 text-xs text-red-400">{t('customer.noQrToken')}</p>
            )}
          </div>
        </div>
      )}

      {/* Modifier modal */}
      {modalItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalItem(null) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">{modalItem.name}</h3>
              {modalItem.description && (
                <p className="text-sm text-zinc-500 mt-1">{modalItem.description}</p>
              )}
              <p className="font-semibold text-brand mt-2">{formatPrice(modalItem.price)}</p>
            </div>

            <div className="px-6 py-4 flex flex-col gap-5">
              {modalItem.modifierGroups.map(group => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-medium text-zinc-800">{group.name}</p>
                    {group.isRequired && (
                      <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">
                        {t('customer.required')}
                      </span>
                    )}
                    {group.maxSelections > 1 && (
                      <span className="text-xs text-zinc-400">
                        {t('customer.upTo', { count: group.maxSelections })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.options.map(opt => {
                      const selected = (selectedModifiers[group.id] ?? []).includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleModifier(group, opt.id)}
                          className={`flex justify-between items-center p-3 rounded-xl border text-left transition-colors
                            ${selected
                              ? 'border-brand bg-orange-50 text-zinc-900'
                              : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'
                            }`}
                        >
                          <span className="text-sm">{opt.name}</span>
                          {opt.priceDelta !== 0 && (
                            <span className="text-sm text-zinc-500 ml-2">
                              {opt.priceDelta > 0 ? '+' : ''}{formatPrice(opt.priceDelta)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {modifierError && <p className="text-red-500 text-sm">{modifierError}</p>}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setModalItem(null)}>
                {t('customer.cancel')}
              </Button>
              <Button className="flex-1" onClick={confirmModal}>
                {t('customer.addToCart')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
