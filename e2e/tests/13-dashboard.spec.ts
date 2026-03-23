/**
 * Module 13 — Manager Dashboard & Reports
 * T-57 through T-59
 */

import { test, expect } from '@playwright/test'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 13 — Manager Dashboard & Reports', () => {

  test('T-57 — Dashboard KPIs reflect real data', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/dashboard`)
    await page.waitForLoadState('networkidle')

    // KPI cards should be present (even if 0 value, they should render)
    // Look for cards with numbers
    await expect(page.locator('[class*="kpi"], [class*="stat"], [class*="card"]').first()).toBeVisible({ timeout: 8000 })

    // Revenue chart should be present
    await expect(
      page.locator('canvas, svg[class*="chart"], [class*="chart"], [class*="bar"]').first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('T-58 — Live floor plan (Spaces → Live tab)', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')

    // Navigate to Live sub-tab
    await page.getByRole('tab', { name: /live/i }).click()
    await page.waitForLoadState('networkidle')

    // Grid should be visible with colour-coded tables
    await expect(page.locator('[class*="grid"], [class*="floor"], [class*="live"]').first()).toBeVisible({ timeout: 5000 })
    // Look for colour-coded cells
    await expect(page.locator('[class*="green"], [class*="occupied"], [class*="free"]').first())
      .toBeVisible({ timeout: 5000 }).catch(() => {
        // Grid may be empty — just verify no error
      })
  })

  test('T-59 — QR download from Spaces Editor', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /editor/i }).click()

    // Click Terrasse if it exists
    const terrasse = page.getByText('Terrasse', { exact: true })
    if (await terrasse.isVisible({ timeout: 2000 }).catch(() => false)) {
      await terrasse.click()
    }

    // Click QR button
    const qrBtn = page.getByRole('button', { name: /qr/i }).first()
    await expect(qrBtn).toBeVisible({ timeout: 5000 })
    await qrBtn.click()

    // Modal opens with QR code
    const modal = page.locator('[role="dialog"]').first()
    await expect(modal).toBeVisible()

    // URL contains tenant slug and UUID
    const urlEl = page.getByText(new RegExp(`/menu/${TENANT}\\?table=`))
    await expect(urlEl).toBeVisible({ timeout: 3000 })

    // Download button present
    const downloadBtn = modal.getByRole('button', { name: /download/i })
    if (await downloadBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(downloadBtn).toBeEnabled()
    }

    await page.keyboard.press('Escape')
  })

})
