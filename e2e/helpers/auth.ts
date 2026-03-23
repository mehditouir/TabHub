import { Page } from '@playwright/test'

const TENANT   = process.env.MANAGER_TENANT   ?? 'cafetunisia'
const EMAIL    = process.env.MANAGER_EMAIL    ?? 'mehdi@cafetunisia.com'
const PASSWORD = process.env.MANAGER_PASSWORD ?? 'mehdi123'

/** Log in as manager. Waits for redirect to dashboard. */
export async function loginAsManager(page: Page, tenant = TENANT): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Tenant (slug)').fill(tenant)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`**/manager/${tenant}/dashboard`)
}

/** Log in to the super-admin panel. Waits for redirect to /admin. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL    ?? 'mehdi@mehdi.com')
  await page.getByLabel('Password').fill(process.env.ADMIN_PASSWORD ?? 'mehdi123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/admin')
}

/**
 * Log in via the staff PIN keypad (kitchen / cashier / waiter apps).
 * The page must already be on the correct staff URL.
 */
export async function loginWithPin(page: Page, tenant: string, pin: string): Promise<void> {
  await page.getByPlaceholder(/restaurant slug/i).fill(tenant)
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Sign In' }).click()
}
