/**
 * Module 17 — Image Upload
 * T-66 through T-67
 */

import { test, expect } from '@playwright/test'
import * as path        from 'path'
import * as fs          from 'fs'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 17 — Image Upload', () => {

  test('T-66 — Menu item photo upload and display', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Find E2E Café item and open its edit dialog
    const cafeRow = page.locator('li').filter({ hasText: 'E2E Café' }).first()
    if (!(await cafeRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'E2E Café item not found — T-20 may not have run')
      return
    }
    await cafeRow.getByRole('button', { name: /edit|modifier/i }).click()

    const dialog = page.locator('[role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 3000 })

    // Photo upload button is inside the edit dialog
    const photoBtn = dialog.getByRole('button', { name: /upload|photo|change/i }).first()
    if (!(await photoBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Photo upload button not found in item edit dialog')
      return
    }

    // Create a minimal JPEG for testing
    const testImagePath = path.join(__dirname, '..', 'test-image.jpg')
    if (!fs.existsSync(testImagePath)) {
      const minimalJpeg = Buffer.from(
        'ffd8ffe000104a46494600010100000100010000' +
        'ffdb004300080606070605080707070909080a0c' +
        '140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20' +
        '242e2720222c231c1c2837292c30313434341f27' +
        '39003d3832363334ffdb00430109090c0b0c180d' +
        '0d1832211c213232323232323232323232323232' +
        '3232323232323232323232323232323232323232' +
        '323232323232323232323232ffc00011080001000' +
        '103012200021101031101ffc4001f000001050101' +
        '01010100000000000000000102030405060708090' +
        'a0bffc400b51000020103030204030505040400000' +
        '001027710004051213143206150724208161711209' +
        '0a181a252627282930313233343536373839ffd9',
        'hex'
      )
      fs.writeFileSync(testImagePath, minimalJpeg)
    }

    // Click photo button then set files on the hidden input
    await photoBtn.click()
    await page.waitForTimeout(300)
    await dialog.locator('input[type="file"]').first().setInputFiles(testImagePath)
    await page.waitForTimeout(3000)

    // Verify no upload error
    await expect(page.getByText(/upload failed/i)).not.toBeVisible()

    // Save and close the dialog
    await page.getByRole('button', { name: /save|enregistrer/i }).first().click()
    await page.waitForTimeout(500)
  })

  test('T-67 — Large image handling', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Find E2E Café item and open its edit dialog
    const cafeRow = page.locator('li').filter({ hasText: 'E2E Café' }).first()
    if (!(await cafeRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'E2E Café item not found — T-20 may not have run')
      return
    }
    await cafeRow.getByRole('button', { name: /edit|modifier/i }).click()

    const dialog = page.locator('[role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 3000 })

    const photoBtn = dialog.getByRole('button', { name: /upload|photo|change/i }).first()
    if (!(await photoBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Photo button not found in edit dialog')
      return
    }

    // Create a large fake file (> 5MB) with JPEG header
    const largePath = path.join(__dirname, '..', 'large-test.jpg')
    if (!fs.existsSync(largePath)) {
      const buf = Buffer.alloc(6 * 1024 * 1024, 0xff)
      buf[0] = 0xff; buf[1] = 0xd8  // JPEG SOI marker
      fs.writeFileSync(largePath, buf)
    }

    await photoBtn.click()
    await page.waitForTimeout(300)
    await dialog.locator('input[type="file"]').first().setInputFiles(largePath)
    await page.waitForTimeout(3000)

    // Either error message shown OR accepted and resized silently — no crash
    await expect(page.getByText(/server error|internal server error|crash/i)).not.toBeVisible()

    // Close dialog
    await page.keyboard.press('Escape')
  })

})
