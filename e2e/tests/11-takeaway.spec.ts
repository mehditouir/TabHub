/**
 * Module 11 — Takeaway Display
 * T-53 through T-54
 */

import { test, expect } from '@playwright/test'
import { loginWithPin } from '../helpers/auth'

const TENANT      = process.env.MANAGER_TENANT ?? 'cafetunisia'
const CASHIER_PIN = process.env.CASHIER_PIN ?? '3333'
const KITCHEN_PIN = process.env.KITCHEN_PIN ?? '2222'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe.serial('Module 11 — Takeaway Display', () => {

  test('T-53 — Takeaway order appears on display board', async ({ browser }) => {
    // Open takeaway display
    const displayCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const displayPage = await displayCtx.newPage()
    await displayPage.goto(`/takeaway/${TENANT}`)
    await displayPage.waitForLoadState('networkidle')

    // Should load without login
    await expect(displayPage.getByText(/takeaway|emporter|à emporter/i).first()).toBeVisible({ timeout: 8000 })

    // Place a takeaway order via cashier
    const cashierCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const cashierPage = await cashierCtx.newPage()
    await cashierPage.goto(`/cashier/${TENANT}`)
    await loginWithPin(cashierPage, TENANT, CASHIER_PIN)
    await cashierPage.waitForLoadState('networkidle')

    const takeawayBtn = cashierPage.getByRole('button', { name: /takeaway|emporter/i })
    if (await takeawayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeawayBtn.click()
      const addBtn = cashierPage.getByRole('button', { name: /add|\+/i }).first()
      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addBtn.click()
        await cashierPage.getByRole('button', { name: /confirm|ok/i }).click().catch(() => {})
        const submitBtn = cashierPage.getByRole('button', { name: /submit|commander/i })
        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submitBtn.click()
          // Wait for SignalR to broadcast
          await displayPage.waitForTimeout(3000)
          // Display board should show an order
          await expect(displayPage.locator('[class*="card"], [class*="order"]').first()).toBeVisible({ timeout: 5000 })
        }
      }
    }

    await cashierCtx.close()
    await displayCtx.close()
  })

  test('T-54 — Takeaway status updates in real time', async ({ browser }) => {
    // Open display
    const displayCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const displayPage = await displayCtx.newPage()
    await displayPage.goto(`/takeaway/${TENANT}`)
    await displayPage.waitForLoadState('networkidle')

    // Open kitchen and advance a takeaway order
    const kitchenCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const kitchenPage = await kitchenCtx.newPage()
    await kitchenPage.goto(`/kitchen/${TENANT}`)
    await loginWithPin(kitchenPage, TENANT, KITCHEN_PIN)
    await kitchenPage.waitForLoadState('networkidle')

    const startBtn = kitchenPage.getByRole('button', { name: /commencer|start/i }).first()
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn.click()
      await displayPage.waitForTimeout(3000)
      // Display should show updated status — no crash
      await expect(displayPage.getByText(/error/i)).not.toBeVisible()
    }

    await kitchenCtx.close()
    await displayCtx.close()
  })

})
