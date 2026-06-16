import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Download, Eye, Plus, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardForm, createEmptyCard } from '../components/CardForm'
import { EditorCardRow } from '../components/EditorCardRow'
import { CardGrid } from '../components/CardGrid'
import { SiteHeader } from '../components/SiteHeader'
import { useSiteData } from '../hooks/useSiteData'
import { exportSiteData, resetToDefault } from '../lib/storage'
import type { Card, SiteData } from '../types/card'

export function EditorPage() {
  const { data, update, replace } = useSiteData()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sortedCards = [...data.cards].sort((a, b) => a.order - b.order)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedCards.findIndex((c) => c.id === active.id)
    const newIndex = sortedCards.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(sortedCards, oldIndex, newIndex).map((card, index) => ({
      ...card,
      order: index,
    }))

    update((prev) => ({ ...prev, cards: reordered }))
  }

  function handleSaveCard(card: Card) {
    update((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === card.id ? card : c)),
    }))
    setEditingId(null)
  }

  function handleAddCard() {
    const newCard = createEmptyCard(sortedCards.length)
    update((prev) => ({ ...prev, cards: [...prev.cards, newCard] }))
    setEditingId(newCard.id)
  }

  function handleDeleteCard(id: string) {
    if (!confirm('Delete this card?')) return
    update((prev) => {
      const remaining = prev.cards
        .filter((c) => c.id !== id)
        .sort((a, b) => a.order - b.order)
        .map((card, index) => ({ ...card, order: index }))
      return { ...prev, cards: remaining }
    })
    if (editingId === id) setEditingId(null)
  }

  function handleImport(file: File) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as SiteData
        if (!parsed.site || !Array.isArray(parsed.cards)) {
          throw new Error('Invalid format')
        }
        replace(parsed)
        setEditingId(null)
      } catch {
        alert('Could not parse cards.json — check the file format.')
      }
    })
  }

  function handleReset() {
    if (!confirm('Reset to the built-in default data? Unsaved local edits will be lost.')) return
    replace(resetToDefault())
    setEditingId(null)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Launch Page Editor</h1>
            <p className="text-xs text-gray-500">Edit cards, then export JSON and commit to Git</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Hide preview' : 'Preview'}
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={() => exportSiteData(data)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="border-b border-gray-200 bg-gray-50">
          <SiteHeader site={data.site} />
          <main className="mx-auto max-w-6xl px-4 py-8">
            <CardGrid cards={data.cards} />
          </main>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Changes are saved to your browser automatically. Click <strong>Export JSON</strong>, replace{' '}
          <code className="rounded bg-amber-100 px-1">src/data/cards.json</code>, then run{' '}
          <code className="rounded bg-amber-100 px-1">npm run build</code> to publish.
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedCards.map((card) => (
                <div key={card.id}>
                  {editingId === card.id ? (
                    <CardForm
                      card={card}
                      onSave={handleSaveCard}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <EditorCardRow
                      card={card}
                      onEdit={() => setEditingId(card.id)}
                      onDelete={() => handleDeleteCard(card.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={handleAddCard}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
        >
          <Plus className="h-5 w-5" />
          Add card
        </button>
      </div>
    </div>
  )
}
