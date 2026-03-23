import { http, HttpResponse } from 'msw'
import { FIXTURES } from './fixtures'

const BASE = 'http://localhost:5000'

// Helper to build a JWT-like token with a given payload
export function makeToken(payload: Record<string, unknown>) {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

export const handlers = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  http.post(`${BASE}/auth/login`, () => {
    const token = makeToken({
      sub:          'manager@example.com',
      display_name: 'Test Manager',
      role:         'owner',
      tenant_id:    'tenant-1',
    })
    return HttpResponse.json({ accessToken: token, manager: { id: 'mgr-1', email: 'manager@example.com', displayName: 'Test Manager' } })
  }),

  http.post(`${BASE}/auth/logout`, () => HttpResponse.json(null, { status: 204 })),

  // ── Menu (public) ─────────────────────────────────────────────────────────
  http.get(`${BASE}/menu`, () => HttpResponse.json(FIXTURES.menu)),

  // ── Orders ────────────────────────────────────────────────────────────────
  http.get(`${BASE}/orders`, () => HttpResponse.json([FIXTURES.order, FIXTURES.orderInProgress])),

  http.post(`${BASE}/orders`, () =>
    HttpResponse.json(FIXTURES.order, { status: 201 }),
  ),

  http.put(`${BASE}/orders/:id/status`, async ({ params, request }) => {
    const body   = await request.json() as { status: string }
    const updated = { ...FIXTURES.order, id: params.id as string, status: body.status, updatedAt: new Date().toISOString() }
    return HttpResponse.json(updated)
  }),

  http.delete(`${BASE}/orders/:id`, () => new HttpResponse(null, { status: 204 })),

  // ── Tables ────────────────────────────────────────────────────────────────
  http.get(`${BASE}/tables/resolve`, () =>
    HttpResponse.json({ tableId: 'table-1', tableNumber: '5' }),
  ),

  // ── Reports ───────────────────────────────────────────────────────────────
  http.get(`${BASE}/reports/orders/summary`, () => HttpResponse.json(FIXTURES.orderSummary)),
  http.get(`${BASE}/reports/top-items`,      () => HttpResponse.json(FIXTURES.topItems)),
  http.get(`${BASE}/reports/revenue`,        () => HttpResponse.json(FIXTURES.revenueReport)),
  http.get(`${BASE}/reports/busiest-hours`,  () => HttpResponse.json([])),
]
