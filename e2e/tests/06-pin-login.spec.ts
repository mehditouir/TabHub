/**
 * Module 6 — Staff PIN Login
 * T-25 through T-28
 */

import { test, expect } from '@playwright/test'
import { loginWithPin } from '../helpers/auth'

const TENANT      = process.env.MANAGER_TENANT ?? 'cafetunisia'
const WAITER_PIN  = process.env.WAITER_PIN  ?? '5678'
const KITCHEN_PIN = process.env.KITCHEN_PIN ?? '2222'
const CASHIER_PIN = process.env.CASHIER_PIN ?? '3333'

// Clean context — no manager token stored
test.use({ storageState: { cookies: [], origins: [] } })

test.describe.serial('Module 6 — Staff PIN Login', () => {

  test('T-25 — Waiter PIN login', async ({ page }) => {
    await page.goto(`/waiter/${TENANT}`)
    await loginWithPin(page, TENANT, WAITER_PIN)

    // After successful login, should see the waiter app (floor plan / orders tabs)
    await expect(page.getByText(/floor|plan salle|terrasse|commandes/i).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/serveur|waiter/i).first()).toBeVisible()
  })

  test('T-26 — Wrong PIN rejected', async ({ page }) => {
    await page.goto(`/kitchen/${TENANT}`)
    await loginWithPin(page, TENANT, '0000')

    await expect(page.getByText(/invalid|incorrect|wrong|pin/i).first()).toBeVisible({ timeout: 5000 })
    // Should remain on PIN screen
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('T-27 — Kitchen PIN login', async ({ page }) => {
    await page.goto(`/kitchen/${TENANT}`)
    await loginWithPin(page, TENANT, KITCHEN_PIN)

    // Kitchen kanban should be visible
    await expect(page.getByText(/en attente|pending|cuisine/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('T-28 — Cashier PIN login', async ({ page }) => {
    await page.goto(`/cashier/${TENANT}`)
    await loginWithPin(page, TENANT, CASHIER_PIN)

    // Cashier should show New Order + Sessions tabs
    await expect(page.getByText(/new order|nouvelle commande|sessions/i).first()).toBeVisible({ timeout: 8000 })
  })

})
