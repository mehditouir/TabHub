import { apiFetch } from './client'

export function getConfig() {
  return apiFetch<Record<string, string>>('/config')
}

export function setConfig(key: string, value: string) {
  return apiFetch<{ key: string; value: string }>(`/config/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
}
