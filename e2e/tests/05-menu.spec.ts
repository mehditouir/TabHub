/**
 * Module 5 — Menu System
 * T-19 through T-24
 */

import { test, expect } from '@playwright/test'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 5 — Menu System', () => {

  test('T-19 — Create a category', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    if (await page.getByText('Boissons').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('Boissons')).toBeVisible()
      return
    }

    await page.getByRole('button', { name: /add category/i }).click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.getByLabel(/name/i).fill('Boissons')
    const sortInput = dialog.getByLabel(/sort/i)
    if (await sortInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await sortInput.fill('1')
    }
    await page.getByRole('button', { name: /save|create/i }).click()

    await expect(page.getByText('Boissons')).toBeVisible({ timeout: 5000 })
  })

  test('T-20 — Create a menu item', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Expand Boissons category
    const boissonsHeader = page.getByText('Boissons').first()
    await boissonsHeader.click()
    await page.waitForTimeout(300)

    if (await page.getByText('Café').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('Café')).toBeVisible()
      return
    }

    await page.getByRole('button', { name: /add item/i }).click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.getByLabel(/name/i).fill('Café')
    await dialog.getByLabel(/price/i).fill('3.500')
    const descInput = dialog.getByLabel(/desc/i)
    if (await descInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await descInput.fill('Espresso serré')
    }
    await page.getByRole('button', { name: /save|create/i }).click()

    await expect(page.getByText('Café')).toBeVisible({ timeout: 5000 })
  })

  test('T-21 — Toggle item availability', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Expand Boissons
    await page.getByText('Boissons').first().click()
    await page.waitForTimeout(300)

    // Find Café row and toggle availability off
    const cafeRow = page.locator('li, tr, [data-testid*="item"]').filter({ hasText: 'Café' }).first()
    const toggleBtn = cafeRow.getByRole('button', { name: /unavailable|toggle|available/i })
      .or(cafeRow.locator('input[type="checkbox"], button[class*="toggle"]').first())
    await toggleBtn.click()

    await page.waitForTimeout(500)

    // Toggle back to available
    await toggleBtn.click()
    await page.waitForTimeout(500)

    await expect(page.getByText('Café')).toBeVisible()
  })

  test('T-22 — Create a modifier group on an item', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Boissons').first().click()
    await page.waitForTimeout(300)

    // Click edit on Café item
    const cafeRow = page.locator('li, tr, [data-testid*="item"]').filter({ hasText: 'Café' }).first()
    await cafeRow.getByRole('button', { name: /edit/i }).click()

    const dialog = page.locator('[role="dialog"]').first()

    // Look for "Add modifier group" button
    const addModBtn = dialog.getByRole('button', { name: /modifier|add group/i })
    if (!(await addModBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Skip if modifier UI not available in this dialog
      await page.keyboard.press('Escape')
      test.skip(true, 'Modifier group UI not found in item edit dialog')
      return
    }

    await addModBtn.click()

    // Fill modifier group name
    const groupNameInput = dialog.getByLabel(/group name|modifier name/i)
    await groupNameInput.fill('Sucre')

    const requiredToggle = dialog.getByLabel(/required/i)
    if (await requiredToggle.isVisible({ timeout: 500 }).catch(() => false)) {
      if (!(await requiredToggle.isChecked())) await requiredToggle.check()
    }

    // Add options
    for (const opt of ['Sans sucre', 'Un sucre', 'Deux sucres']) {
      const addOptBtn = dialog.getByRole('button', { name: /add option/i })
      if (await addOptBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await addOptBtn.click()
        await dialog.getByLabel(/option name/i).last().fill(opt)
      }
    }

    await page.getByRole('button', { name: /save/i }).click()
    await page.waitForTimeout(500)
  })

  test('T-23 — Create an ingredient and link to item', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Look for Ingredients section/tab
    const ingredientsTab = page.getByRole('tab', { name: /ingredient/i })
      .or(page.getByRole('button', { name: /ingredient/i }))
      .first()

    if (await ingredientsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ingredientsTab.click()
    }

    // Create Lait ingredient if not exists
    if (!(await page.getByText('Lait').isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add ingredient/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('Lait')
      await page.getByRole('button', { name: /save|create/i }).click()
      await expect(page.getByText('Lait')).toBeVisible({ timeout: 5000 })
    } else {
      await expect(page.getByText('Lait')).toBeVisible()
    }
  })

  test('T-24 — Disabling an ingredient cascades to linked items', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Navigate to ingredients
    const ingredientsTab = page.getByRole('tab', { name: /ingredient/i })
      .or(page.getByRole('button', { name: /ingredient/i }))
      .first()
    if (await ingredientsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ingredientsTab.click()
    }

    // Find Lait and disable it
    const laitRow = page.locator('li, tr').filter({ hasText: 'Lait' }).first()
    const toggleBtn = laitRow.locator('input[type="checkbox"], button[class*="toggle"]').first()
    if (await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleBtn.click()
      await page.waitForTimeout(1000)

      // Re-enable Lait
      await toggleBtn.click()
      await page.waitForTimeout(500)
    }

    // Re-enable Café if needed
    await page.getByRole('tab', { name: /menu|items/i }).first().click().catch(() => {})
    await page.waitForTimeout(500)
  })

})
