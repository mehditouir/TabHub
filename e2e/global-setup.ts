/**
 * global-setup.ts — runs once before all tests.
 *
 * Creates two saved storage states:
 *   manager-auth.json  — logged-in manager (cafetunisia)
 *   admin-auth.json    — logged-in super admin
 *
 * Tests that need manager auth use:
 *   test.use({ storageState: 'manager-auth.json' })
 *
 * Tests that need admin auth use:
 *   test.use({ storageState: 'admin-auth.json' })
 */

import { chromium, FullConfig } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path   from 'path'

dotenv.config({ path: path.join(__dirname, '.env') })

const BASE_URL = process.env.BASE_URL ?? 'https://ashy-grass-0c75bb903.6.azurestaticapps.net'
const TENANT   = process.env.MANAGER_TENANT   ?? 'cafetunisia'
const EMAIL    = process.env.MANAGER_EMAIL    ?? 'mehdi@cafetunisia.com'
const PASSWORD = process.env.MANAGER_PASSWORD ?? 'mehdi123'

export default async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch()

  // ── Manager auth ────────────────────────────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Tenant (slug)').fill(TENANT)
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`**/${TENANT}/dashboard`)
    await page.context().storageState({ path: path.join(__dirname, 'manager-auth.json') })
    await page.close()
    console.log('[global-setup] Manager auth saved.')
  }

  // ── Admin auth ───────────────────────────────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.goto(`${BASE_URL}/admin/login`)
    await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL    ?? 'mehdi@mehdi.com')
    await page.getByLabel('Password').fill(process.env.ADMIN_PASSWORD ?? 'mehdi123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/admin')
    await page.context().storageState({ path: path.join(__dirname, 'admin-auth.json') })
    await page.close()
    console.log('[global-setup] Admin auth saved.')
  }

  await browser.close()
}
