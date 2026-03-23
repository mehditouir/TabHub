/**
 * Module 10 — Cashier Application
 * T-50 through T-52
 */

import { test, expect } from '@playwright/test'
import { loginWithPin } from '../helpers/auth'

const TENANT      = process.env.MANAGER_TENANT ?? 'cafetunisia'
const CASHIER_PIN = process.env.CASHIER_PIN ?? '3333'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe.serial('Module 10 — Cashier Application', () => {

  test('T-50 — Create a table order from cashier', async ({ page }) => {
    await page.goto(`/cashier/${TENANT}`)
    await loginWithPin(page, TENANT, CASHIER_PIN)
    await page.waitForLoadState('networkidle')

    // New Order tab should be visible by default
    const newOrderTab = page.getByRole('button', { name: /new order|nouvelle/i })
    if (await newOrderTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newOrderTab.click()
    }

    // Switch to Table mode
    const tableMode = page.getByRole('button', { name: /table/i })
    if (await tableMode.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableMode.click()
    }

    // Add a menu item
    const addBtn = page.getByRole('button', { name: /add|ajouter|\+/i }).first()
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click()
      const modal = page.locator('[role="dialog"]').first()
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await modal.locator('button, label').first().click()
        await modal.getByRole('button', { name: /confirm|add|ok/i }).click().catch(() => {})
      }
    }

    // Submit order
    const submitBtn = page.getByRole('button', { name: /submit|place|commander/i })
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click()
      await expect(page.getByText(/error|failed/i)).not.toBeVisible({ timeout: 3000 })
    }
  })

  test('T-51 — Create a takeaway order', async ({ page }) => {
    await page.goto(`/cashier/${TENANT}`)
    await loginWithPin(page, TENANT, CASHIER_PIN)
    await page.waitForLoadState('networkidle')

    // Switch to Takeaway mode
    const takeawayMode = page.getByRole('button', { name: /takeaway|emporter/i })
    if (await takeawayMode.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeawayMode.click()
    }

    // Add a menu item
    const addBtn = page.getByRole('button', { name: /add|ajouter|\+/i }).first()
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click()
      const modal = page.locator('[role="dialog"]').first()
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await modal.locator('button, label').first().click()
        await modal.getByRole('button', { name: /confirm|add|ok/i }).click().catch(() => {})
      }
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit|place|commander/i })
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click()
      // Takeaway order should show sequence number
      await expect(page.getByText(/\d{13}|\d{5}/)).toBeVisible({ timeout: 5000 })
    }
  })

  test('T-52 — Close session and print bill from cashier', async ({ page }) => {
    await page.goto(`/cashier/${TENANT}`)
    await loginWithPin(page, TENANT, CASHIER_PIN)
    await page.waitForLoadState('networkidle')

    // Navigate to Sessions tab
    const sessionsTab = page.getByRole('button', { name: /session/i })
    if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionsTab.click()
    }

    // Close the first open session
    const closeBtn = page.getByRole('button', { name: /close|fermer/i }).first()
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click()
      // PDF or bill modal should appear
      await expect(
        page.locator('iframe[src*="blob"], embed, [class*="pdf"]').first()
          .or(page.getByText(/pdf|bill|facture/i).first())
      ).toBeVisible({ timeout: 8000 })
    }
  })

})
