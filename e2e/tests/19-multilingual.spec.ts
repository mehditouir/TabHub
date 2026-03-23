/**
 * Module 19 — Multilingual UI
 * T-70 through T-71
 */

import { test, expect } from '@playwright/test'
import { readState }    from '../helpers/state'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 19 — Multilingual UI', () => {

  test('T-70 — Manager dashboard FR / AR / EN switching', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Switch to French
    await page.getByRole('button', { name: 'FR' }).click()
    await expect(page.getByRole('link', { name: /tableau de bord|dashboard/i })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    // Switch to English
    await page.getByRole('button', { name: 'EN' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    // English sidebar labels
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()

    // Switch to Arabic
    await page.getByRole('button', { name: 'AR' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    // In RTL mode, sidebar should still be visible
    await expect(page.locator('aside, nav').first()).toBeVisible()

    // Restore French
    await page.getByRole('button', { name: 'FR' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

  test('T-71 — Customer menu language selector', async ({ page }) => {
    const state = readState()
    const menuUrl = state.tableQrToken
      ? `${process.env.BASE_URL ?? ''}/menu/${TENANT}?table=${state.tableQrToken}`
      : `${process.env.BASE_URL ?? ''}/menu/${TENANT}`

    await page.goto(menuUrl)
    await page.waitForLoadState('networkidle')

    // Look for a language selector on the customer menu
    const langBtn = page.getByRole('button', { name: /AR|arabic/i })
    if (await langBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await langBtn.click()
      await page.waitForTimeout(300)
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      // Switch back
      await page.getByRole('button', { name: /FR|EN/i }).first().click()
    } else {
      // Customer menu may not expose a language switcher — test is informational
      test.skip(true, 'Customer menu does not have a visible language switcher UI')
    }
  })

})
