import { useState } from 'react'
import type { Card, IconColor } from '../types/card'
import { ICON_COLORS, POPULAR_ICONS } from '../types/card'
import { getIcon } from '../lib/icons'
import { sanitizeUrl } from '../lib/security'

const BADGE_PRESETS = ['Password Protected', 'In Progress', 'Beta', 'Design'] as const

interface CardFormProps {
  card: Card
  onSave: (card: Card) => void
  onCancel: () => void
}

export function CardForm({ card, onSave, onCancel }: CardFormProps) {
  const [draft, setDraft] = useState<Card>({ ...card })

  const Icon = getIcon(draft.icon)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const safeUrl = sanitizeUrl(draft.url)
    if (!safeUrl) {
      alert('URL must start with http:// or https://')
      return
    }
    onSave({ ...draft, url: safeUrl })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
          <input
            type="text"
            required
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700">URL</span>
          <input
            type="url"
            required
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
          <textarea
            required
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Icon</span>
          <select
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {POPULAR_ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Icon color</span>
          <select
            value={draft.iconColor}
            onChange={(e) => setDraft({ ...draft, iconColor: e.target.value as IconColor })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ICON_COLORS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700">Badge (optional)</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft.badge ?? ''}
              onChange={(e) => setDraft({ ...draft, badge: e.target.value || null })}
              placeholder="e.g. Password Protected"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              onChange={(e) => {
                if (e.target.value) setDraft({ ...draft, badge: e.target.value })
              }}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-600"
              defaultValue=""
            >
              <option value="">Presets</option>
              {BADGE_PRESETS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Published (visible on launch page)</span>
        </label>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-white p-3">
        <Icon className="h-5 w-5 text-blue-600" />
        <span className="text-sm text-gray-600">Preview: {draft.title}</span>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save card
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function createEmptyCard(order: number): Card {
  return {
    id: `card-${Date.now()}`,
    title: 'New Card',
    description: 'Description here',
    url: 'https://',
    icon: 'link',
    iconColor: 'blue',
    badge: null,
    order,
    published: true,
  }
}
