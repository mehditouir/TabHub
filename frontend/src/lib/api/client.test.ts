import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { apiFetch, ApiError, hubUrl } from './client'

const BASE = 'http://localhost:5000'

beforeEach(() => {
  localStorage.clear()
})

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError(404, 'Not found')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(404)
    expect(err.message).toBe('Not found')
    expect(err.name).toBe('ApiError')
  })
})

describe('apiFetch', () => {
  it('returns JSON on 2xx', async () => {
    server.use(
      http.get(`${BASE}/test`, () => HttpResponse.json({ ok: true })),
    )
    const result = await apiFetch<{ ok: boolean }>('/test')
    expect(result).toEqual({ ok: true })
  })

  it('attaches Authorization header when token present', async () => {
    localStorage.setItem('tabhub_token', 'my-jwt')
    let receivedAuth = ''
    server.use(
      http.get(`${BASE}/test`, ({ request }) => {
        receivedAuth = request.headers.get('Authorization') ?? ''
        return HttpResponse.json({})
      }),
    )
    await apiFetch('/test')
    expect(receivedAuth).toBe('Bearer my-jwt')
  })

  it('attaches X-Tenant header from localStorage', async () => {
    localStorage.setItem('tabhub_tenant', 'cafejasmine')
    let receivedTenant = ''
    server.use(
      http.get(`${BASE}/test`, ({ request }) => {
        receivedTenant = request.headers.get('X-Tenant') ?? ''
        return HttpResponse.json({})
      }),
    )
    await apiFetch('/test')
    expect(receivedTenant).toBe('cafejasmine')
  })

  it('uses explicitTenant over localStorage tenant', async () => {
    localStorage.setItem('tabhub_tenant', 'wrong')
    let receivedTenant = ''
    server.use(
      http.get(`${BASE}/test`, ({ request }) => {
        receivedTenant = request.headers.get('X-Tenant') ?? ''
        return HttpResponse.json({})
      }),
    )
    await apiFetch('/test', {}, 'correct')
    expect(receivedTenant).toBe('correct')
  })

  it('throws ApiError on non-2xx with error body', async () => {
    server.use(
      http.get(`${BASE}/test`, () =>
        HttpResponse.json({ error: 'Not found' }, { status: 404 }),
      ),
    )
    await expect(apiFetch('/test')).rejects.toMatchObject({
      status:  404,
      message: 'Not found',
    })
  })

  it('throws ApiError on non-2xx with fallback to statusText', async () => {
    server.use(
      http.get(`${BASE}/test`, () =>
        new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' }),
      ),
    )
    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError)
  })

  it('returns undefined for 204 No Content', async () => {
    server.use(
      http.delete(`${BASE}/test`, () => new HttpResponse(null, { status: 204 })),
    )
    const result = await apiFetch('/test', { method: 'DELETE' })
    expect(result).toBeUndefined()
  })
})

describe('hubUrl', () => {
  it('builds hub URL with token and tenant', () => {
    localStorage.setItem('tabhub_token', 'tok')
    localStorage.setItem('tabhub_tenant', 'cafejasmine')
    const url = hubUrl()
    expect(url).toBe(`${BASE}/hubs/orders?access_token=tok&X-Tenant=cafejasmine`)
  })

  it('uses empty strings when nothing in localStorage', () => {
    localStorage.clear()
    const url = hubUrl()
    expect(url).toBe(`${BASE}/hubs/orders?access_token=&X-Tenant=`)
  })
})
