import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import type { Card } from '../types/card'
import { getIcon } from '../lib/icons'
import { ICON_COLOR_CLASSES } from '../types/card'

interface EditorCardRowProps {
  card: Card
  onEdit: () => void
  onDelete: () => void
}

export function EditorCardRow({ card, onEdit, onDelete }: EditorCardRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  })

  const Icon = getIcon(card.icon)
  const colorClass = ICON_COLOR_CLASSES[card.iconColor]

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border bg-white p-3 shadow-sm ${
        card.published ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <Icon className={`h-5 w-5 shrink-0 ${colorClass}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-800">{card.title}</p>
        <p className="truncate text-xs text-gray-500">{card.url}</p>
      </div>

      {!card.published && (
        <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Hidden</span>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="rounded p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
        aria-label="Edit card"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="rounded p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
        aria-label="Delete card"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
