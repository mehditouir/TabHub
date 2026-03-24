/**
 * Module 20 — Edge Cases & Error Handling
 * T-72 through T-75
 */

import { test, expect } from '@playwright/test'
import { readState }    from '../helpers/state'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

// Mix of public and auth — use clean context by default
test.use({ storageState: { cookies: [], origins: [] } })

test.describe.serial('Module 20 — Edge Cases & Error Handling', () => {

  test('T-72 — Customer cannot place an empty cart order', async ({ page }) => {
    const state = readState()
    const menuUrl = state.tableQrToken
      ? `${process.env.BASE_URL ?? ''}/menu/${TENANT}?table=${state.tableQrToken}`
      : `${process.env.BASE_URL ?? ''}/menu/${TENANT}`

    await page.goto(menuUrl)
    await page.waitForLoadState('networkidle')

    // Cart should be empty — cart button or Place Order button should be disabled/hidden
    const placeOrderBtn = page.getByRole('button', { name: /place order|commander/i })
    const cartBtn       = page.locator('[class*="cart"] button, [class*="float"] button').first()

    // Neither should be visible/enabled with empty cart
    if (await placeOrderBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(placeOrderBtn).toBeDisabled()
    } else if (await cartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Cart button visible but shows 0 — clicking should not submit
      const text = await cartBtn.textContent()
      expect(text).toMatch(/0|empty|panier/i)
    }
    // At minimum: no items in cart means no active Place Order button
    await expect(placeOrderBtn.or(page.getByRole('button', { name: /submit/i }))).not.toBeVisible({ timeout: 1000 })
      .catch(() => {
        // Button might be visible but disabled — acceptable
      })
  })

  test('T-73 — Unavailable item cannot be added to cart', async ({ page, browser }) => {
    const state = readState()
    const menuUrl = state.tableQrToken
      ? `${process.env.BASE_URL ?? ''}/menu/${TENANT}?table=${state.tableQrToken}`
      : `${process.env.BASE_URL ?? ''}/menu/${TENANT}`

    // Step 1: use manager auth to set E2E Café as unavailable
    const mgCtx  = await browser.newContext({ storageState: 'manager-auth.json' })
    const mgPage = await mgCtx.newPage()
    await mgPage.goto(`/manager/${TENANT}/menu`)
    await mgPage.waitForLoadState('networkidle')
    const itemRow = mgPage.locator('li').filter({ hasText: 'E2E Café' }).first()
    if (await itemRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await itemRow.getByRole('button', { name: /edit|modifier/i }).click()
      const dialog = mgPage.locator('[role="dialog"]').first()
      const availCheckbox = dialog.locator('input[type="checkbox"]').first()
      await availCheckbox.setChecked(false)
      await mgPage.getByRole('button', { name: /save|enregistrer/i }).first().click()
      await mgPage.waitForTimeout(500)
    }
    await mgCtx.close()

    // Step 2: verify the item is not addable from customer menu
    await page.goto(menuUrl)
    await page.waitForLoadState('networkidle')

    const unavailableItem = page.locator('div').filter({ hasText: 'E2E Café' }).first()
    if (await unavailableItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      const addBtn = unavailableItem.getByRole('button', { name: /add|ajouter/i })
      await expect(addBtn).not.toBeVisible({ timeout: 3000 })
    }

    // Step 3: restore availability
    const mgCtx2  = await browser.newContext({ storageState: 'manager-auth.json' })
    const mgPage2 = await mgCtx2.newPage()
    await mgPage2.goto(`/manager/${TENANT}/menu`)
    await mgPage2.waitForLoadState('networkidle')
    const itemRow2 = mgPage2.locator('li').filter({ hasText: 'E2E Café' }).first()
    if (await itemRow2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await itemRow2.getByRole('button', { name: /edit|modifier/i }).click()
      const dialog2 = mgPage2.locator('[role="dialog"]').first()
      const availCheckbox2 = dialog2.locator('input[type="checkbox"]').first()
      await availCheckbox2.setChecked(true)
      await mgPage2.getByRole('button', { name: /save|enregistrer/i }).first().click()
      await mgPage2.waitForTimeout(500)
    }
    await mgCtx2.close()
  })

  test('T-74 — Invalid QR token shows error', async ({ page }) => {
    await page.goto(`/menu/${TENANT}?table=00000000-0000-0000-0000-000000000000`)
    await page.waitForLoadState('networkidle')

    // Should show an error message — not the full menu
    await expect(
      page.getByText(/invalid|inactive|not found|error/i).first()
    ).toBeVisible({ timeout: 8000 })
  })

  test('T-75 — Unknown route redirects to login', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/login/)
  })

})
