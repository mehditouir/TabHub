/**
 * Module 4 — Staff Management
 * T-14 through T-18
 *
 * E2E creates its own staff with "E2E" prefix — never relies on seed data.
 * Staff PINs come from env vars (WAITER_PIN, KITCHEN_PIN, CASHIER_PIN).
 * All tests are idempotent: find-or-create pattern throughout.
 */

import { test, expect } from '@playwright/test'

const TENANT      = process.env.MANAGER_TENANT ?? 'cafetunisia'
const WAITER_PIN  = process.env.WAITER_PIN  ?? '7777'
const KITCHEN_PIN = process.env.KITCHEN_PIN ?? '8888'
const CASHIER_PIN = process.env.CASHIER_PIN ?? '9999'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 4 — Staff Management', () => {

  test('T-14 — Create a waiter', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    if (await page.getByText('E2E Waiter').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('E2E Waiter')).toBeVisible()
      return
    }

    await page.getByRole('button', { name: /add staff/i }).click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.getByLabel(/name/i).fill('E2E Waiter')
    await dialog.getByLabel(/role/i).selectOption({ label: /waiter/i })
    await dialog.getByLabel(/pin/i).fill(WAITER_PIN)
    await page.getByRole('button', { name: /save|create/i }).click()

    await expect(page.getByText('E2E Waiter')).toBeVisible({ timeout: 5000 })
  })

  test('T-15 — Create kitchen and cashier staff', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // E2E Kitchen
    if (!(await page.getByText('E2E Kitchen').isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add staff/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('E2E Kitchen')
      await dialog.getByLabel(/role/i).selectOption({ label: /kitchen/i })
      await dialog.getByLabel(/pin/i).fill(KITCHEN_PIN)
      await page.getByRole('button', { name: /save|create/i }).click()
      await page.waitForTimeout(500)
    }

    // E2E Cashier
    if (!(await page.getByText('E2E Cashier').isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add staff/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('E2E Cashier')
      await dialog.getByLabel(/role/i).selectOption({ label: /cashier/i })
      await dialog.getByLabel(/pin/i).fill(CASHIER_PIN)
      await page.getByRole('button', { name: /save|create/i }).click()
      await page.waitForTimeout(500)
    }

    await expect(page.getByText('E2E Kitchen')).toBeVisible()
    await expect(page.getByText('E2E Cashier')).toBeVisible()
  })

  test('T-16 — Edit staff name', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Find E2E Waiter or E2E Ben Waiter (already renamed on a prev run)
    const staffRow = page.getByRole('row', { name: /e2e waiter|e2e ben waiter/i }).first()
      .or(page.locator('li, [data-testid*="staff"]').filter({ hasText: /e2e waiter|e2e ben waiter/i }).first())

    const editBtn = staffRow.getByRole('button', { name: /edit/i })
      .or(page.getByRole('button', { name: /edit/i }).first())
    await editBtn.click()

    const dialog = page.locator('[role="dialog"]').first()
    const nameInput = dialog.getByLabel(/name/i)
    await nameInput.clear()
    await nameInput.fill('E2E Ben Waiter')
    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText('E2E Ben Waiter')).toBeVisible({ timeout: 5000 })
  })

  test('T-17 — Assign waiter zone', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')

    // Navigate to Zones sub-tab
    await page.getByRole('tab', { name: /zone/i }).click()
    await page.waitForLoadState('networkidle')

    // Select E2E Ben Waiter and E2E Terrasse space
    const staffSelect = page.getByLabel(/staff/i).or(page.locator('select').first())
    await staffSelect.selectOption({ label: /e2e ben waiter/i })

    const spaceSelect = page.getByLabel(/space/i).or(page.locator('select').nth(1))
    await spaceSelect.selectOption({ label: /e2e terrasse/i })

    // Fill in zone bounds
    const colStartInput = page.getByLabel(/col.*start|start.*col/i).or(page.locator('input[placeholder*="col"]').first())
    const colEndInput   = page.getByLabel(/col.*end|end.*col/i).or(page.locator('input[placeholder*="col"]').nth(1))
    const rowStartInput = page.getByLabel(/row.*start|start.*row/i).or(page.locator('input[placeholder*="row"]').first())
    const rowEndInput   = page.getByLabel(/row.*end|end.*row/i).or(page.locator('input[placeholder*="row"]').nth(1))

    if (await colStartInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await colStartInput.fill('1')
      await colEndInput.fill('2')
      await rowStartInput.fill('1')
      await rowEndInput.fill('2')
    }

    await page.getByRole('button', { name: /save|add zone|assign/i }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('body')).not.toContainText(/error|failed/i)
  })

  test('T-18 — Delete staff', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Create E2E Temp to delete
    if (!(await page.getByText('E2E Temp').isVisible({ timeout: 1000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add staff/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('E2E Temp')
      await dialog.getByLabel(/role/i).selectOption({ label: /waiter/i })
      await dialog.getByLabel(/pin/i).fill('1111')
      await page.getByRole('button', { name: /save|create/i }).click()
      await expect(page.getByText('E2E Temp')).toBeVisible()
    }

    // Delete E2E Temp
    const tempRow = page.locator('li, tr, [data-testid*="staff"]').filter({ hasText: 'E2E Temp' }).first()
    await tempRow.getByRole('button', { name: /delete/i }).click()
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i })
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    await expect(page.getByText('E2E Temp')).not.toBeVisible({ timeout: 5000 })
  })

})
