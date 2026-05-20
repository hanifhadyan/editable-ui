'use client'

import { useCallback } from 'react'
import { useEditableContext } from '../EditableContext'
import type { CollectionItem, CollectionField } from '../types'

function parseItems(raw: string | undefined): CollectionItem[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function parseSchema(raw: string | undefined, fallback: CollectionField[]): CollectionField[] {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

export function useCollection(contentKey: string, schemaFallback: CollectionField[]) {
  const { isAdmin, content, setContent } = useEditableContext()

  const itemsRaw = content[contentKey]?.value
  const schemaRaw = content[`${contentKey}.__schema`]?.value

  const items = parseItems(itemsRaw)
  const schema = parseSchema(schemaRaw, schemaFallback)

  const saveItems = useCallback(
    (next: CollectionItem[]) => setContent(contentKey, JSON.stringify(next), 'collection'),
    [contentKey, setContent]
  )

  const saveSchema = useCallback(
    (next: CollectionField[]) =>
      setContent(`${contentKey}.__schema`, JSON.stringify(next), 'collection-schema'),
    [contentKey, setContent]
  )

  const addItem = useCallback(() => {
    const blank: CollectionItem = { id: crypto.randomUUID() }
    schema.forEach(f => { blank[f.field] = '' })
    saveItems([...items, blank])
  }, [items, schema, saveItems])

  const updateItem = useCallback(
    (id: string, field: string, value: string) => {
      saveItems(items.map(item => item.id === id ? { ...item, [field]: value } : item))
    },
    [items, saveItems]
  )

  const deleteItem = useCallback(
    (id: string) => saveItems(items.filter(item => item.id !== id)),
    [items, saveItems]
  )

  const updateSchema = useCallback(
    (next: CollectionField[]) => saveSchema(next),
    [saveSchema]
  )

  return { items, schema, isAdmin, addItem, updateItem, deleteItem, updateSchema }
}
