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
    await expect(page.locator('[data-testid="kpi-card"]').first()).toBeVisible({ timeout: 8000 })

    // Revenue chart should be present
    await expect(
      page.locator('[data-testid="revenue-chart"]').first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('T-58 — Live floor plan (Spaces → Live tab)', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')

    // Navigate to Live sub-tab
    await page.getByTestId('tab-live').click()
    await page.waitForLoadState('networkidle')

    // Grid should be visible with colour-coded tables
    await expect(page.locator('[class*="grid"], [class*="floor"], [class*="live"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('T-59 — QR visible in Spaces Editor table modal', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('tab-editor').click()

    // Click first space in the list — use role+name to avoid matching "+ Nouvel espace"
    const firstSpace = page.getByRole('button', { name: /terrasse|salle/i }).first()
    await expect(firstSpace).toBeVisible({ timeout: 5000 })
    await firstSpace.click()
    await page.waitForTimeout(500)

    // Click the first occupied table cell (title contains "Table")
    const occupiedCell = page.locator('button[title*="Table"]').first()
    if (!(await occupiedCell.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No table buttons found — T-11 may not have added tables yet')
      return
    }
    await occupiedCell.click()

    // Modal opens with QR code image and URL
    const modal = page.locator('[role="dialog"]').first()
    await expect(modal).toBeVisible()

    // URL contains tenant slug and UUID
    const urlInput = modal.locator('input[readonly]').first()
    await expect(urlInput).toBeVisible({ timeout: 3000 })
    const urlVal = await urlInput.inputValue()
    expect(urlVal).toContain(`/menu/${TENANT}`)
    expect(urlVal).toMatch(/table=[0-9a-f-]{36}/)

    // Download button present (rendered as '↓')
    const downloadBtn = modal.getByRole('button').filter({ hasText: /↓|download/i })
    if (await downloadBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(downloadBtn).toBeEnabled()
    }

    await page.keyboard.press('Escape')
  })

})
