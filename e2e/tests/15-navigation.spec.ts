/**
 * Module 15 — Navigation & URL Structure
 * T-62 through T-64
 */

import { test, expect } from '@playwright/test'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 15 — Navigation & URL Structure', () => {

  test('T-62 — All manager routes are path-based', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/dashboard`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(new RegExp(`/manager/${TENANT}/dashboard`))

    // Menu
    await page.getByRole('link', { name: /menu/i }).click()
    await expect(page).toHaveURL(new RegExp(`/manager/${TENANT}/menu`))
    await expect(page.getByRole('link', { name: /menu/i })).toHaveClass(/bg-brand|active/)

    // Spaces
    await page.getByRole('link', { name: /space/i }).click()
    await expect(page).toHaveURL(new RegExp(`/manager/${TENANT}/spaces`))

    // Staff
    await page.getByRole('link', { name: /staff/i }).click()
    await expect(page).toHaveURL(new RegExp(`/manager/${TENANT}/staff`))

    // Config
    await page.getByRole('link', { name: /config|settings/i }).click()
    await expect(page).toHaveURL(new RegExp(`/manager/${TENANT}/config`))

    // Each URL has the tenant slug
    await expect(page).toHaveURL(new RegExp(TENANT))
  })

  test('T-63 — Direct URL navigation works after login', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Should load staff page directly — no redirect to dashboard
    await expect(page).toHaveURL(new RegExp(`/manager/${TENANT}/staff`))
    await expect(page.getByRole('button', { name: /add staff/i })).toBeVisible({ timeout: 5000 })
  })

  test('T-64 — All staff and public app URLs load correctly', async ({ page }) => {
    const BASE = process.env.BASE_URL ?? 'https://ashy-grass-0c75bb903.6.azurestaticapps.net'

    const routes = [
      { url: `/waiter/${TENANT}`,   expect: /pin|sign in|serveur/i },
      { url: `/kitchen/${TENANT}`,  expect: /pin|sign in|cuisine/i },
      { url: `/cashier/${TENANT}`,  expect: /pin|sign in|caisse/i },
      { url: `/takeaway/${TENANT}`, expect: /takeaway|emporter|board/i },
      { url: `/admin/login`,        expect: /admin|super|email/i },
    ]

    for (const route of routes) {
      await page.goto(route.url)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(route.expect).first()).toBeVisible({ timeout: 8000 })
      // No 404 or blank page
      await expect(page.getByText(/404|page not found/i)).not.toBeVisible()
    }

    // Customer menu — may show error without valid table param, but must load
    await page.goto(`/menu/${TENANT}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/404|page not found/i)).not.toBeVisible()
  })

})
