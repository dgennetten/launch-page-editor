import { useCallback, useEffect, useState } from 'react'
import type { SiteData } from '../types/card'
import { loadSiteData, saveSiteData } from '../lib/storage'

export function useSiteData() {
  const [data, setData] = useState<SiteData>(() => loadSiteData())
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (dirty) {
      saveSiteData(data)
    }
  }, [data, dirty])

  const update = useCallback((updater: (prev: SiteData) => SiteData) => {
    setData((prev) => updater(prev))
    setDirty(true)
  }, [])

  const replace = useCallback((next: SiteData) => {
    setData(next)
    setDirty(true)
  }, [])

  return { data, update, replace, dirty, setDirty }
}
