import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import {
  getSpaces, createSpace, updateSpace, deleteSpace,
  getTables, createTable, updateTable, deleteTable,
} from '@/lib/api/spaces'
import { getStaff, getWaiterZones, createWaiterZone, deleteWaiterZone } from '@/lib/api/staff'
import { getOrders } from '@/lib/api/orders'
import type { Space, Table, StaffMember, WaiterZone } from '@/lib/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function tableUrl(tenant: string, qrToken: string) {
  return `${window.location.origin}/menu/${tenant}?table=${qrToken}`
}

function useQrDataUrl(text: string) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    if (!text) { setDataUrl(''); return }
    QRCode.toDataURL(text, { width: 200, margin: 2 }).then(setDataUrl)
  }, [text])
  return dataUrl
}

// ── Overlay ───────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {children}
      </div>
    </div>
  )
}

// ── SpaceFormModal ────────────────────────────────────────────────────────────

interface SpaceFormModalProps {
  initial?: Space
  onSave: (data: { name: string; cols: number; rows: number; sortOrder: number; isActive: boolean }) => Promise<void>
  onClose: () => void
}

function SpaceFormModal({ initial, onSave, onClose }: SpaceFormModalProps) {
  const { t } = useTranslation()
  const [name,      setName]      = useState(initial?.name      ?? '')
  const [cols,      setCols]      = useState(initial?.cols      ?? 5)
  const [rows,      setRows]      = useState(initial?.rows      ?? 4)
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)
  const [isActive,  setIsActive]  = useState(initial?.isActive  ?? true)
  const [saving,    setSaving]    = useState(false)

  const inputCls = 'rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await onSave({ name, cols, rows, sortOrder, isActive }) }
    finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{initial ? t('spaces.editSpace') : t('spaces.newSpaceTitle')}</h2>

        <label className="flex flex-col gap-1 text-sm">
          {t('common.name')}
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} required maxLength={100} autoFocus />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t('spaces.columns')}
            <input type="number" min={1} max={20} className={inputCls}
              value={cols} onChange={e => setCols(Number(e.target.value))} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('spaces.rows')}
            <input type="number" min={1} max={20} className={inputCls}
              value={rows} onChange={e => setRows(Number(e.target.value))} required />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {t('common.sortOrder')}
          <input type="number" min={0} className={inputCls}
            value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </label>

        {initial && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            {t('common.active')}
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-60">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Overlay>
  )
}

// ── TableModal ────────────────────────────────────────────────────────────────

interface TableModalProps {
  table?: Table; spaceId: string; col: number; row: number; tenant: string
  onSave: (t: Table) => void; onDelete: (id: string) => void; onClose: () => void
}

function TableModal({ table, spaceId, col, row, tenant, onSave, onDelete, onClose }: TableModalProps) {
  const { t } = useTranslation()
  const [number,   setNumber]   = useState(table?.number   ?? '')
  const [isActive, setIsActive] = useState(table?.isActive ?? true)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied,   setCopied]   = useState(false)

  const url    = table ? tableUrl(tenant, table.qrToken) : ''
  const qrData = useQrDataUrl(url)

  const inputCls = 'rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = table
        ? await updateTable(table.id, { number, col, row, isActive })
        : await createTable({ spaceId, number, col, row })
      onSave(saved)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!table) return
    setDeleting(true)
    try { await deleteTable(table.id); onDelete(table.id) }
    finally { setDeleting(false) }
  }

  function copyUrl() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function downloadQr() {
    const link = document.createElement('a')
    link.href = qrData
    link.download = `table-${table?.number ?? 'qr'}.png`
    link.click()
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {table ? `Table ${table.number}` : `Add table — cell (${col + 1}, ${row + 1})`}
        </h2>

        {table && qrData && (
          <div className="flex flex-col items-center gap-2">
            <img src={qrData} alt={`QR for table ${table.number}`} className="h-36 w-36" />
            <div className="flex w-full items-center gap-2">
              <input readOnly value={url}
                className="min-w-0 flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-500" />
              <button onClick={copyUrl}
                className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100">
                {copied ? '✓' : 'Copy'}
              </button>
              <button onClick={downloadQr}
                className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100">
                ↓
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t('spaces.tableNumber')}
            <input className={inputCls} value={number} onChange={e => setNumber(e.target.value)}
              required maxLength={20} autoFocus={!table} />
          </label>

          {table && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              {t('common.active')}
            </label>
          )}

          <div className="flex items-center justify-between pt-2">
            {table ? (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60">
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving}
                className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-60">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Overlay>
  )
}

// ── SpaceGrid (editor) ────────────────────────────────────────────────────────

interface SpaceGridProps {
  space: Space; tables: Table[]; tenant: string
  onTableSave: (t: Table) => void; onTableDelete: (id: string) => void
}

function SpaceGrid({ space, tables, tenant, onTableSave, onTableDelete }: SpaceGridProps) {
  const { t } = useTranslation()
  type CellModal = { col: number; row: number; table?: Table }
  const [modal, setModal] = useState<CellModal | null>(null)

  const tableAt = (col: number, row: number) => tables.find(t => t.col === col && t.row === row)

  return (
    <div>
      <div className="grid gap-1.5 w-fit"
        style={{
          gridTemplateColumns: `repeat(${space.cols}, 3rem)`,
          gridTemplateRows:    `repeat(${space.rows}, 3rem)`,
        }}>
        {Array.from({ length: space.rows }, (_, row) =>
          Array.from({ length: space.cols }, (_, col) => {
            const tbl = tableAt(col, row)
            return (
              <button key={`${col}-${row}`}
                onClick={() => setModal({ col, row, table: tbl })}
                title={tbl ? `Table ${tbl.number}${tbl.isActive ? '' : ' (inactive)'}` : `Add table at (${col + 1}, ${row + 1})`}
                className={[
                  'flex items-center justify-center rounded text-xs font-semibold transition-colors',
                  tbl
                    ? tbl.isActive
                      ? 'bg-brand text-white hover:bg-brand/80'
                      : 'bg-zinc-300 text-zinc-500 hover:bg-zinc-400'
                    : 'border-2 border-dashed border-zinc-200 text-zinc-300 hover:border-zinc-400 hover:text-zinc-500',
                ].join(' ')}>
                {tbl ? tbl.number : '+'}
              </button>
            )
          })
        )}
      </div>
      <p className="mt-3 text-xs text-zinc-400">{t('spaces.editorHint')}</p>

      {modal && (
        <TableModal
          table={modal.table} spaceId={space.id} col={modal.col} row={modal.row} tenant={tenant}
          onSave={tbl => { onTableSave(tbl); setModal(null) }}
          onDelete={id => { onTableDelete(id); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── LiveFloorPlan ─────────────────────────────────────────────────────────────

type TableStatus = 'free' | 'pending' | 'inprogress' | 'ready'

const STATUS_PRIORITY: Record<string, number> = { pending: 3, inprogress: 2, ready: 1 }

const STATUS_CELL_CLS: Record<TableStatus, string> = {
  free:       'border-2 border-dashed border-zinc-200 text-zinc-400',
  pending:    'bg-amber-400 text-white',
  inprogress: 'bg-blue-500 text-white',
  ready:      'bg-green-500 text-white',
}

interface LiveFloorPlanProps { space: Space; tables: Table[] }

function LiveFloorPlan({ space, tables }: LiveFloorPlanProps) {
  const { t } = useTranslation()
  const [statusMap, setStatusMap] = useState<Record<string, TableStatus>>({})
  const [refreshing, setRefreshing] = useState(false)

  async function loadStatuses() {
    setRefreshing(true)
    try {
      const orders = await getOrders()
      const map: Record<string, TableStatus> = {}
      for (const order of orders) {
        if (!order.tableId) continue
        if (order.status === 'Completed' || order.status === 'Cancelled') continue
        const raw = order.status === 'InProgress' ? 'inprogress' : order.status.toLowerCase() as TableStatus
        const current = map[order.tableId]
        if (!current || (STATUS_PRIORITY[raw] ?? 0) > (STATUS_PRIORITY[current] ?? 0)) {
          map[order.tableId] = raw
        }
      }
      setStatusMap(map)
    } finally { setRefreshing(false) }
  }

  useEffect(() => {
    loadStatuses()
    const id = setInterval(loadStatuses, 30_000)
    return () => clearInterval(id)
  }, [])

  const tableAt = (col: number, row: number) => tables.find(t => t.col === col && t.row === row)

  const LEGEND: { status: TableStatus; key: string }[] = [
    { status: 'free',       key: 'spaces.free'            },
    { status: 'pending',    key: 'spaces.pendingOrders'   },
    { status: 'inprogress', key: 'spaces.ordersInProgress'},
    { status: 'ready',      key: 'spaces.ordersReady'     },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400">{t('spaces.legend')}:</span>
        {LEGEND.map(({ status, key }) => (
          <span key={status} className="flex items-center gap-1 text-xs text-zinc-600">
            <span className={`inline-block h-3 w-3 rounded ${STATUS_CELL_CLS[status].split(' ')[0]}`} />
            {t(key)}
          </span>
        ))}
        <button onClick={loadStatuses} disabled={refreshing}
          className="ms-auto text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-40">
          ↻
        </button>
      </div>

      <div className="grid gap-1.5 w-fit"
        style={{
          gridTemplateColumns: `repeat(${space.cols}, 3rem)`,
          gridTemplateRows:    `repeat(${space.rows}, 3rem)`,
        }}>
        {Array.from({ length: space.rows }, (_, row) =>
          Array.from({ length: space.cols }, (_, col) => {
            const tbl    = tableAt(col, row)
            const status: TableStatus = tbl ? (statusMap[tbl.id] ?? 'free') : 'free'
            const cls    = tbl
              ? [STATUS_CELL_CLS[status], 'cursor-default'].join(' ')
              : 'bg-zinc-100 cursor-default'
            return (
              <div key={`${col}-${row}`}
                title={tbl ? `Table ${tbl.number}` : ''}
                className={`flex items-center justify-center rounded text-xs font-semibold ${cls}`}>
                {tbl ? tbl.number : ''}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── ZoneEditor ────────────────────────────────────────────────────────────────

const ZONE_COLORS = [
  'bg-violet-200 text-violet-800',
  'bg-teal-200 text-teal-800',
  'bg-rose-200 text-rose-800',
  'bg-sky-200 text-sky-800',
  'bg-lime-200 text-lime-800',
]

interface ZoneEditorProps { space: Space; tables: Table[]; waiters: StaffMember[] }

function ZoneEditor({ space, tables, waiters }: ZoneEditorProps) {
  const { t } = useTranslation()
  const [waiterId,  setWaiterId]  = useState<string>(waiters[0]?.id ?? '')
  const [zones,     setZones]     = useState<WaiterZone[]>([])
  const [loadingZ,  setLoadingZ]  = useState(false)
  const [drag,      setDrag]      = useState<{ start: { col: number; row: number }; end: { col: number; row: number } } | null>(null)
  const isDragging = useRef(false)

  // Load zones when waiter changes
  useEffect(() => {
    if (!waiterId) return
    setLoadingZ(true)
    getWaiterZones(waiterId)
      .then(z => setZones(z.filter(z => z.spaceId === space.id)))
      .catch(console.error)
      .finally(() => setLoadingZ(false))
  }, [waiterId, space.id])

  // Cancel drag on mouseup outside grid
  useEffect(() => {
    function onMouseUp() {
      if (isDragging.current) {
        isDragging.current = false
        setDrag(null)
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  function isCellInZone(col: number, row: number, zone: WaiterZone) {
    return col >= zone.colStart && col <= zone.colEnd
        && row >= zone.rowStart && row <= zone.rowEnd
  }

  function isCellInDrag(col: number, row: number) {
    if (!drag) return false
    const minC = Math.min(drag.start.col, drag.end.col)
    const maxC = Math.max(drag.start.col, drag.end.col)
    const minR = Math.min(drag.start.row, drag.end.row)
    const maxR = Math.max(drag.start.row, drag.end.row)
    return col >= minC && col <= maxC && row >= minR && row <= maxR
  }

  async function commitDrag() {
    if (!drag || !waiterId) return
    const colStart = Math.min(drag.start.col, drag.end.col)
    const colEnd   = Math.max(drag.start.col, drag.end.col)
    const rowStart = Math.min(drag.start.row, drag.end.row)
    const rowEnd   = Math.max(drag.start.row, drag.end.row)
    try {
      const created = await createWaiterZone(waiterId, { spaceId: space.id, colStart, colEnd, rowStart, rowEnd })
      setZones(prev => [...prev, created])
    } catch (err) { console.error(err) }
  }

  async function handleRemoveZone(zone: WaiterZone) {
    await deleteWaiterZone(waiterId, zone.id)
    setZones(prev => prev.filter(z => z.id !== zone.id))
  }

  const tableAt = (col: number, row: number) => tables.find(t => t.col === col && t.row === row)

  if (waiters.length === 0) {
    return <p className="text-sm text-zinc-400">{t('spaces.noWaiters')}</p>
  }

  const waiter = waiters.find(w => w.id === waiterId)

  return (
    <div className="flex flex-col gap-4">
      {/* Waiter selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-600">{t('spaces.selectWaiter')}</label>
        <select
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          value={waiterId} onChange={e => setWaiterId(e.target.value)}>
          {waiters.map(w => <option key={w.id} value={w.id}>{w.displayName}</option>)}
        </select>
      </div>

      <p className="text-xs text-zinc-400">{t('spaces.dragHint')}</p>

      {/* Zone grid */}
      {loadingZ ? (
        <div className="text-zinc-500 text-sm">{t('common.loading')}</div>
      ) : (
        <div
          className="grid gap-1.5 w-fit select-none"
          style={{
            gridTemplateColumns: `repeat(${space.cols}, 3rem)`,
            gridTemplateRows:    `repeat(${space.rows}, 3rem)`,
          }}
          onMouseLeave={() => {
            if (isDragging.current) {
              isDragging.current = false
              setDrag(null)
            }
          }}>
          {Array.from({ length: space.rows }, (_, row) =>
            Array.from({ length: space.cols }, (_, col) => {
              const tbl        = tableAt(col, row)
              const zoneIdx    = zones.findIndex(z => isCellInZone(col, row, z))
              const inDrag     = isCellInDrag(col, row)
              const colorCls   = zoneIdx >= 0 ? ZONE_COLORS[zoneIdx % ZONE_COLORS.length] : ''

              let cls = 'flex items-center justify-center rounded text-xs font-semibold cursor-crosshair transition-colors border '
              if (inDrag)        cls += 'bg-brand/30 border-brand '
              else if (colorCls) cls += colorCls + ' border-transparent '
              else               cls += 'border-dashed border-zinc-200 text-zinc-300 '

              return (
                <div key={`${col}-${row}`}
                  className={cls}
                  onMouseDown={e => {
                    e.preventDefault()
                    isDragging.current = true
                    setDrag({ start: { col, row }, end: { col, row } })
                  }}
                  onMouseEnter={() => {
                    if (isDragging.current) {
                      setDrag(prev => prev ? { ...prev, end: { col, row } } : prev)
                    }
                  }}
                  onMouseUp={() => {
                    if (isDragging.current) {
                      isDragging.current = false
                      commitDrag()
                      setDrag(null)
                    }
                  }}>
                  {tbl ? tbl.number : ''}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Zone list */}
      {waiter && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-700">{t('spaces.zonesFor', { name: waiter.displayName })}</p>
          {zones.length === 0 ? (
            <p className="text-xs text-zinc-400">{t('spaces.noZones')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {zones.map((zone, i) => (
                <li key={zone.id} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${ZONE_COLORS[i % ZONE_COLORS.length]}`}>
                  <span>
                    {t('spaces.colRange', { start: zone.colStart + 1, end: zone.colEnd + 1 })}
                    {' · '}
                    {t('spaces.rowRange', { start: zone.rowStart + 1, end: zone.rowEnd + 1 })}
                  </span>
                  <button
                    onClick={() => handleRemoveZone(zone)}
                    className="ms-auto opacity-70 hover:opacity-100">
                    × {t('spaces.removeZone')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Spaces (main page) ────────────────────────────────────────────────────────

type SpaceTab = 'editor' | 'live' | 'zones'

export function Spaces() {
  const { t } = useTranslation()
  const [spaces,     setSpaces]     = useState<Space[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tables,     setTables]     = useState<Table[]>([])
  const [waiters,    setWaiters]    = useState<StaffMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<SpaceTab>('editor')
  const [spaceModal, setSpaceModal] = useState<'create' | Space | null>(null)

  const tenant = localStorage.getItem('tabhub_tenant') ?? ''

  useEffect(() => {
    Promise.all([getSpaces(), getStaff()])
      .then(([sp, staff]) => {
        setSpaces(sp)
        if (sp.length > 0) setSelectedId(sp[0].id)
        setWaiters(staff.filter(s => s.role === 'Waiter' && s.isActive))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const selectedSpace = spaces.find(s => s.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) { setTables([]); return }
    getTables(selectedId).then(setTables).catch(console.error)
  }, [selectedId])

  async function handleCreateSpace(data: { name: string; cols: number; rows: number; sortOrder: number; isActive: boolean }) {
    const { isActive: _ignored, ...createData } = data
    const created = await createSpace(createData)
    setSpaces(prev => [...prev, created])
    setSelectedId(created.id)
    setSpaceModal(null)
  }

  async function handleUpdateSpace(data: { name: string; cols: number; rows: number; sortOrder: number; isActive: boolean }) {
    if (!selectedId) return
    const updated = await updateSpace(selectedId, data)
    setSpaces(prev => prev.map(s => s.id === updated.id ? updated : s))
    setSpaceModal(null)
  }

  async function handleDeleteSpace() {
    if (!selectedId) return
    if (!confirm('Delete this space and all its tables? This cannot be undone.')) return
    await deleteSpace(selectedId)
    const remaining = spaces.filter(s => s.id !== selectedId)
    setSpaces(remaining)
    setSelectedId(remaining[0]?.id ?? null)
    setTables([])
  }

  function handleTableSave(tbl: Table) {
    setTables(prev => {
      const idx = prev.findIndex(x => x.id === tbl.id)
      return idx === -1 ? [...prev, tbl] : prev.map(x => x.id === tbl.id ? tbl : x)
    })
  }

  function handleTableDelete(id: string) {
    setTables(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return <div className="text-zinc-500">{t('common.loading')}</div>

  const TABS: { key: SpaceTab; label: string }[] = [
    { key: 'editor', label: t('spaces.tabEditor') },
    { key: 'live',   label: t('spaces.tabLive')   },
    { key: 'zones',  label: t('spaces.tabZones')  },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">{t('spaces.title')}</h1>
        <button
          onClick={() => setSpaceModal('create')}
          className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand/80">
          {t('spaces.newSpace')}
        </button>
      </div>

      {spaces.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 p-12 text-center text-zinc-400">
          {t('spaces.noSpaces')}
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Space list */}
          <div className="flex w-44 shrink-0 flex-col gap-1">
            {spaces.map(s => (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className={[
                  'flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  s.id === selectedId ? 'bg-brand text-white' : 'text-zinc-700 hover:bg-zinc-100',
                ].join(' ')}>
                <span className="truncate font-medium">{s.name}</span>
                {!s.isActive && (
                  <span className={`ml-1 shrink-0 text-xs ${s.id === selectedId ? 'text-white/70' : 'text-zinc-400'}`}>off</span>
                )}
              </button>
            ))}
          </div>

          {/* Content panel */}
          {selectedSpace && (
            <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-5">
              {/* Space header */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-900">{selectedSpace.name}</h2>
                  <p className="text-xs text-zinc-400">
                    {selectedSpace.cols} cols × {selectedSpace.rows} rows
                    {' · '}{tables.length} table{tables.length !== 1 ? 's' : ''}
                    {!selectedSpace.isActive && ' · inactive'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSpaceModal(selectedSpace)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
                    {t('common.edit')}
                  </button>
                  <button onClick={handleDeleteSpace}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-4 flex gap-1 border-b border-zinc-100">
                {TABS.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={[
                      'px-4 py-2 text-sm font-medium transition-colors',
                      activeTab === tab.key
                        ? 'border-b-2 border-brand text-brand'
                        : 'text-zinc-500 hover:text-zinc-700',
                    ].join(' ')}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'editor' && (
                <SpaceGrid
                  space={selectedSpace} tables={tables} tenant={tenant}
                  onTableSave={handleTableSave} onTableDelete={handleTableDelete}
                />
              )}
              {activeTab === 'live' && (
                <LiveFloorPlan space={selectedSpace} tables={tables} />
              )}
              {activeTab === 'zones' && (
                <ZoneEditor space={selectedSpace} tables={tables} waiters={waiters} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Space form modal */}
      {spaceModal !== null && (
        <SpaceFormModal
          initial={spaceModal === 'create' ? undefined : spaceModal}
          onSave={spaceModal === 'create' ? handleCreateSpace : handleUpdateSpace}
          onClose={() => setSpaceModal(null)}
        />
      )}
    </div>
  )
}
