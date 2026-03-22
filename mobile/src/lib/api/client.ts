const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5195'

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
  const token  = localStorage.getItem('waiter_token')
  const tenant = explicitTenant ?? localStorage.getItem('waiter_tenant') ?? ''

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

/** Hub URL with staff JWT and tenant for SignalR connection. */
export function hubUrl(): string {
  const token  = localStorage.getItem('waiter_token') ?? ''
  const tenant = localStorage.getItem('waiter_tenant') ?? ''
  return `${API_URL}/hubs/orders?access_token=${token}&X-Tenant=${tenant}`
}

/** Fetches the PDF bill and returns a blob object URL for display. */
export async function fetchBillBlobUrl(orderId: string): Promise<string> {
  const token  = localStorage.getItem('waiter_token') ?? ''
  const tenant = localStorage.getItem('waiter_tenant') ?? ''
  const res = await fetch(`${API_URL}/orders/${orderId}/bill.pdf`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant': tenant,
    },
  })
  if (!res.ok) throw new ApiError(res.status, 'Failed to fetch bill')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
