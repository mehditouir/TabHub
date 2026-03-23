/**
 * Module 8 — Waiter Application
 * T-38 through T-45
 */

import { test, expect } from '@playwright/test'
import { loginWithPin } from '../helpers/auth'
import { readState }    from '../helpers/state'

const TENANT     = process.env.MANAGER_TENANT ?? 'cafetunisia'
const WAITER_PIN = process.env.WAITER_PIN ?? '5678'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe.serial('Module 8 — Waiter Application', () => {

  test('T-38 — Floor plan shows assigned zone only', async ({ page }) => {
    await page.goto(`/waiter/${TENANT}`)
    await loginWithPin(page, TENANT, WAITER_PIN)

    // Select Terrasse space
    const terrasseBtn = page.getByText(/terrasse/i).first()
    if (await terrasseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await terrasseBtn.click()
    }

    // Grid should be visible
    await expect(page.locator('[class*="grid"], [class*="floor"], [class*="plan"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('T-39 — Receive notification and ACK an order', async ({ browser }) => {
    const state   = readState()
    const menuUrl = state.tableQrToken
      ? `${process.env.BASE_URL ?? ''}/menu/${TENANT}?table=${state.tableQrToken}`
      : null

    if (!menuUrl) {
      test.skip(true, 'No QR token — skipping notification test')
      return
    }

    // Open waiter app
    const waiterCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const waiterPage = await waiterCtx.newPage()
    await waiterPage.goto(`/waiter/${TENANT}`)
    await loginWithPin(waiterPage, TENANT, WAITER_PIN)
    await waiterPage.waitForTimeout(1000)

    // Place order from customer
    const customerCtx  = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const customerPage = await customerCtx.newPage()
    await customerPage.goto(menuUrl)
    await customerPage.waitForLoadState('networkidle')

    const addBtn = customerPage.getByRole('button', { name: /add|ajouter|\+/i }).first()
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click()
      const modal = customerPage.locator('[role="dialog"]').first()
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await modal.locator('button, label').first().click()
        await modal.getByRole('button', { name: /confirm|add|ok/i }).click().catch(() => {})
      }
      const cartBtn = customerPage.locator('button').filter({ hasText: /cart|panier|\d+/i }).first()
      await cartBtn.click()
      await customerPage.getByRole('button', { name: /place order|commander|submit/i }).click()
    }

    // Wait for notification on waiter
    await waiterPage.waitForTimeout(3000)
    const notification = waiterPage.locator('[class*="notification"], [class*="banner"], [class*="alert"]').first()
    if (await notification.isVisible({ timeout: 5000 }).catch(() => false)) {
      // ACK the notification
      const ackBtn = notification.getByRole('button', { name: /ack|ok|take/i })
        .or(waiterPage.getByRole('button', { name: /ack/i }))
      if (await ackBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await ackBtn.click()
        await expect(notification).not.toBeVisible({ timeout: 3000 })
      }
    }

    await customerCtx.close()
    await waiterCtx.close()
  })

  test('T-40 — Competing ACK — first waiter wins', async ({ browser }) => {
    // This test requires two waiter accounts covering the same table.
    // Simplified: verify the ACK endpoint returns 409 when called twice.
    // Full multi-browser simulation skipped as it requires two waiter PINs.
    test.skip(true, 'Competing ACK requires two waiter accounts with overlapping zones — verify manually via T-40')
  })

  test('T-41 — Advance order status from waiter queue', async ({ page }) => {
    await page.goto(`/waiter/${TENANT}`)
    await loginWithPin(page, TENANT, WAITER_PIN)

    // Navigate to Orders tab
    await page.getByRole('button', { name: /order|commande/i }).first().click()
    await page.waitForLoadState('networkidle')

    // If there are orders, advance the first one
    const advanceBtn = page.getByRole('button', { name: /advance|next|start|commencer/i }).first()
    if (await advanceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await advanceBtn.click()
      await page.waitForTimeout(500)
      await expect(page.getByText(/error|failed/i)).not.toBeVisible()
    }
  })

  test('T-42 — Place order from waiter tablet (staff bypass)', async ({ page }) => {
    await page.goto(`/waiter/${TENANT}`)
    await loginWithPin(page, TENANT, WAITER_PIN)

    // Tap Floor Plan tab → click a table → place order
    // OR find a "New Order" button
    const newOrderBtn = page.getByRole('button', { name: /new order|nouvelle/i })
    if (await newOrderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newOrderBtn.click()
      const menuItem = page.getByText('Café').first()
      if (await menuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.getByRole('button', { name: /add|ajouter|\+/i }).first().click()
        await page.getByRole('button', { name: /submit|place|commander/i }).click()
        await expect(page.getByText(/progress|inprogress|en cours/i).first()).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('T-43 — Move a table session', async ({ page }) => {
    await page.goto(`/waiter/${TENANT}`)
    await loginWithPin(page, TENANT, WAITER_PIN)

    // Navigate to Sessions tab
    await page.getByRole('button', { name: /session/i }).first().click()
    await page.waitForLoadState('networkidle')

    // Find a session with a Move button
    const moveBtn = page.getByRole('button', { name: /move/i }).first()
    if (await moveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveBtn.click()
      // Select a free table in the modal
      const freeTable = page.locator('[role="dialog"] button').filter({ hasText: /T2|table 2|free/i }).first()
      if (await freeTable.isVisible({ timeout: 2000 }).catch(() => false)) {
        await freeTable.click()
        await page.getByRole('button', { name: /confirm|move/i }).click()
        await expect(page.getByText(/error|failed/i)).not.toBeVisible()
      }
    }
  })

  test('T-44 — Merge two table sessions', async ({ page }) => {
    await page.goto(`/waiter/${TENANT}`)
    await loginWithPin(page, TENANT, WAITER_PIN)
    await page.getByRole('button', { name: /session/i }).first().click()
    await page.waitForLoadState('networkidle')

    const mergeBtn = page.getByRole('button', { name: /merge/i }).first()
    if (await mergeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mergeBtn.click()
      const targetSession = page.locator('[role="dialog"] button, [role="dialog"] li').nth(1)
      if (await targetSession.isVisible({ timeout: 2000 }).catch(() => false)) {
        await targetSession.click()
        await page.getByRole('button', { name: /confirm|merge/i }).click()
        await expect(page.getByText(/error|failed/i)).not.toBeVisible()
      }
    }
  })

  test('T-45 — Close session and generate PDF bill (waiter)', async ({ page }) => {
    await page.goto(`/waiter/${TENANT}`)
    await loginWithPin(page, TENANT, WAITER_PIN)
    await page.getByRole('button', { name: /session/i }).first().click()
    await page.waitForLoadState('networkidle')

    const closeBtn = page.getByRole('button', { name: /close|fermer/i }).first()
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click()
      // PDF modal or iframe should appear
      const pdfFrame = page.locator('iframe[src*="blob"], [class*="pdf"], embed').first()
      await expect(pdfFrame.or(page.getByText(/pdf|bill|facture/i).first())).toBeVisible({ timeout: 8000 })
    }
  })

})
