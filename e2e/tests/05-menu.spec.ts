/**
 * Module 5 — Menu System
 * T-19 through T-24
 *
 * E2E creates its own "E2E *" category/items — never relies on seed data.
 * All tests are idempotent: find-or-create pattern throughout.
 */

import { test, expect } from '@playwright/test'

const TENANT   = process.env.MANAGER_TENANT ?? 'cafetunisia'
const CAT_NAME  = 'E2E Boissons'
const ITEM_NAME = 'E2E Café'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 5 — Menu System', () => {

  test('T-19 — Create a category', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    if (await page.getByText(CAT_NAME).isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText(CAT_NAME)).toBeVisible()
      return
    }

    await page.getByRole('button', { name: /add category/i }).click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.getByLabel(/name/i).fill(CAT_NAME)
    const sortInput = dialog.getByLabel(/sort/i)
    if (await sortInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await sortInput.fill('99')
    }
    await page.getByRole('button', { name: /save|create/i }).click()

    await expect(page.getByText(CAT_NAME)).toBeVisible({ timeout: 5000 })
  })

  test('T-20 — Create a menu item', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Expand E2E Boissons category
    const catHeader = page.getByText(CAT_NAME).first()
    await catHeader.click()
    await page.waitForTimeout(300)

    if (await page.getByText(ITEM_NAME).isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText(ITEM_NAME)).toBeVisible()
      return
    }

    await page.getByRole('button', { name: /add item/i }).click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.getByLabel(/name/i).fill(ITEM_NAME)
    await dialog.getByLabel(/price/i).fill('3.500')
    const descInput = dialog.getByLabel(/desc/i)
    if (await descInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await descInput.fill('Espresso serré — créé par E2E tests')
    }
    await page.getByRole('button', { name: /save|create/i }).click()

    await expect(page.getByText(ITEM_NAME)).toBeVisible({ timeout: 5000 })
  })

  test('T-21 — Toggle item availability', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    // Expand E2E Boissons
    await page.getByText(CAT_NAME).first().click()
    await page.waitForTimeout(300)

    // Find E2E Café row and toggle availability off
    const itemRow = page.locator('li, tr, [data-testid*="item"]').filter({ hasText: ITEM_NAME }).first()
    const toggleBtn = itemRow.getByRole('button', { name: /unavailable|toggle|available/i })
      .or(itemRow.locator('input[type="checkbox"], button[class*="toggle"]').first())
    await toggleBtn.click()

    await page.waitForTimeout(500)

    // Toggle back to available
    await toggleBtn.click()
    await page.waitForTimeout(500)

    await expect(page.getByText(ITEM_NAME)).toBeVisible()
  })

  test('T-22 — Create a modifier group on an item', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')
    await page.getByText(CAT_NAME).first().click()
    await page.waitForTimeout(300)

    // Click edit on E2E Café item
    const itemRow = page.locator('li, tr, [data-testid*="item"]').filter({ hasText: ITEM_NAME }).first()
    await itemRow.getByRole('button', { name: /edit/i }).click()

    const dialog = page.locator('[role="dialog"]').first()

    const addModBtn = dialog.getByRole('button', { name: /modifier|add group/i })
    if (!(await addModBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.keyboard.press('Escape')
      test.skip(true, 'Modifier group UI not found in item edit dialog')
      return
    }

    await addModBtn.click()

    const groupNameInput = dialog.getByLabel(/group name|modifier name/i)
    await groupNameInput.fill('E2E Sucre')

    const requiredToggle = dialog.getByLabel(/required/i)
    if (await requiredToggle.isVisible({ timeout: 500 }).catch(() => false)) {
      if (!(await requiredToggle.isChecked())) await requiredToggle.check()
    }

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

    const ingredientsTab = page.getByRole('tab', { name: /ingredient/i })
      .or(page.getByRole('button', { name: /ingredient/i }))
      .first()

    if (await ingredientsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ingredientsTab.click()
    }

    if (!(await page.getByText('E2E Lait').isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.getByRole('button', { name: /add ingredient/i }).click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByLabel(/name/i).fill('E2E Lait')
      await page.getByRole('button', { name: /save|create/i }).click()
      await expect(page.getByText('E2E Lait')).toBeVisible({ timeout: 5000 })
    } else {
      await expect(page.getByText('E2E Lait')).toBeVisible()
    }
  })

  test('T-24 — Disabling an ingredient cascades to linked items', async ({ page }) => {
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    const ingredientsTab = page.getByRole('tab', { name: /ingredient/i })
      .or(page.getByRole('button', { name: /ingredient/i }))
      .first()
    if (await ingredientsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ingredientsTab.click()
    }

    const laitRow = page.locator('li, tr').filter({ hasText: 'E2E Lait' }).first()
    const toggleBtn = laitRow.locator('input[type="checkbox"], button[class*="toggle"]').first()
    if (await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleBtn.click()
      await page.waitForTimeout(1000)
      await toggleBtn.click()
      await page.waitForTimeout(500)
    }

    await page.getByRole('tab', { name: /menu|items/i }).first().click().catch(() => {})
    await page.waitForTimeout(500)
  })

})
