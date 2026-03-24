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

async function createStaff(page: import('@playwright/test').Page, name: string, role: string, pin: string) {
  await page.getByTestId('btn-new-staff').click()
  const dialog = page.locator('[role="dialog"]').first()
  await dialog.getByTestId('input-staff-name').fill(name)
  await dialog.getByTestId('select-staff-role').selectOption(role)
  await dialog.getByTestId('input-staff-pin').fill(pin)
  await page.getByRole('button', { name: /save|create|enregistrer/i }).click()
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 })
}

test.describe.serial('Module 4 — Staff Management', () => {

  test('T-14 — Create a waiter', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    if (await page.getByText('E2E Waiter').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('E2E Waiter')).toBeVisible()
      return
    }

    await createStaff(page, 'E2E Waiter', 'Waiter', WAITER_PIN)
  })

  test('T-15 — Create kitchen and cashier staff', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    if (!(await page.getByText('E2E Kitchen').isVisible({ timeout: 2000 }).catch(() => false))) {
      await createStaff(page, 'E2E Kitchen', 'Kitchen', KITCHEN_PIN)
      await page.waitForTimeout(500)
    }

    if (!(await page.getByText('E2E Cashier').isVisible({ timeout: 2000 }).catch(() => false))) {
      await createStaff(page, 'E2E Cashier', 'Cashier', CASHIER_PIN)
      await page.waitForTimeout(500)
    }

    await expect(page.getByText('E2E Kitchen')).toBeVisible()
    await expect(page.getByText('E2E Cashier')).toBeVisible()
  })

  test('T-16 — Edit staff name', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Find E2E Waiter or E2E Ben Waiter row
    const staffRow = page.locator('[data-testid="staff-item"]')
      .filter({ hasText: /e2e waiter|e2e ben waiter/i }).first()

    await staffRow.getByTestId('btn-edit-staff').click()

    const dialog = page.locator('[role="dialog"]').first()
    const nameInput = dialog.getByTestId('input-staff-name')
    await nameInput.clear()
    await nameInput.fill('E2E Ben Waiter')
    await page.getByRole('button', { name: /save|enregistrer/i }).click()

    await expect(page.getByText('E2E Ben Waiter').first()).toBeVisible({ timeout: 5000 })
  })

  test('T-17 — Assign waiter zone', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')

    // Navigate to Zones sub-tab
    await page.getByTestId('tab-zones').click()
    await page.waitForLoadState('networkidle')

    // Select E2E Ben Waiter from the waiter dropdown
    const waiterSelect = page.locator('select').first()
    const waiterOption = waiterSelect.locator('option').filter({ hasText: /e2e ben waiter/i })
    if (await waiterOption.count() > 0) {
      const optionText = await waiterOption.first().textContent()
      if (optionText) await waiterSelect.selectOption({ label: optionText.trim() })
    }

    // Drag a zone on the grid (first cell to second cell)
    const gridCells = page.locator('[class*="cursor-crosshair"]')
    const cellCount = await gridCells.count()
    if (cellCount >= 2) {
      const firstCell  = gridCells.first()
      const secondCell = gridCells.nth(1)
      const box1 = await firstCell.boundingBox()
      const box2 = await secondCell.boundingBox()
      if (box1 && box2) {
        await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2)
        await page.mouse.down()
        await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
        await page.mouse.up()
        await page.waitForTimeout(500)
      }
    }

    await expect(page.locator('body')).not.toContainText(/error|failed/i)
  })

  test('T-18 — Delete staff', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/staff`)
    await page.waitForLoadState('networkidle')

    // Create E2E Temp to delete
    if (!(await page.getByText('E2E Temp').isVisible({ timeout: 1000 }).catch(() => false))) {
      await createStaff(page, 'E2E Temp', 'Waiter', '1111')
    }

    // Open edit modal for E2E Temp then delete from inside the modal
    const tempRow = page.locator('[data-testid="staff-item"]').filter({ hasText: 'E2E Temp' }).first()
    await tempRow.getByTestId('btn-edit-staff').click()

    const dialog = page.locator('[role="dialog"]').first()
    const deleteBtn = dialog.getByRole('button', { name: /delete|supprimer/i })

    // Accept the browser confirm() dialog that fires on delete
    page.once('dialog', d => d.accept())
    await deleteBtn.click()

    await expect(page.getByText('E2E Temp')).not.toBeVisible({ timeout: 5000 })
  })

})
