import { Link } from 'react-router-dom'
import { CardGrid } from '../components/CardGrid'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useSiteData } from '../hooks/useSiteData'

export function LaunchPage() {
  const { data } = useSiteData()

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans">
      <SiteHeader site={data.site} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
        <CardGrid cards={data.cards} />
      </main>

      <SiteFooter text={data.site.footer} />

      <Link
        to="/admin"
        className="fixed bottom-4 right-4 rounded-full bg-gray-800/80 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-gray-800 hover:text-white"
      >
        Edit
      </Link>
    </div>
  )
}
