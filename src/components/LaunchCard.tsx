import type { ReactNode } from 'react'
import type { Card } from '../types/card'
import { getIcon } from '../lib/icons'
import { sanitizeUrl } from '../lib/security'
import { ICON_COLOR_CLASSES } from '../types/card'

interface LaunchCardProps {
  card: Card
  compact?: boolean
}

const cardShellClass =
  'group flex items-start gap-3 rounded-xl bg-white p-4 shadow-md transition duration-200 hover:shadow-lg active:scale-[0.99]'

function CardShell({
  href,
  className,
  children,
}: {
  href: string | null
  className: string
  children: ReactNode
}) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }

  return <div className={className}>{children}</div>
}

export function LaunchCard({ card, compact = false }: LaunchCardProps) {
  const Icon = getIcon(card.icon)
  const colorClass = ICON_COLOR_CLASSES[card.iconColor]
  const safeUrl = sanitizeUrl(card.url)

  if (compact) {
    return (
      <CardShell href={safeUrl} className={cardShellClass}>
        <div className={`mt-0.5 shrink-0 rounded-lg bg-gray-50 p-2.5 ${colorClass}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold leading-snug text-gray-800 group-hover:text-blue-600">
              {card.title}
              {card.badge && (
                <span className="ml-1.5 text-xs font-normal text-gray-400">({card.badge})</span>
              )}
            </h2>
            {safeUrl && (
              <span className="shrink-0 text-gray-300 group-hover:text-blue-400" aria-hidden>
                →
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">{card.description}</p>
        </div>
      </CardShell>
    )
  }

  return (
    <CardShell
      href={safeUrl}
      className="group flex h-full flex-col rounded-xl bg-white p-6 shadow-lg transition duration-300 hover:shadow-xl"
    >
      <div className="mb-3 flex items-center gap-3">
        <Icon className={`h-6 w-6 shrink-0 ${colorClass}`} strokeWidth={2} />
        <h2 className="text-xl font-semibold text-gray-800 group-hover:text-blue-600 lg:text-2xl">
          {card.title}
          {card.badge && (
            <span className="ml-1 text-sm font-normal text-gray-400">({card.badge})</span>
          )}
        </h2>
      </div>
      <p className="text-gray-600">{card.description}</p>
    </CardShell>
  )
}
