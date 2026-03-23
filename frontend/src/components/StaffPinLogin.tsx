// Reusable PIN login panel for kitchen and cashier apps.

import { useState } from 'react'
import { staffPinLogin } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import type { StaffUser } from '@/lib/types'

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'] as const

interface Props {
  appName:    string
  allowedRole: string  // 'kitchen' | 'cashier'
  onSuccess:  (user: StaffUser) => void
}

export function StaffPinLogin({ appName, allowedRole, onSuccess }: Props) {
  const [tenant,  setTenant]  = useState('')
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleDigit = (d: number) => { if (pin.length < 6) setPin(p => p + d) }
  const handleDel   = () => setPin(p => p.slice(0, -1))

  async function handleSubmit() {
    if (!tenant.trim()) { setError('Enter restaurant slug'); return }
    if (pin.length < 4)  { setError('PIN must be at least 4 digits'); return }
    setError('')
    setLoading(true)
    try {
      const res = await staffPinLogin(tenant.trim().toLowerCase(), pin)
      if (res.role.toLowerCase() !== allowedRole) {
        setError(`This app is for ${allowedRole} staff only.`)
        return
      }
      localStorage.setItem('tabhub_token',  res.accessToken)
      localStorage.setItem('tabhub_tenant', tenant.trim().toLowerCase())
      onSuccess({ staffId: res.staffId, displayName: res.displayName, role: res.role, tenant: tenant.trim().toLowerCase() })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl">
        <h1 className="text-2xl font-bold text-white text-center mb-1">TabHub</h1>
        <p className="text-zinc-400 text-center text-sm mb-8">{appName}</p>

        {/* Tenant */}
        <input
          type="text"
          placeholder="Restaurant slug (e.g. cafetunisia)"
          value={tenant}
          onChange={e => setTenant(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm mb-6 focus:outline-none focus:border-zinc-500"
        />

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full transition-colors ${
                pin.length > i ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
        <p className="text-center text-zinc-500 text-xs mb-4">Enter your PIN</p>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {DIGITS.map((d, i) => {
            if (d === null) return <div key={i} />
            return (
              <button
                key={i}
                onClick={() => d === 'del' ? handleDel() : handleDigit(d)}
                className="h-16 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xl transition-colors active:scale-95"
              >
                {d === 'del' ? '⌫' : d}
              </button>
            )
          })}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4 || !tenant.trim()}
          className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </div>
    </div>
  )
}
