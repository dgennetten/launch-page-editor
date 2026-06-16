import type { SiteConfig } from '../types/card'

interface SiteHeaderProps {
  site: SiteConfig
}

export function SiteHeader({ site }: SiteHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-10 text-center text-white sm:py-14 lg:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">{site.title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-base text-blue-100 sm:mt-4 sm:text-lg lg:text-xl">
        {site.tagline}
      </p>
    </header>
  )
}
