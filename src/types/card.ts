export type IconColor = 'blue' | 'green' | 'orange' | 'amber' | 'cyan'

export interface Card {
  id: string
  title: string
  description: string
  url: string
  icon: string
  iconColor: IconColor
  badge: string | null
  order: number
  published: boolean
}

export interface SiteConfig {
  title: string
  tagline: string
  footer: string
}

export interface SiteData {
  site: SiteConfig
  cards: Card[]
}

export const ICON_COLORS: IconColor[] = ['blue', 'green', 'orange', 'amber', 'cyan']

export const ICON_COLOR_CLASSES: Record<IconColor, string> = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  orange: 'text-orange-600',
  amber: 'text-amber-600',
  cyan: 'text-cyan-600',
}

export const POPULAR_ICONS = [
  'heart',
  'notebook-tabs',
  'palette',
  'spline-pointer',
  'sun',
  'house',
  'landmark',
  'mountain',
  'trees',
  'chart-area',
  'shell',
  'rotate-cw',
  'earth',
  'baby',
  'piggy-bank',
  'beer',
  'tram-front',
  'book-heart',
  'refrigerator',
  'globe',
  'camera',
  'music',
  'book',
  'code',
  'link',
  'star',
  'map',
  'compass',
  'calendar',
  'mail',
] as const
