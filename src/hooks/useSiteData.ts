import { useCallback, useEffect, useState } from 'react'
import type { SiteData } from '../types/card'
import {
  clearDraftData,
  defaultSiteData,
  fetchSiteData,
  hasDraftData,
  loadDraftData,
  saveSiteData,
} from '../lib/storage'

type Options = {
  /** When true, prefer localStorage drafts (editor). Public page loads live data only. */
  useDrafts?: boolean
}

export function useSiteData(options: Options = {}) {
  const useDrafts = options.useDrafts ?? false
  const [data, setData] = useState<SiteData>(() =>
    useDrafts ? loadDraftData() : defaultSiteData,
  )
  const [loading, setLoading] = useState(!(useDrafts && hasDraftData()))
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (useDrafts && hasDraftData()) {
        setLoading(false)
        return
      }

      try {
        const live = await fetchSiteData()
        if (cancelled) return
        setData(live)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (!useDrafts) {
          setError(err instanceof Error ? err.message : 'Failed to load cards')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [useDrafts])

  useEffect(() => {
    if (useDrafts && dirty) {
      saveSiteData(data)
    }
  }, [data, dirty, useDrafts])

  const update = useCallback((updater: (prev: SiteData) => SiteData) => {
    setData((prev) => updater(prev))
    setDirty(true)
  }, [])

  const replace = useCallback((next: SiteData) => {
    setData(next)
    setDirty(true)
  }, [])

  const reloadLive = useCallback(async () => {
    const live = await fetchSiteData()
    setData(live)
    setDirty(false)
    clearDraftData()
    setError(null)
    return live
  }, [])

  return { data, update, replace, dirty, setDirty, loading, error, reloadLive }
}
