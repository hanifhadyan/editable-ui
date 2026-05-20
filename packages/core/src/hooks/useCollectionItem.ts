'use client'

import { useEditableContext } from '../EditableContext'
import type { CollectionItem } from '../types'

function parseItems(raw: string | undefined): CollectionItem[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export function useCollectionItem(contentKey: string, itemId: string): CollectionItem | null {
  const { content } = useEditableContext()
  const items = parseItems(content[contentKey]?.value)
  return items.find(i => i.id === itemId) ?? null
}
