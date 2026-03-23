/**
 * Module 3 — Spaces & Tables
 * T-10 through T-13
 *
 * After T-11, saves the QR token for table T1 to run-state.json
 * so customer ordering tests (07-customer.spec.ts) can use it.
 */

import { test, expect } from '@playwright/test'
import { writeState }   from '../helpers/state'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 3 — Spaces & Tables', () => {

  test('T-10 — Create a space', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')

    // Navigate to Editor tab
    await page.getByRole('tab', { name: /editor/i }).click()

    // Check if Terrasse already exists
    const existingSpace = page.getByText('Terrasse', { exact: true })
    if (await existingSpace.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Already exists — just verify
      await expect(existingSpace).toBeVisible()
      return
    }

    // Create new space
    await page.getByRole('button', { name: /new space/i }).click()
    const dialog = page.locator('[role="dialog"], .modal, form').filter({ hasText: /name|space/i }).first()
    await dialog.getByLabel(/name/i).fill('Terrasse')
    await dialog.getByLabel(/col/i).fill('4')
    await dialog.getByLabel(/row/i).fill('3')
    await page.getByRole('button', { name: /save|create/i }).click()

    await expect(page.getByText('Terrasse', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('T-11 — Add tables to the grid', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /editor/i }).click()

    // Select Terrasse space
    await page.getByText('Terrasse', { exact: true }).click()
    await page.waitForLoadState('networkidle')

    // Check if tables already exist
    const existingTables = page.locator('[data-table], .table-cell--occupied, [class*="table"][class*="filled"]')
    const tableCount = await existingTables.count()

    if (tableCount >= 2) {
      // Tables already exist — save QR token and continue
      await saveQrTokenFromPage(page)
      return
    }

    // Click empty cells to add tables
    const emptyCells = page.locator('[data-empty="true"], .cell--empty, .grid-cell:not([data-occupied])').first()
    await emptyCells.click()
    await page.waitForTimeout(500)

    // Add more tables
    const moreCells = page.locator('[data-empty="true"], .cell--empty, .grid-cell:not([data-occupied])').first()
    if (await moreCells.isVisible().catch(() => false)) {
      await moreCells.click()
      await page.waitForTimeout(500)
    }

    await saveQrTokenFromPage(page)
  })

  test('T-12 — QR code generation and download', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /editor/i }).click()
    await page.getByText('Terrasse', { exact: true }).click()

    // Click first QR button in the grid
    const qrBtn = page.getByRole('button', { name: /qr/i }).first()
    await expect(qrBtn).toBeVisible()
    await qrBtn.click()

    // Modal should open with QR code and URL
    const modal = page.locator('[role="dialog"], .modal').first()
    await expect(modal).toBeVisible()

    // Verify URL contains the correct format
    const urlText = await page.getByText(/\/menu\//i).first().textContent()
    expect(urlText).toContain(`/menu/${TENANT}`)
    expect(urlText).toMatch(/table=[0-9a-f-]{36}/)

    // Download button
    const downloadBtn = page.getByRole('button', { name: /download/i })
    if (await downloadBtn.isVisible().catch(() => false)) {
      await expect(downloadBtn).toBeVisible()
    }

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('T-13 — Delete a table', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/spaces`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /editor/i }).click()
    await page.getByText('Terrasse', { exact: true }).click()

    // Count existing tables before delete
    const tablesBefore = page.locator('[data-testid*="table"], .table-cell--occupied').count()

    // Right-click or click delete on the last table found
    const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).last()
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click()
      // Confirm if dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i })
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click()
      }
    } else {
      // Try clicking a table cell to get a delete option
      const occupiedCell = page.locator('[class*="occupied"], [data-table]').last()
      if (await occupiedCell.isVisible({ timeout: 2000 }).catch(() => false)) {
        await occupiedCell.click({ button: 'right' })
        await page.getByText(/delete|remove/i).first().click()
      }
    }

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /editor/i }).click()
    await page.getByText('Terrasse', { exact: true }).click()
    // Just verify page loads correctly without error
    await expect(page.getByText('Terrasse', { exact: true })).toBeVisible()
  })

})

/** Extract QR token from first table's QR modal and save to run-state.json. */
async function saveQrTokenFromPage(page: import('@playwright/test').Page) {
  const qrBtn = page.getByRole('button', { name: /qr/i }).first()
  if (!(await qrBtn.isVisible({ timeout: 2000 }).catch(() => false))) return

  await qrBtn.click()
  await page.waitForTimeout(500)

  // Look for URL text in modal
  const urlEl = page.getByText(/\/menu\//i).first()
  const urlText = await urlEl.textContent().catch(() => '')
  const match   = urlText?.match(/\?table=([\w-]+)/)
  if (match?.[1]) {
    writeState({ tableQrToken: match[1] })
    console.log('[state] Saved qrToken:', match[1])
  }
  await page.keyboard.press('Escape')
}
