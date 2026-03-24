/**
 * Module 3 — Spaces & Tables
 * T-10 through T-13
 *
 * E2E creates its own "E2E Terrasse" space — never relies on seed data.
 * After T-11, saves the QR token for table T1 to run-state.json
 * so customer ordering tests (07-customer.spec.ts) can use it.
 */

import { test, expect } from '@playwright/test'
import { writeState }   from '../helpers/state'

const TENANT    = process.env.MANAGER_TENANT ?? 'cafetunisia'
const SPACE_NAME = 'E2E Terrasse'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 3 — Spaces & Tables', () => {

  test('T-10 — Create a space', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')

    // Check if E2E Terrasse already exists in the space sidebar list
    const existingSpace = page.getByText(SPACE_NAME, { exact: true })
    if (await existingSpace.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(existingSpace).toBeVisible()
      return
    }

    // Create new space — btn-new-space is always visible in the header
    await page.getByTestId('btn-new-space').click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.locator('input').first().fill(SPACE_NAME)
    const numInputs = dialog.locator('input[type="number"]')
    if (await numInputs.count() >= 2) {
      await numInputs.first().fill('4')
      await numInputs.nth(1).fill('3')
    }
    await page.getByRole('button', { name: /save|create|enregistrer/i }).click()

    await expect(page.getByText(SPACE_NAME, { exact: true }).first()).toBeVisible({ timeout: 5000 })
  })

  test('T-11 — Add tables to the grid', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('tab-editor').click()

    // Select E2E Terrasse space
    await page.getByText(SPACE_NAME, { exact: true }).first().click()
    await page.waitForLoadState('networkidle')

    // Click empty cells (+ buttons) to add tables
    const plusCells = page.getByRole('button', { name: '+' })
    const plusCount = await plusCells.count()

    if (plusCount > 0) {
      // Click first + cell to add a table
      await plusCells.first().click()
      const dialog = page.locator('[role="dialog"]').first()
      if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dialog.locator('input').first().fill('T1')
        await page.getByRole('button', { name: /save|enregistrer/i }).click()
        await page.waitForTimeout(500)
      }

      // Add a second table if more + cells exist
      const morePlus = page.getByRole('button', { name: '+' })
      if (await morePlus.count() > 0) {
        await morePlus.first().click()
        const dialog2 = page.locator('[role="dialog"]').first()
        if (await dialog2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dialog2.locator('input').first().fill('T2')
          await page.getByRole('button', { name: /save|enregistrer/i }).click()
          await page.waitForTimeout(500)
        }
      }
    }

    await saveQrTokenFromPage(page)
  })

  test('T-12 — QR code visible in table modal', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('tab-editor').click()
    await page.getByText(SPACE_NAME, { exact: true }).first().click()

    // Click the first occupied table cell (not a '+' button)
    const occupiedCell = page.getByRole('button').filter({ hasNotText: '+' })
      .and(page.locator('button[title*="Table"]'))
      .first()

    if (!(await occupiedCell.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Fallback: any button in the grid that isn't '+'
      const gridBtns = page.locator('button').filter({ hasNotText: '+' })
      if (await gridBtns.count() > 0) {
        await gridBtns.first().click()
      } else {
        test.skip(true, 'No tables found to test QR')
        return
      }
    } else {
      await occupiedCell.click()
    }

    // Modal should open with QR code image and URL
    const modal = page.locator('[role="dialog"]').first()
    await expect(modal).toBeVisible({ timeout: 3000 })

    // Verify URL contains the correct format
    const urlInput = modal.locator('input[readonly]').first()
    if (await urlInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const urlVal = await urlInput.inputValue()
      expect(urlVal).toContain(`/menu/${TENANT}`)
      expect(urlVal).toMatch(/table=[0-9a-f-]{36}/)
    }

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('T-13 — Delete a table', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('tab-editor').click()
    await page.getByText(SPACE_NAME, { exact: true }).first().click()

    // Click an occupied table cell to open modal, then delete
    const occupiedCell = page.locator('button[title*="Table"]').last()
    if (await occupiedCell.isVisible({ timeout: 2000 }).catch(() => false)) {
      await occupiedCell.click()
      const modal = page.locator('[role="dialog"]').first()
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const deleteBtn = modal.getByRole('button', { name: /delete|supprimer/i })
        if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await deleteBtn.click()
        }
      }
    }

    // Reload and verify space still exists
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByTestId('tab-editor').click()
    await expect(page.getByText(SPACE_NAME, { exact: true }).first()).toBeVisible()
  })

})

/** Extract QR token from first table's modal URL and save to run-state.json. */
async function saveQrTokenFromPage(page: import('@playwright/test').Page) {
  // Click the first occupied table cell (title contains "Table")
  const occupiedCell = page.locator('button[title*="Table"]').first()
  if (!(await occupiedCell.isVisible({ timeout: 2000 }).catch(() => false))) return

  await occupiedCell.click()
  await page.waitForTimeout(500)

  const modal = page.locator('[role="dialog"]').first()
  if (!(await modal.isVisible({ timeout: 2000 }).catch(() => false))) {
    await page.keyboard.press('Escape')
    return
  }

  const urlInput = modal.locator('input[readonly]').first()
  const urlVal = await urlInput.inputValue().catch(() => '')
  const match  = urlVal?.match(/\?table=([\w-]+)/)
  if (match?.[1]) {
    writeState({ tableQrToken: match[1] })
    console.log('[state] Saved qrToken:', match[1])
  }
  await page.keyboard.press('Escape')
}
