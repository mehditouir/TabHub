/**
 * Module 1 — Manager Authentication
 * T-01 through T-06
 */

import { test, expect } from '@playwright/test'

const TENANT   = process.env.MANAGER_TENANT   ?? 'cafetunisia'
const EMAIL    = process.env.MANAGER_EMAIL    ?? 'mehdi@cafetunisia.com'
const PASSWORD = process.env.MANAGER_PASSWORD ?? 'mehdi123'

test.describe.serial('Module 1 — Manager Authentication', () => {

  test('T-01 — Successful manager login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Tenant (slug)').fill(TENANT)
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL(`**/manager/${TENANT}/dashboard`)
    await expect(page.locator(`a[href*="/dashboard"]`)).toBeVisible()
    await expect(page.locator(`a[href*="/menu"]`)).toBeVisible()
    await expect(page.getByText(EMAIL)).toBeVisible()
  })

  test('T-02 — Wrong password rejected', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Tenant (slug)').fill(TENANT)
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid credentials/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('T-03 — Unknown tenant rejected', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Tenant (slug)').fill('doesnotexist')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.locator('p.text-red-600, [class*="text-red"]').first()).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('T-04 — Auth guard blocks unauthenticated access', async ({ browser }) => {
    const ctx  = await browser.newContext()  // clean context — no stored auth
    const page = await ctx.newPage()
    await page.goto(`/manager/${TENANT}/dashboard`)
    await expect(page).toHaveURL(/\/login/)
    await ctx.close()
  })

  test('T-05 — Logout', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.getByLabel('Tenant (slug)').fill(TENANT)
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`**/manager/${TENANT}/dashboard`)

    // Sign out
    await page.getByTestId('logout-btn').click()
    await expect(page).toHaveURL(/\/login/)

    // Navigate back — should redirect again
    await page.goto(`/manager/${TENANT}/dashboard`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('T-06 — Language switcher persists across reload', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Tenant (slug)').fill(TENANT)
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`**/manager/${TENANT}/dashboard`)

    // Switch to Arabic
    await page.getByRole('button', { name: 'AR' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    // Reload
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    // Restore French for subsequent tests
    await page.getByRole('button', { name: 'FR' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

})
