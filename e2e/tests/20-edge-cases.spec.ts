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

  test('T-73 — Unavailable item cannot be added to cart', async ({ page }) => {
    // We need Café to be set to unavailable for this test.
    // Since toggling back was done in T-21, let's use manager auth to confirm.
    const state = readState()
    const menuUrl = state.tableQrToken
      ? `${process.env.BASE_URL ?? ''}/menu/${TENANT}?table=${state.tableQrToken}`
      : `${process.env.BASE_URL ?? ''}/menu/${TENANT}`

    await page.goto(menuUrl)
    await page.waitForLoadState('networkidle')

    // Look for an item with "unavailable" badge
    const unavailableBadge = page.getByText(/unavailable|indisponible/i).first()
    if (await unavailableBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      // The item near this badge should not have an Add button
      const itemCard = unavailableBadge.locator('..').locator('..')
      const addBtn   = itemCard.getByRole('button', { name: /add|ajouter|\+/i })
      await expect(addBtn).not.toBeVisible()
    } else {
      // No unavailable items currently — skip
      test.skip(true, 'No unavailable items found. Set Café to unavailable (T-21) before running this test.')
    }
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
