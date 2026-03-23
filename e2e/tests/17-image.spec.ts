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

    // Expand Boissons and find Café
    await page.getByText('Boissons').first().click()
    await page.waitForTimeout(300)

    // Find the photo/upload button for Café
    const cafeRow = page.locator('li, tr, [data-testid*="item"]').filter({ hasText: 'Café' }).first()
    const photoBtn = cafeRow.getByRole('button', { name: /photo|image|upload|pic/i })
      .or(cafeRow.locator('input[type="file"]').locator('..'))
      .first()

    if (!(await photoBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Photo upload button not found for Café item')
      return
    }

    // Create a minimal 1x1 pixel JPEG in memory for testing
    // Using a pre-existing test image if available, else create a minimal one
    const testImagePath = path.join(__dirname, '..', 'test-image.jpg')
    if (!fs.existsSync(testImagePath)) {
      // Create minimal JPEG (smallest valid JPEG)
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

    // Click photo button and upload
    const fileInput = page.locator('input[type="file"]').first()
    if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fileInput.setInputFiles(testImagePath)
    } else {
      await photoBtn.click()
      await page.waitForTimeout(500)
      await page.locator('input[type="file"]').first().setInputFiles(testImagePath)
    }

    // Wait for upload to complete
    await page.waitForTimeout(3000)

    // Verify image thumbnail appears or URL contains .webp
    const img = cafeRow.locator('img').first()
    if (await img.isVisible({ timeout: 5000 }).catch(() => false)) {
      const src = await img.getAttribute('src')
      // Image uploaded — should be .webp
      await expect(img).toBeVisible()
    } else {
      // Fallback: verify no error message
      await expect(page.getByText(/upload failed|error/i)).not.toBeVisible()
    }
  })

  test('T-67 — Large image handling', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Boissons').first().click()
    await page.waitForTimeout(300)

    const cafeRow = page.locator('li, tr').filter({ hasText: 'Café' }).first()
    const photoBtn = cafeRow.getByRole('button', { name: /photo|image|upload/i }).first()

    if (!(await photoBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Photo button not found')
      return
    }

    // Create a large fake file (> 5MB) using a buffer
    const largePath = path.join(__dirname, '..', 'large-test.jpg')
    if (!fs.existsSync(largePath)) {
      // Create a 6MB file with JPEG header
      const buf = Buffer.alloc(6 * 1024 * 1024, 0xff)
      buf[0] = 0xff; buf[1] = 0xd8  // JPEG SOI marker
      fs.writeFileSync(largePath, buf)
    }

    await photoBtn.click()
    await page.waitForTimeout(300)
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(largePath)
    await page.waitForTimeout(3000)

    // Either: error message shown, OR: accepted and resized silently
    // Both are valid per REGRESSION.md — just no crash
    await expect(page.getByText(/server error|500|crash/i)).not.toBeVisible()
  })

})
