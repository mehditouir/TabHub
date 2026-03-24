/**
 * Module 21 — Super Admin Interface
 * T-76 through T-83
 */

import { test, expect } from '@playwright/test'

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'mehdi@mehdi.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'mehdi123'
const TENANT         = process.env.MANAGER_TENANT ?? 'cafetunisia'

// Clean context — no auth
test.use({ storageState: { cookies: [], origins: [] } })

test.describe.serial('Module 21 — Super Admin Interface', () => {

  test('T-76 — Super admin login', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL('**/admin', { timeout: 10000 })
    // Dashboard shows Tenants and Managers tabs
    await expect(page.getByRole('tab', { name: /tenant/i }).or(page.getByRole('button', { name: /tenant/i }))).toBeVisible()
    await expect(page.getByRole('tab', { name: /manager/i }).or(page.getByRole('button', { name: /manager/i }))).toBeVisible()
  })

  test('T-77 — Super admin auth guard blocks unauthenticated access', async ({ browser }) => {
    const ctx  = await browser.newContext()  // clean — no token
    const page = await ctx.newPage()
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
    await ctx.close()
  })

  test('T-78 — Wrong credentials rejected on admin login', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid|credentials|error/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('T-79 — Regular manager cannot log in as super admin', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('mehdi@cafetunisia.com')
    await page.getByLabel('Password').fill('mehdi123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid|credentials|error/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('T-80 — Tenants tab lists existing tenants', async ({ page }) => {
    // Login as super admin
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/admin')

    // Click Tenants tab
    const tenantsTab = page.getByRole('tab', { name: /tenant/i })
      .or(page.getByRole('button', { name: /tenant/i })).first()
    await tenantsTab.click()

    // cafetunisia and restauranttunisia should appear
    await expect(page.getByText('cafetunisia').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('restauranttunisia').first()).toBeVisible()
  })

  test('T-81 — Create a new tenant', async ({ page }) => {
    await loginAdmin(page)
    const tenantsTab = page.getByRole('tab', { name: /tenant/i })
      .or(page.getByRole('button', { name: /tenant/i })).first()
    await tenantsTab.click()

    // Check if testcafe already exists
    if (await page.getByText('testcafe').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('testcafe')).toBeVisible()
      return
    }

    // Fill new tenant form
    const slugInput = page.getByLabel(/slug/i)
    const nameInput = page.getByLabel(/name|display/i)
    await slugInput.fill('testcafe')
    await nameInput.fill('Test Café')
    await page.getByRole('button', { name: /create tenant|add tenant/i }).click()

    await expect(page.getByText(/testcafe.*created|success/i).or(page.getByText('testcafe')).first()).toBeVisible({ timeout: 8000 })
  })

  test('T-82 — Create a new manager and assign to tenant', async ({ page }) => {
    await loginAdmin(page)

    const managersTab = page.getByRole('tab', { name: /manager/i })
      .or(page.getByRole('button', { name: /manager/i })).first()
    await managersTab.click()

    // Check if manager@testcafe.com already exists
    if (await page.getByText('manager@testcafe.com').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText('manager@testcafe.com')).toBeVisible()
      return
    }

    // Fill new manager form
    await page.getByLabel(/display name/i).fill('Test Manager')
    await page.getByLabel(/email/i).fill('manager@testcafe.com')
    await page.getByLabel(/password/i).fill('test1234')

    // Assign to testcafe tenant — find option text then select by label string
    const tenantSelect = page.getByLabel(/tenant/i).or(page.locator('select').first())
    if (await tenantSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const testcafeOpt = tenantSelect.locator('option').filter({ hasText: /testcafe/i })
      if (await testcafeOpt.count() > 0) {
        const optText = await testcafeOpt.first().textContent()
        if (optText) await tenantSelect.selectOption({ label: optText.trim() })
      }
    }

    await page.getByRole('button', { name: /create manager|add manager/i }).click()
    await expect(page.getByText(/manager@testcafe.com|created|success/i).first()).toBeVisible({ timeout: 8000 })

    // Verify new manager can login at /login
    await page.goto('/login')
    await page.getByLabel('Tenant (slug)').fill('testcafe')
    await page.getByLabel('Email').fill('manager@testcafe.com')
    await page.getByLabel('Password').fill('test1234')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/manager\/testcafe\/dashboard/, { timeout: 10000 })
  })

  test('T-83 — Assign existing manager to a second tenant', async ({ page }) => {
    await loginAdmin(page)

    const managersTab = page.getByRole('tab', { name: /manager/i })
      .or(page.getByRole('button', { name: /manager/i })).first()
    await managersTab.click()

    // Find the Assign Manager form
    const assignSection = page.getByText(/assign manager/i).locator('..')
      .or(page.locator('[class*="assign"]')).first()

    if (await assignSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select Test Manager — find option text then select by label string
      const managerSelect = assignSection.getByLabel(/manager/i)
        .or(assignSection.locator('select').first())
      const managerOpt = managerSelect.locator('option').filter({ hasText: /test manager|manager@testcafe/i })
      if (await managerOpt.count() > 0) {
        const mText = await managerOpt.first().textContent()
        if (mText) await managerSelect.selectOption({ label: mText.trim() })
      }

      // Select cafetunisia tenant — find option text then select by label string
      const tenantSelect = assignSection.getByLabel(/tenant/i)
        .or(assignSection.locator('select').nth(1))
      const tenantOpt = tenantSelect.locator('option').filter({ hasText: /cafe tunisia|cafetunisia/i })
      if (await tenantOpt.count() > 0) {
        const tText = await tenantOpt.first().textContent()
        if (tText) await tenantSelect.selectOption({ label: tText.trim() })
      }

      // Role: Admin
      const roleSelect = assignSection.getByLabel(/role/i)
        .or(assignSection.locator('select').nth(2))
      if (await roleSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        const adminOpt = roleSelect.locator('option').filter({ hasText: /admin/i })
        if (await adminOpt.count() > 0) {
          const rText = await adminOpt.first().textContent()
          if (rText) await roleSelect.selectOption({ label: rText.trim() })
        }
      }

      await assignSection.getByRole('button', { name: /assign/i }).click()
      await expect(page.getByText(/assigned|success/i).first()).toBeVisible({ timeout: 5000 })
    } else {
      // Assign via standalone form on the page
      const managerDropdown = page.locator('select').filter({ hasText: /test manager|testcafe/i }).first()
      if (await managerDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        const mOpt = managerDropdown.locator('option').filter({ hasText: /test manager/i })
        if (await mOpt.count() > 0) {
          const mText = await mOpt.first().textContent()
          if (mText) await managerDropdown.selectOption({ label: mText.trim() })
        }
        const tenantDropdown = page.locator('select').nth(1)
        const tOpt = tenantDropdown.locator('option').filter({ hasText: /cafetunisia/i })
        if (await tOpt.count() > 0) {
          const tText = await tOpt.first().textContent()
          if (tText) await tenantDropdown.selectOption({ label: tText.trim() })
        }
        await page.getByRole('button', { name: /assign/i }).click()
        await expect(page.getByText(/assigned|success/i).first()).toBeVisible({ timeout: 5000 })
      }
    }

    // Verify manager@testcafe.com can login to cafetunisia
    await page.goto('/login')
    await page.getByLabel('Tenant (slug)').fill(TENANT)
    await page.getByLabel('Email').fill('manager@testcafe.com')
    await page.getByLabel('Password').fill('test1234')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(new RegExp(`/manager/${TENANT}/dashboard`), { timeout: 10000 })
  })

})

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/admin')
}
