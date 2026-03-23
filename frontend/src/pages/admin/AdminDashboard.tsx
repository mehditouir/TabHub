import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTenants, getManagers, createTenant, createManager, assignManager,
  clearAdminToken, getAdminToken,
  type AdminTenant, type AdminManager,
} from '@/lib/api/admin'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'

type Tab = 'tenants' | 'managers'

export function AdminDashboard() {
  const navigate = useNavigate()
  const [tab,      setTab]      = useState<Tab>('tenants')
  const [tenants,  setTenants]  = useState<AdminTenant[]>([])
  const [managers, setManagers] = useState<AdminManager[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // ── Create tenant form ────────────────────────────────────────────────────
  const [newSlug,   setNewSlug]   = useState('')
  const [newName,   setNewName]   = useState('')
  const [tenantErr, setTenantErr] = useState('')
  const [tenantOk,  setTenantOk]  = useState('')
  const [creatingTenant, setCreatingTenant] = useState(false)

  // ── Create manager form ───────────────────────────────────────────────────
  const [mgEmail,    setMgEmail]    = useState('')
  const [mgPassword, setMgPassword] = useState('')
  const [mgName,     setMgName]     = useState('')
  const [mgTenant,   setMgTenant]   = useState('')
  const [mgErr,      setMgErr]      = useState('')
  const [mgOk,       setMgOk]       = useState('')
  const [creatingMg, setCreatingMg] = useState(false)

  // ── Assign manager form ───────────────────────────────────────────────────
  const [assignMgId,     setAssignMgId]     = useState('')
  const [assignTenantId, setAssignTenantId] = useState('')
  const [assignRole,     setAssignRole]     = useState('owner')
  const [assignErr,      setAssignErr]      = useState('')
  const [assignOk,       setAssignOk]       = useState('')
  const [assigning,      setAssigning]      = useState(false)

  const load = useCallback(async () => {
    if (!getAdminToken()) { navigate('/admin/login'); return }
    setLoading(true)
    setError('')
    try {
      const [t, m] = await Promise.all([getTenants(), getManagers()])
      setTenants(t)
      setManagers(m)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('401')) {
        clearAdminToken()
        navigate('/admin/login')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load data.')
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { load() }, [load])

  function logout() {
    clearAdminToken()
    navigate('/admin/login')
  }

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault()
    setTenantErr('')
    setTenantOk('')
    setCreatingTenant(true)
    try {
      await createTenant(newSlug, newName)
      setTenantOk(`Tenant "${newSlug}" created.`)
      setNewSlug('')
      setNewName('')
      load()
    } catch (err: unknown) {
      setTenantErr(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setCreatingTenant(false)
    }
  }

  async function handleCreateManager(e: React.FormEvent) {
    e.preventDefault()
    setMgErr('')
    setMgOk('')
    setCreatingMg(true)
    try {
      await createManager({
        email:       mgEmail,
        password:    mgPassword,
        displayName: mgName,
        tenantId:    mgTenant || undefined,
      })
      setMgOk(`Manager "${mgEmail}" created.`)
      setMgEmail('')
      setMgPassword('')
      setMgName('')
      setMgTenant('')
      load()
    } catch (err: unknown) {
      setMgErr(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setCreatingMg(false)
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setAssignErr('')
    setAssignOk('')
    setAssigning(true)
    try {
      await assignManager(assignTenantId, assignMgId, assignRole)
      setAssignOk('Manager assigned.')
      setAssignMgId('')
      setAssignTenantId('')
      load()
    } catch (err: unknown) {
      setAssignErr(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">TabHub Admin</h1>
        <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
      </header>

      <div className="mx-auto max-w-5xl p-6">
        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {(['tenants', 'managers'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {t === 'tenants' ? `Tenants (${tenants.length})` : `Managers (${managers.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : tab === 'tenants' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tenant list */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 uppercase tracking-wide">All Tenants</h2>
              <div className="space-y-2">
                {tenants.map(t => (
                  <div key={t.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-zinc-900">{t.name}</p>
                        <p className="text-sm text-zinc-500">
                          <code className="rounded bg-zinc-100 px-1">{t.slug}</code>
                          {' · '}schema: <code className="rounded bg-zinc-100 px-1">{t.schemaName}</code>
                        </p>
                      </div>
                      <span className="text-xs text-zinc-400">{t.managerCount} manager{t.managerCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
                {tenants.length === 0 && <p className="text-sm text-zinc-400">No tenants yet.</p>}
              </div>
            </div>

            {/* Create tenant form */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 uppercase tracking-wide">New Tenant</h2>
              <form onSubmit={handleCreateTenant} className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                <Input
                  id="new-slug"
                  label="Slug (URL-safe, e.g. cafejasmine)"
                  placeholder="cafejasmine"
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value)}
                  required
                />
                <Input
                  id="new-name"
                  label="Display name"
                  placeholder="Café Jasmine"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
                {tenantErr && <p className="text-sm text-red-600">{tenantErr}</p>}
                {tenantOk  && <p className="text-sm text-green-600">{tenantOk}</p>}
                <Button type="submit" disabled={creatingTenant}>
                  {creatingTenant ? 'Creating…' : 'Create tenant'}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Manager list */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 uppercase tracking-wide">All Managers</h2>
              <div className="space-y-2">
                {managers.map(m => (
                  <div key={m.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {m.displayName}
                          {m.isSuperAdmin && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">super admin</span>
                          )}
                        </p>
                        <p className="text-sm text-zinc-500">{m.email}</p>
                        {m.tenants.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.tenants.map(t => (
                              <span key={t.tenantId} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                                {t.slug} ({t.role})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs ${m.isActive ? 'text-green-600' : 'text-red-500'}`}>
                        {m.isActive ? 'active' : 'inactive'}
                      </span>
                    </div>
                  </div>
                ))}
                {managers.length === 0 && <p className="text-sm text-zinc-400">No managers yet.</p>}
              </div>
            </div>

            {/* Right column: create + assign forms */}
            <div className="space-y-6">
              {/* Create manager form */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-zinc-700 uppercase tracking-wide">New Manager</h2>
                <form onSubmit={handleCreateManager} className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                  <Input id="mg-name"     label="Display name"     value={mgName}     onChange={e => setMgName(e.target.value)}     required />
                  <Input id="mg-email"    label="Email"            type="email" value={mgEmail}    onChange={e => setMgEmail(e.target.value)}    required />
                  <Input id="mg-password" label="Initial password" type="password" value={mgPassword} onChange={e => setMgPassword(e.target.value)} required />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Assign to tenant (optional)</label>
                    <select
                      value={mgTenant}
                      onChange={e => setMgTenant(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="">— none —</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                      ))}
                    </select>
                  </div>
                  {mgErr && <p className="text-sm text-red-600">{mgErr}</p>}
                  {mgOk  && <p className="text-sm text-green-600">{mgOk}</p>}
                  <Button type="submit" disabled={creatingMg}>
                    {creatingMg ? 'Creating…' : 'Create manager'}
                  </Button>
                </form>
              </div>

              {/* Assign existing manager form */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-zinc-700 uppercase tracking-wide">Assign Manager to Tenant</h2>
                <form onSubmit={handleAssign} className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Manager</label>
                    <select
                      value={assignMgId}
                      onChange={e => setAssignMgId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="">Select manager</option>
                      {managers.filter(m => !m.isSuperAdmin).map(m => (
                        <option key={m.id} value={m.id}>{m.displayName} ({m.email})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Tenant</label>
                    <select
                      value={assignTenantId}
                      onChange={e => setAssignTenantId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="">Select tenant</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Role</label>
                    <select
                      value={assignRole}
                      onChange={e => setAssignRole(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {assignErr && <p className="text-sm text-red-600">{assignErr}</p>}
                  {assignOk  && <p className="text-sm text-green-600">{assignOk}</p>}
                  <Button type="submit" disabled={assigning}>
                    {assigning ? 'Assigning…' : 'Assign'}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
