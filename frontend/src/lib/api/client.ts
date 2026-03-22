// Base API fetch wrapper.
// Automatically attaches the JWT and X-Tenant header from localStorage.
// Throws ApiError for non-2xx responses so callers can handle them uniformly.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  explicitTenant?: string,
): Promise<T> {
  const token  = localStorage.getItem('tabhub_token')
  const tenant = explicitTenant ?? localStorage.getItem('tabhub_tenant') ?? ''

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token  ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { 'X-Tenant': tenant }               : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Full URL to the SignalR hub, including the access_token query param. */
export function hubUrl(): string {
  const token  = localStorage.getItem('tabhub_token') ?? ''
  const tenant = localStorage.getItem('tabhub_tenant') ?? ''
  return `${API_URL}/hubs/orders?access_token=${token}&X-Tenant=${tenant}`
}

/** Hub URL for anonymous customer connections (no auth token). */
export function customerHubUrl(tenant: string, tableId?: string): string {
  const params = new URLSearchParams({ 'X-Tenant': tenant })
  if (tableId) params.set('tableId', tableId)
  return `${API_URL}/hubs/orders?${params}`
}
