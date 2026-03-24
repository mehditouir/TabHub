import { apiFetch } from './client'
import type { PublicMenuResponse, Category, MenuItem, ModifierGroup, ModifierOption, Ingredient } from '@/lib/types'

// Public — no auth required, tenant passed explicitly (from URL)
export function getPublicMenu(tenant: string) {
  return apiFetch<PublicMenuResponse>('/menu', {}, tenant)
}

// Management (auth required)
export function getCategories() {
  return apiFetch<Category[]>('/categories')
}

export function createCategory(name: string, sortOrder = 0) {
  return apiFetch<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, sortOrder }),
  })
}

export function updateCategory(id: string, data: { name: string; sortOrder: number; isActive: boolean }) {
  return apiFetch<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteCategory(id: string) {
  return apiFetch<void>(`/categories/${id}`, { method: 'DELETE' })
}

export function getMenuItems() {
  return apiFetch<MenuItem[]>('/menu-items')
}

export function createMenuItem(data: {
  categoryId: string; name: string; price: number
  description?: string; imageUrl?: string; sortOrder?: number
}) {
  return apiFetch<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify(data) })
}

export function updateMenuItem(id: string, data: {
  categoryId: string; name: string; price: number; isAvailable: boolean
  description?: string; imageUrl?: string; sortOrder?: number
}) {
  return apiFetch<MenuItem>(`/menu-items/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteMenuItem(id: string) {
  return apiFetch<void>(`/menu-items/${id}`, { method: 'DELETE' })
}

// ── Modifier groups ───────────────────────────────────────────────────────────

export function getModifierGroups(menuItemId: string) {
  return apiFetch<ModifierGroup[]>(`/modifier-groups?menuItemId=${menuItemId}`)
}

export function createModifierGroup(data: {
  menuItemId: string; name: string; isRequired: boolean
  minSelections: number; maxSelections: number; sortOrder: number
}) {
  return apiFetch<ModifierGroup>('/modifier-groups', { method: 'POST', body: JSON.stringify(data) })
}

export function deleteModifierGroup(id: string) {
  return apiFetch<void>(`/modifier-groups/${id}`, { method: 'DELETE' })
}

export function createModifierOption(data: {
  modifierGroupId: string; name: string; priceDelta: number; isAvailable: boolean; sortOrder: number
}) {
  return apiFetch<ModifierOption>('/modifier-options', { method: 'POST', body: JSON.stringify(data) })
}

// ── Ingredients ───────────────────────────────────────────────────────────────

export function getIngredients() {
  return apiFetch<Ingredient[]>('/ingredients')
}

export function createIngredient(name: string) {
  return apiFetch<Ingredient>('/ingredients', { method: 'POST', body: JSON.stringify({ name }) })
}

export function updateIngredient(id: string, data: { name: string; isActive: boolean }) {
  return apiFetch<Ingredient>(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function uploadMenuItemImage(id: string, file: File): Promise<{ imageUrl: string }> {
  const token  = localStorage.getItem('tabhub_token')
  const tenant = localStorage.getItem('tabhub_tenant') ?? ''
  const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:5000'
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_URL}/menu-items/${id}/image`, {
    method: 'POST',
    headers: {
      ...(token  ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { 'X-Tenant': tenant }               : {}),
    },
    body: form,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? res.statusText)
  }

  return res.json()
}
