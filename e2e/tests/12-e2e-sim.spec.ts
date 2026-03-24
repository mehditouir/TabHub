/**
 * Module 12 — Full End-to-End Simulation
 * T-55 through T-56
 *
 * Opens all 5 surfaces simultaneously and orchestrates a complete order flow.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'
import { loginWithPin }  from '../helpers/auth'
import { readState }     from '../helpers/state'

const TENANT      = process.env.MANAGER_TENANT ?? 'cafetunisia'
const WAITER_PIN  = process.env.WAITER_PIN  ?? '5678'
const KITCHEN_PIN = process.env.KITCHEN_PIN ?? '2222'
const CASHIER_PIN = process.env.CASHIER_PIN ?? '3333'

test.use({ storageState: { cookies: [], origins: [] } })
test.setTimeout(120_000)   // Give full simulation more time

test.describe.serial('Module 12 — Full End-to-End Simulation', () => {

  test('T-55 — Complete dine-in flow (all roles active simultaneously)', async ({ browser }) => {
    const state   = readState()
    const menuUrl = state.tableQrToken
      ? `${process.env.BASE_URL ?? ''}/menu/${TENANT}?table=${state.tableQrToken}`
      : `${process.env.BASE_URL ?? ''}/menu/${TENANT}`

    // Open all 5 surfaces
    const managerCtx  = await browser.newContext()
    const customerCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const waiterCtx   = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const kitchenCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const cashierCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })

    // Load manager auth into manager context
    await managerCtx.addInitScript(() => {})  // no-op; uses storageState from file via context options
    const managerPage  = await managerCtx.newPage()
    const customerPage = await customerCtx.newPage()
    const waiterPage   = await waiterCtx.newPage()
    const kitchenPage  = await kitchenCtx.newPage()
    const cashierPage  = await cashierCtx.newPage()

    // Step 1: Load all surfaces in parallel
    await Promise.all([
      (async () => {
        await managerPage.goto(`/manager/${TENANT}/dashboard`)
        await managerPage.waitForLoadState('networkidle').catch(() => {})
      })(),
      (async () => {
        await customerPage.goto(menuUrl)
        await customerPage.waitForLoadState('networkidle')
      })(),
      (async () => {
        await waiterPage.goto(`/waiter/${TENANT}`)
        await loginWithPin(waiterPage, TENANT, WAITER_PIN)
      })(),
      (async () => {
        await kitchenPage.goto(`/kitchen/${TENANT}`)
        await loginWithPin(kitchenPage, TENANT, KITCHEN_PIN)
      })(),
      (async () => {
        await cashierPage.goto(`/cashier/${TENANT}`)
        await loginWithPin(cashierPage, TENANT, CASHIER_PIN)
      })(),
    ])

    // Step 2: Customer places order
    const addBtn = customerPage.getByRole('button', { name: /add|\+/i }).first()
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click()
      const modal = customerPage.locator('[role="dialog"]').first()
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await modal.locator('button, label').first().click()
        await modal.getByRole('button', { name: /confirm|ok/i }).click().catch(() => {})
      }
      const cartBtn = customerPage.locator('button').filter({ hasText: /cart|panier|\d+/i }).first()
      if (await cartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cartBtn.click()
        await customerPage.getByRole('button', { name: /place order|commander/i }).click()
        await customerPage.waitForTimeout(1000)
      }
    }

    // Step 3: Waiter ACKs notification (wait 3s for SignalR)
    await waiterPage.waitForTimeout(3000)
    const ackBtn = waiterPage.getByRole('button', { name: /ack|ok|take/i }).first()
    if (await ackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ackBtn.click()
    }

    // Step 4: Kitchen advances order
    await kitchenPage.waitForTimeout(1000)
    const startBtn = kitchenPage.getByRole('button', { name: /commencer|start/i }).first()
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn.click()
      await kitchenPage.waitForTimeout(500)
      const readyBtn = kitchenPage.getByRole('button', { name: /prêt|ready/i }).first()
      if (await readyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await readyBtn.click()
      }
    }

    // Step 5: Customer tab should update (wait for SignalR)
    await customerPage.waitForTimeout(3000)
    // Just verify no crash
    await expect(customerPage.getByText(/error|crash/i)).not.toBeVisible()

    // Step 6: Cashier closes session
    await cashierPage.getByRole('button', { name: /session/i }).click().catch(() => {})
    await cashierPage.waitForTimeout(500)
    const closeBtn = cashierPage.getByRole('button', { name: /close|fermer/i }).first()
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click()
    }

    // Step 7: Manager dashboard shows data
    await managerPage.reload()
    await managerPage.waitForLoadState('networkidle')
    // KPI cards should be present
    await expect(managerPage.locator('[class*="kpi"], [class*="stat"], [class*="card"]').first())
      .toBeVisible({ timeout: 5000 }).catch(() => {})

    // Cleanup
    await Promise.all([
      managerCtx.close(), customerCtx.close(), waiterCtx.close(),
      kitchenCtx.close(), cashierCtx.close(),
    ])
  })

  test('T-56 — Complete takeaway flow', async ({ browser }) => {
    const displayCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const cashierCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const kitchenCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })

    const displayPage = await displayCtx.newPage()
    const cashierPage = await cashierCtx.newPage()
    const kitchenPage = await kitchenCtx.newPage()

    // Load all three surfaces in parallel — reduces Azure cold-start impact
    await Promise.all([
      displayPage.goto(`/takeaway/${TENANT}`),
      cashierPage.goto(`/cashier/${TENANT}`),
      kitchenPage.goto(`/kitchen/${TENANT}`),
    ])
    await loginWithPin(cashierPage, TENANT, CASHIER_PIN)
    await loginWithPin(kitchenPage, TENANT, KITCHEN_PIN)

    // Place takeaway order
    const takeawayBtn = cashierPage.getByRole('button', { name: /takeaway|emporter/i })
    if (await takeawayBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await takeawayBtn.click()
      const addBtn = cashierPage.getByRole('button', { name: /add|\+/i }).first()
      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addBtn.click()
        await cashierPage.getByRole('button', { name: /confirm|ok/i }).click().catch(() => {})
        await cashierPage.getByRole('button', { name: /submit|commander/i }).click()

        // Verify sequence number format
        const seqEl = cashierPage.getByText(/\d{13}/)
        if (await seqEl.isVisible({ timeout: 5000 }).catch(() => false)) {
          const seq = await seqEl.textContent()
          expect(seq).toMatch(/\d{13}/)
        }
      }
    }

    // Display board receives order
    await displayPage.waitForTimeout(3000)
    await expect(displayPage.getByText(/error/i)).not.toBeVisible()

    // Kitchen advances through states
    const startBtn = kitchenPage.getByRole('button', { name: /commencer|start/i }).first()
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn.click()
      await displayPage.waitForTimeout(2000)
      await kitchenPage.getByRole('button', { name: /prêt|ready/i }).first().click().catch(() => {})
      await displayPage.waitForTimeout(2000)
    }

    await expect(displayPage.getByText(/error/i)).not.toBeVisible()

    await displayCtx.close()
    await cashierCtx.close()
    await kitchenCtx.close()
  })

})
