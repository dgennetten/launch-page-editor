import type { SiteData } from '../types/card'
import siteData from '../data/cards.json'

const STORAGE_KEY = 'launch-page-editor-data'

export function loadSiteData(): SiteData {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as SiteData
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
  return siteData as SiteData
}

export function saveSiteData(data: SiteData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2))
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

export function resetToDefault(): SiteData {
  localStorage.removeItem(STORAGE_KEY)
  return siteData as SiteData
}

export { siteData as defaultSiteData }
