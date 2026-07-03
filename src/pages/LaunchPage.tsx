import { Link } from 'react-router-dom'
import { CardGrid } from '../components/CardGrid'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useSiteData } from '../hooks/useSiteData'
import { isAdminAuthenticated, isAdminProtectionEnabled } from '../lib/adminAuth'

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

      {(!isAdminProtectionEnabled() || isAdminAuthenticated()) && (
        <Link
          to="/admin"
          className="fixed bottom-4 right-4 rounded-full bg-gray-800/80 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-gray-800 hover:text-white"
        >
          Edit
        </Link>
      )}
    </div>
  )
}
