/**
 * Module 14 — Tenant Isolation
 * T-60 through T-61
 */

import { test, expect } from '@playwright/test'

const TENANT = process.env.MANAGER_TENANT ?? 'cafetunisia'

test.use({ storageState: 'manager-auth.json' })

test.describe.serial('Module 14 — Tenant Isolation', () => {

  test('T-60 — Data does not bleed between tenants', async ({ page }) => {
    // Create a category in cafetunisia
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')

    const testCatName = 'Isolation Test Cat'
    if (!(await page.getByText(testCatName).isVisible({ timeout: 1000 }).catch(() => false))) {
      await page.getByTestId('btn-add-category').click()
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.getByTestId('input-cat-name').fill(testCatName)
      await page.getByRole('button', { name: /save|create|enregistrer/i }).click()
      await expect(page.getByText(testCatName)).toBeVisible()
    }

    // Log in as restauranttunisia manager via API to check isolation
    // Since we may not have restauranttunisia credentials, we verify via the API
    const apiUrl = process.env.API_URL ?? 'https://tabhub-api-caguf5bkb7b9bzca.francecentral-01.azurewebsites.net'
    const res = await page.request.get(`${apiUrl}/menu`, {
      headers: {
        'X-Tenant': 'restauranttunisia',
        'Content-Type': 'application/json',
      },
    })

    if (res.ok()) {
      const body = await res.json()
      const categories = body.categories ?? []
      const hasIsolationCat = categories.some((c: { name: string }) => c.name === testCatName)
      expect(hasIsolationCat).toBe(false)
    }
  })

  test('T-61 — Cross-tenant JWT is rejected', async ({ page }) => {
    // Get cafetunisia JWT
    await page.goto(`/manager/${TENANT}/menu`)
    await page.waitForLoadState('networkidle')
    const token = await page.evaluate(() => localStorage.getItem('tabhub_token'))
    expect(token).toBeTruthy()

    // Use cafetunisia JWT against restauranttunisia — should get 401 or 403
    const apiUrl = process.env.API_URL ?? 'https://tabhub-api-caguf5bkb7b9bzca.francecentral-01.azurewebsites.net'
    const res = await page.request.get(`${apiUrl}/spaces`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant': 'restauranttunisia',
      },
    })

    expect([401, 403]).toContain(res.status())
  })

})
