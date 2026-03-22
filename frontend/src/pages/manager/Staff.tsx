import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getStaff, createStaff, updateStaff, setStaffPin, deleteStaff } from '@/lib/api/staff'
import type { StaffMember } from '@/lib/types'

const ROLES = ['Waiter', 'Cashier', 'Kitchen'] as const

const inputCls = 'rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand'

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

// ── StaffFormModal ─────────────────────────────────────────────────────────

interface StaffFormModalProps {
  initial?: StaffMember
  onSave:   (data: { displayName: string; role: string; pin: string; isActive: boolean }) => Promise<void>
  onDelete?: () => Promise<void>
  onClose:  () => void
}

function StaffFormModal({ initial, onSave, onDelete, onClose }: StaffFormModalProps) {
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '')
  const [role,        setRole]        = useState<string>(initial?.role ?? 'Waiter')
  const [pin,         setPin]         = useState('')
  const [isActive,    setIsActive]    = useState(initial?.isActive ?? true)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!initial && pin.length < 4) return
    setSaving(true)
    try { await onSave({ displayName, role, pin, isActive }) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try { await onDelete() }
    finally { setDeleting(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {initial ? t('staff.editMember') : t('staff.newMember')}
        </h2>

        <label className="flex flex-col gap-1 text-sm">
          {t('staff.displayName')}
          <input
            className={inputCls}
            value={displayName} onChange={e => setDisplayName(e.target.value)}
            required maxLength={100} autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('staff.role')}
          <select className={inputCls} value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('staff.pin')} {initial ? t('staff.pinEdit') : t('staff.pinNew')}
          <input
            type="password"
            className={inputCls}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder={initial ? '••••' : ''}
            minLength={initial ? 0 : 4}
            pattern={initial ? undefined : '\\d{4,8}'}
          />
        </label>

        {initial && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            {t('common.active')}
          </label>
        )}

        <div className="flex items-center justify-between pt-2">
          {onDelete ? (
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
    </Overlay>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  Waiter:  'bg-blue-50 text-blue-700',
  Cashier: 'bg-purple-50 text-purple-700',
  Kitchen: 'bg-orange-50 text-orange-700',
}

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] ?? 'bg-zinc-100 text-zinc-600'
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{role}</span>
  )
}

// ── Staff (main page) ─────────────────────────────────────────────────────────

export function Staff() {
  const { t } = useTranslation()
  const [staff,   setStaff]   = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'create' | StaffMember | null>(null)

  useEffect(() => {
    getStaff()
      .then(setStaff)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(data: { displayName: string; role: string; pin: string }) {
    const created = await createStaff(data)
    setStaff(prev => [...prev, created])
    setModal(null)
  }

  async function handleUpdate(member: StaffMember, data: { displayName: string; role: string; pin: string; isActive: boolean }) {
    const updated = await updateStaff(member.id, { displayName: data.displayName, role: data.role, isActive: data.isActive })
    if (data.pin.length >= 4) {
      await setStaffPin(member.id, data.pin)
    }
    setStaff(prev => prev.map(s => s.id === updated.id ? updated : s))
    setModal(null)
  }

  async function handleDelete(member: StaffMember) {
    if (!confirm(t('staff.deleteConfirm', { name: member.displayName }))) return
    await deleteStaff(member.id)
    setStaff(prev => prev.filter(s => s.id !== member.id))
    setModal(null)
  }

  if (loading) return <div className="text-zinc-500">{t('common.loading')}</div>

  const isEdit = modal !== null && modal !== 'create'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">{t('staff.title')}</h1>
        <button
          onClick={() => setModal('create')}
          className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand/80"
        >
          {t('staff.newStaff')}
        </button>
      </div>

      {/* List */}
      {staff.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 p-12 text-center text-zinc-400">
          {t('staff.noStaff')}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {staff.map(member => (
            <div key={member.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{member.displayName}</span>
                  {!member.isActive && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400">{t('common.inactive')}</span>
                  )}
                </div>
              </div>
              <RoleBadge role={member.role} />
              <button
                onClick={() => setModal(member)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                {t('common.edit')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <StaffFormModal
          initial={isEdit ? (modal as StaffMember) : undefined}
          onSave={
            isEdit
              ? data => handleUpdate(modal as StaffMember, data)
              : data => handleCreate(data)
          }
          onDelete={isEdit ? () => handleDelete(modal as StaffMember) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
