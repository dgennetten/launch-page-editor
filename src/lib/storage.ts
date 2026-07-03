import type { SiteData } from '../types/card'
import fallbackData from '../data/cards.json'

const STORAGE_KEY = 'launch-page-editor-data'
const CARDS_URL = '/data/cards.json'

export const defaultSiteData = fallbackData as SiteData

export async function fetchSiteData(): Promise<SiteData> {
  const response = await fetch(CARDS_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load cards.json (${response.status})`)
  }
  const parsed = (await response.json()) as SiteData
  if (!parsed.site || !Array.isArray(parsed.cards)) {
    throw new Error('Invalid cards.json format')
  }
  return parsed
}

export function hasDraftData(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

/** Draft data for the editor (localStorage), falling back to the bundled default. */
export function loadDraftData(): SiteData {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as SiteData
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
  return defaultSiteData
}

export function saveSiteData(data: SiteData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2))
}

export function clearDraftData(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function exportSiteData(data: SiteData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'cards.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function publishSiteData(data: SiteData, password: string): Promise<void> {
  const response = await fetch('/api/publish.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, data }),
  })

  let message = `Publish failed (${response.status})`
  try {
    const body = (await response.json()) as { error?: string; ok?: boolean }
    if (body.error) message = body.error
    if (response.ok && body.ok) return
  } catch {
    // non-JSON error body
  }
  throw new Error(message)
}
