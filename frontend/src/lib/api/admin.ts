const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
const ADMIN_TOKEN_KEY = 'tabhub_admin_token'

/** Fetch wrapper that sends the super-admin JWT (no X-Tenant header). */
async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY)
  const res   = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface AdminLoginResponse {
  accessToken: string
  managerId:   string
  displayName: string
  email:       string
}

export interface AdminTenant {
  id:           string
  slug:         string
  name:         string
  schemaName:   string
  status:       string
  managerCount: number
}

export interface AdminManagerTenant {
  tenantId: string
  slug:     string
  name:     string
  role:     string
}

export interface AdminManager {
  id:          string
  email:       string
  displayName: string
  isActive:    boolean
  isSuperAdmin: boolean
  tenants:     AdminManagerTenant[]
}

export function adminLogin(email: string, password: string) {
  return adminFetch<AdminLoginResponse>('/admin/auth/login', {
    method: 'POST',
    body:   JSON.stringify({ email, password }),
  })
}

export function getTenants() {
  return adminFetch<AdminTenant[]>('/admin/tenants')
}

export function createTenant(slug: string, name: string) {
  return adminFetch<{ id: string; slug: string; name: string }>('/admin/tenants', {
    method: 'POST',
    body:   JSON.stringify({ slug, name }),
  })
}

export function getManagers() {
  return adminFetch<AdminManager[]>('/admin/managers')
}

export function createManager(data: {
  email: string
  password: string
  displayName: string
  tenantId?: string
}) {
  return adminFetch<{ id: string; email: string; displayName: string }>('/admin/managers', {
    method: 'POST',
    body:   JSON.stringify(data),
  })
}

export function assignManager(tenantId: string, managerId: string, role: string) {
  return adminFetch<{ message: string }>(`/admin/tenants/${tenantId}/managers`, {
    method: 'POST',
    body:   JSON.stringify({ managerId, role }),
  })
}

export function saveAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}
