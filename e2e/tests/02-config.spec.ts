/**
 * Module 2 — Restaurant Configuration
 * T-07 through T-09
 */

import { test, expect } from '@playwright/test'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 2 — Restaurant Configuration', () => {

  test('T-07 — Update restaurant name', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/config`)
    await page.waitForLoadState('networkidle')

    const nameInput = page.getByLabel(/restaurant name/i)
    await nameInput.fill('Café Tunisie Test')
    await page.getByRole('button', { name: /save/i }).first().click()

    await expect(page.getByText(/saved|success/i).first()).toBeVisible({ timeout: 5000 })

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(nameInput).toHaveValue('Café Tunisie Test')
  })

  test('T-08 — Update TVA rate', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/config`)
    await page.waitForLoadState('networkidle')

    const tvaInput = page.getByLabel(/tva|tax/i)
    await tvaInput.fill('19')
    await page.getByRole('button', { name: /save/i }).first().click()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(tvaInput).toHaveValue('19')
  })

  test('T-09 — Update opening hours', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/config`)
    await page.waitForLoadState('networkidle')

    // Find Monday opening time input (first time input in the page)
    const timeInputs = page.locator('input[type="time"]')
    if (await timeInputs.count() > 0) {
      await timeInputs.first().fill('08:00')
      await timeInputs.nth(1).fill('22:00')
      await page.getByRole('button', { name: /save/i }).last().click()
      await expect(page.getByText(/saved|success/i).first()).toBeVisible({ timeout: 5000 })
    } else {
      // Config page may use text inputs for times
      const textInputs = page.locator('input[placeholder*="08:00"], input[placeholder*="HH:mm"]')
      if (await textInputs.count() > 0) {
        await textInputs.first().fill('08:00')
      }
    }
  })

})
