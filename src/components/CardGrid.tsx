import type { Card } from '../types/card'
import { LaunchCard } from './LaunchCard'

interface CardGridProps {
  cards: Card[]
}

export function CardGrid({ cards }: CardGridProps) {
  const published = cards
    .filter((c) => c.published)
    .sort((a, b) => a.order - b.order)

  return (
    <>
      {/* Mobile: compact list */}
      <div className="flex flex-col gap-3 md:hidden">
        {published.map((card) => (
          <LaunchCard key={card.id} card={card} compact />
        ))}
      </div>

      {/* Tablet/desktop: grid */}
      <div className="hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {published.map((card) => (
          <LaunchCard key={card.id} card={card} />
        ))}
      </div>
    </>
  )
}
