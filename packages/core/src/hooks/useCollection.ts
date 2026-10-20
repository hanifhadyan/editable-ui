'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
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

  const items = useMemo(() => parseItems(itemsRaw), [itemsRaw])
  const schema = useMemo(() => parseSchema(schemaRaw, schemaFallback), [schemaRaw, schemaFallback])
  const latestItems = useRef(items)
  const confirmedItems = useRef(items)
  const pendingCount = useRef(0)
  const pendingWrite = useRef(Promise.resolve())

  useEffect(() => {
    if (pendingCount.current === 0) {
      latestItems.current = items
      confirmedItems.current = items
    }
  }, [items, itemsRaw])

  const saveItems = useCallback(
    (next: CollectionItem[]) => setContent(contentKey, JSON.stringify(next), 'collection', schema),
    [contentKey, schema, setContent]
  )

  const saveSchema = useCallback(
    (next: CollectionField[]) =>
      setContent(`${contentKey}.__schema`, JSON.stringify(next), 'collection-schema'),
    [contentKey, setContent]
  )

  const updateItems = useCallback((change: (current: CollectionItem[]) => CollectionItem[]) => {
    const next = change(latestItems.current)
    if (next === latestItems.current) return Promise.resolve()
    latestItems.current = next
    pendingCount.current++
    const write = pendingWrite.current.then(() => saveItems(next))
    const result = write.then(() => {
      confirmedItems.current = next
    }, error => {
      if (latestItems.current === next) latestItems.current = confirmedItems.current
      throw error
    }).finally(() => { pendingCount.current-- })
    pendingWrite.current = result.catch(() => {})
    return result
  }, [saveItems])

  const addItem = useCallback(() => {
    const blank: CollectionItem = { id: crypto.randomUUID() }
    schema.forEach(f => { blank[f.field] = '' })
    return updateItems(current => [...current, blank])
  }, [schema, updateItems])

  const updateItem = useCallback(
    (id: string, fieldOrPatch: string | Record<string, string>, value?: string) => {
      const patch = typeof fieldOrPatch === 'string' ? { [fieldOrPatch]: value ?? '' } : fieldOrPatch
      return updateItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
    },
    [updateItems]
  )

  const deleteItem = useCallback(
    (id: string) => updateItems(current => current.filter(item => item.id !== id)),
    [updateItems]
  )

  const updateSchema = useCallback(
    (next: CollectionField[]) => saveSchema(next),
    [saveSchema]
  )

  return { items, schema, isAdmin, addItem, updateItem, deleteItem, updateSchema }
}
