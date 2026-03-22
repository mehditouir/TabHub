// Shared login page for all roles.
// After login the JWT is decoded to determine the role → redirect accordingly.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [tenant,   setTenant]   = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(tenant, email, password)
      // Role is now in localStorage — read it to decide where to go
      const token = localStorage.getItem('tabhub_token') ?? ''
      const payload = JSON.parse(atob(token.split('.')[1]))
      const role = payload.role as string
      navigate(role === 'owner' || role === 'admin' ? '/manager/dashboard' : '/staff/orders')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">Sign in to TabHub</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="tenant"
            label="Tenant (slug)"
            placeholder="cafejasmine"
            value={tenant}
            onChange={e => setTenant(e.target.value)}
            required
            autoComplete="off"
          />
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="manager@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
