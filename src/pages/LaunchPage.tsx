import { CardGrid } from '../components/CardGrid'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useSiteData } from '../hooks/useSiteData'

export function LaunchPage() {
  const { data, loading, error } = useSiteData({ useDrafts: false })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-center text-sm text-red-600">
        {error}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans">
      <SiteHeader site={data.site} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
        <CardGrid cards={data.cards} />
      </main>

      <SiteFooter text={data.site.footer} />
    </div>
  )
}
