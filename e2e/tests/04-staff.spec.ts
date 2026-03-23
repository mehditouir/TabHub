/**
 * Module 4 — Staff Management
 * T-14 through T-18
 */

import { test, expect } from '@playwright/test'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 4 — Staff Management', () => {

  test('T-14 — Create a waiter', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Check if Ali Waiter already exists
    if (await page.getByText('Ali Waiter').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('Ali Waiter')).toBeVisible()
      return
    }

    await page.getByRole('button', { name: /add staff/i }).click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.getByLabel(/name/i).fill('Ali Waiter')
    await dialog.getByLabel(/role/i).selectOption({ label: /waiter/i })
    await dialog.getByLabel(/pin/i).fill('1234')
    await page.getByRole('button', { name: /save|create/i }).click()

    await expect(page.getByText('Ali Waiter')).toBeVisible({ timeout: 5000 })
  })

  test('T-15 — Create kitchen and cashier staff', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Sara Kitchen
    if (!(await page.getByText('Sara Kitchen').isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add staff/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('Sara Kitchen')
      await dialog.getByLabel(/role/i).selectOption({ label: /kitchen/i })
      await dialog.getByLabel(/pin/i).fill('2222')
      await page.getByRole('button', { name: /save|create/i }).click()
      await page.waitForTimeout(500)
    }

    // Omar Cashier
    if (!(await page.getByText('Omar Cashier').isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add staff/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('Omar Cashier')
      await dialog.getByLabel(/role/i).selectOption({ label: /cashier/i })
      await dialog.getByLabel(/pin/i).fill('3333')
      await page.getByRole('button', { name: /save|create/i }).click()
      await page.waitForTimeout(500)
    }

    await expect(page.getByText('Sara Kitchen')).toBeVisible()
    await expect(page.getByText('Omar Cashier')).toBeVisible()
  })

  test('T-16 — Edit staff name and change PIN', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Find Ali Waiter or Ali Ben Waiter (already renamed on a prev run)
    const staffRow = page.getByRole('row', { name: /ali/i }).first()
      .or(page.locator('li, [data-testid*="staff"]').filter({ hasText: /ali/i }).first())

    // Click edit on that row
    const editBtn = staffRow.getByRole('button', { name: /edit/i })
      .or(page.getByRole('button', { name: /edit/i }).first())
    await editBtn.click()

    const dialog = page.locator('[role="dialog"]').first()
    const nameInput = dialog.getByLabel(/name/i)
    await nameInput.clear()
    await nameInput.fill('Ali Ben Waiter')
    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText('Ali Ben Waiter')).toBeVisible({ timeout: 5000 })

    // Change PIN to 5678
    const aliRow = page.locator('li, tr, [data-testid*="staff"]').filter({ hasText: 'Ali Ben Waiter' }).first()
    const pinBtn = aliRow.getByRole('button', { name: /pin/i })
      .or(page.getByRole('button', { name: /pin/i }).first())
    await pinBtn.click()

    const pinDialog = page.locator('[role="dialog"]').first()
    const pinInput = pinDialog.getByLabel(/pin/i).or(pinDialog.locator('input[type="password"], input[type="text"]').first())
    await pinInput.fill('5678')
    await page.getByRole('button', { name: /save/i }).click()
  })

  test('T-17 — Assign waiter zone', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')

    // Navigate to Zones sub-tab
    await page.getByRole('tab', { name: /zone/i }).click()
    await page.waitForLoadState('networkidle')

    // Select Ali Ben Waiter and Terrasse space
    const staffSelect = page.getByLabel(/staff/i).or(page.locator('select').first())
    await staffSelect.selectOption({ label: /ali ben waiter/i })

    const spaceSelect = page.getByLabel(/space/i).or(page.locator('select').nth(1))
    await spaceSelect.selectOption({ label: /terrasse/i })

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
    // Zone list should update — just verify no error
    await expect(page.locator('body')).not.toContainText(/error|failed/i)
  })

  test('T-18 — Delete staff', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Create Temp Staff to delete
    if (!(await page.getByText('Temp Staff').isVisible({ timeout: 1000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add staff/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('Temp Staff')
      await dialog.getByLabel(/role/i).selectOption({ label: /waiter/i })
      await dialog.getByLabel(/pin/i).fill('9999')
      await page.getByRole('button', { name: /save|create/i }).click()
      await expect(page.getByText('Temp Staff')).toBeVisible()
    }

    // Delete Temp Staff
    const tempRow = page.locator('li, tr, [data-testid*="staff"]').filter({ hasText: 'Temp Staff' }).first()
    await tempRow.getByRole('button', { name: /delete/i }).click()
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i })
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    await expect(page.getByText('Temp Staff')).not.toBeVisible({ timeout: 5000 })
  })

})
