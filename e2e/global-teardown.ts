/**
 * global-teardown.ts — runs once after all tests.
 *
 * Deletes all E2E-prefixed entities created during the test run:
 *   - Spaces (named "E2E …")  — tables cascade
 *   - Staff  (named "E2E …")
 *   - Categories (named "E2E …") — menu items cascade
 *
 * Non-fatal: if cleanup fails the test results are unaffected.
 * Combined with find-or-create in tests → data never accumulates.
 */

import * as dotenv from 'dotenv'
import * as path   from 'path'

dotenv.config({ path: path.join(__dirname, '.env') })

const API_URL = process.env.API_URL     ?? 'https://tabhub-api-caguf5bkb7b9bzca.francecentral-01.azurewebsites.net'
const TENANT  = process.env.MANAGER_TENANT   ?? 'cafetunisia'
const EMAIL   = process.env.MANAGER_EMAIL    ?? 'mehdi@cafetunisia.com'
const PASSWORD = process.env.MANAGER_PASSWORD ?? 'mehdi123'

async function getToken(): Promise<string> {
  const res  = await fetch(`${API_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant': TENANT },
    body:    JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const data = await res.json() as { token?: string }
  if (!data.token) throw new Error('Login failed during teardown')
  return data.token
}

async function deleteE2EEntities(token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant': TENANT }

  // ── Spaces (tables cascade via FK) ─────────────────────────────────────────
  const spacesRes = await fetch(`${API_URL}/spaces`, { headers })
  const spaces    = await spacesRes.json() as Array<{ id: string; name: string }>
  for (const s of spaces.filter(s => s.name.startsWith('E2E'))) {
    await fetch(`${API_URL}/spaces/${s.id}`, { method: 'DELETE', headers })
    console.log(`[teardown] Deleted space: ${s.name}`)
  }

  // ── Staff ──────────────────────────────────────────────────────────────────
  const staffRes = await fetch(`${API_URL}/staff`, { headers })
  const staff    = await staffRes.json() as Array<{ id: string; displayName: string }>
  for (const s of staff.filter(s => s.displayName.startsWith('E2E'))) {
    await fetch(`${API_URL}/staff/${s.id}`, { method: 'DELETE', headers })
    console.log(`[teardown] Deleted staff: ${s.displayName}`)
  }

  // ── Categories (menu items cascade via FK) ──────────────────────────────────
  const catsRes = await fetch(`${API_URL}/categories`, { headers })
  const cats    = await catsRes.json() as Array<{ id: string; name: string }>
  for (const c of cats.filter(c => c.name.startsWith('E2E'))) {
    await fetch(`${API_URL}/categories/${c.id}`, { method: 'DELETE', headers })
    console.log(`[teardown] Deleted category: ${c.name}`)
  }
}

export default async function globalTeardown(): Promise<void> {
  try {
    const token = await getToken()
    await deleteE2EEntities(token)
    console.log('[teardown] E2E data cleanup complete.')
  } catch (err) {
    // Non-fatal — test results already recorded
    console.warn('[teardown] Cleanup skipped (non-fatal):', (err as Error).message)
  }
}
