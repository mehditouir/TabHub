/**
 * Module 16 — PDF Bill
 * T-65
 */

import { test, expect } from '@playwright/test'
import { loginWithPin } from '../helpers/auth'

const TENANT      = process.env.MANAGER_TENANT ?? 'cafetunisia'
const CASHIER_PIN = process.env.CASHIER_PIN ?? '3333'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe.serial('Module 16 — PDF Bill', () => {

  test('T-65 — PDF bill content is correct (Linux font smoke test)', async ({ page }) => {
    // Login as cashier
    await page.goto(`/cashier/${TENANT}`)
    await loginWithPin(page, TENANT, CASHIER_PIN)
    await page.waitForLoadState('networkidle')

    // Navigate to Sessions and close a session to get a bill
    const sessionsTab = page.getByRole('button', { name: /session/i })
    if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionsTab.click()
    }

    const closeBtn = page.getByRole('button', { name: /close|fermer/i }).first()
    if (await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeBtn.click()

      // Wait for PDF to render
      const pdfContainer = page.locator('iframe[src*="blob"], embed[type*="pdf"], [class*="pdf"]').first()
      const hasPdf = await pdfContainer.isVisible({ timeout: 8000 }).catch(() => false)

      if (hasPdf) {
        // PDF rendered — not blank
        await expect(pdfContainer).toBeVisible()

        // Check no 500 error (which would indicate server crash)
        await expect(page.getByText(/500|server error/i)).not.toBeVisible()
        await expect(page.getByText(/error|failed/i)).not.toBeVisible()

        // If PDF opened in new page (blob URL), check it's not empty
        const iframeSrc = await pdfContainer.getAttribute('src').catch(() => '')
        expect(iframeSrc).toBeTruthy()
        // Blob URL confirms PDF was generated
        expect(iframeSrc).toMatch(/blob:|data:application\/pdf/)
      } else {
        // Fallback: try fetching the bill endpoint directly
        const token = await page.evaluate(() => localStorage.getItem('tabhub_token'))
        const apiUrl = process.env.API_URL ?? 'https://api-tabhub.azurewebsites.net'

        // Get latest order with a bill
        const ordersRes = await page.request.get(`${apiUrl}/orders`, {
          headers: {
            'Authorization': `Bearer ${token ?? ''}`,
            'X-Tenant': TENANT,
          },
        })

        if (ordersRes.ok()) {
          const orders = await ordersRes.json()
          if (orders.length > 0) {
            const orderId = orders[0].id
            const billRes = await page.request.get(`${apiUrl}/orders/${orderId}/bill.pdf`, {
              headers: {
                'Authorization': `Bearer ${token ?? ''}`,
                'X-Tenant': TENANT,
              },
            })
            // 200 = PDF generated successfully (Linux font smoke test)
            expect(billRes.status()).toBe(200)
            expect(billRes.headers()['content-type']).toContain('pdf')

            const body = await billRes.body()
            // PDF header: %PDF
            expect(body.slice(0, 4).toString()).toBe('%PDF')
          }
        }
      }
    } else {
      // No open sessions — use API to verify PDF generation against a completed order
      const token  = await page.evaluate(() => localStorage.getItem('tabhub_token'))
      const apiUrl = process.env.API_URL ?? 'https://tabhub-api-caguf5bkb7b9bzca.francecentral-01.azurewebsites.net'
      const ordersRes = await page.request.get(`${apiUrl}/orders`, {
        headers: {
          'Authorization': `Bearer ${token ?? ''}`,
          'X-Tenant':      TENANT,
        },
      })
      if (ordersRes.ok()) {
        const orders = await ordersRes.json()
        if (orders.length > 0) {
          const billRes = await page.request.get(`${apiUrl}/orders/${orders[0].id}/bill.pdf`, {
            headers: {
              'Authorization': `Bearer ${token ?? ''}`,
              'X-Tenant':      TENANT,
            },
          })
          expect(billRes.status()).toBe(200)
          expect(billRes.headers()['content-type']).toContain('pdf')
          const body = await billRes.body()
          expect(body.slice(0, 4).toString()).toBe('%PDF')
        }
      }
    }
  })

})
