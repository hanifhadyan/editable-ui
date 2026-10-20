'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { EditableContextValue, EditableConfig, ContentRecord, ContentType } from './types'
import { MAX_UPLOAD_SIZE } from './types'
import { sanitizeRichText } from './sanitize'

const EditableContext = createContext<EditableContextValue | null>(null)
const EMPTY_CONTENT: ContentRecord = {}

interface EditableProviderProps extends EditableConfig {
  children: React.ReactNode
  initialContent?: ContentRecord
}

export function EditableProvider({
  children,
  isAdmin,
  initialContent = EMPTY_CONTENT,
}: EditableProviderProps) {
  const [content, setContentState] = useState<ContentRecord>(() => sanitizeContentRecord(initialContent))

  useEffect(() => {
    if (!isAdmin) return

    let cancelled = false
    fetch('/api/editable/content')
      .then(async response => {
        if (!response.ok) throw new Error('Could not load editable content')
        return response.json()
      })
      .then(records => {
        if (!cancelled) setContentState(sanitizeContentRecord(records))
      })
      .catch(error => console.error('[editable-ui] Failed to load content', error))

    return () => { cancelled = true }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) setContentState(sanitizeContentRecord(initialContent))
  }, [isAdmin, initialContent])

  const setContent = useCallback(
    async (key: string, value: string, type: ContentType) => {
      const safeValue = type === 'richtext' ? sanitizeRichText(value) : value
      const response = await fetch('/api/editable/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: safeValue, type }),
      })
      if (!response.ok) throw new Error('Could not save editable content')
      setContentState(prev => ({
        ...prev,
        [key]: { value: safeValue, type, updatedAt: new Date().toISOString() },
      }))
    },
    []
  )

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (file.size > MAX_UPLOAD_SIZE) throw new Error('Images must be 10 MiB or smaller')
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '')
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const response = await fetch('/api/editable/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: encoded }),
      })
      if (!response.ok) throw new Error('Could not upload image')
      const result = await response.json()
      if (typeof result.url !== 'string') throw new Error('Invalid upload response')
      return result.url
    },
    []
  )

  return (
    <EditableContext.Provider value={{ isAdmin, content, setContent, uploadImage }}>
      {children}
    </EditableContext.Provider>
  )
}

function sanitizeContentRecord(records: ContentRecord | null | undefined): ContentRecord {
  if (!records || typeof records !== 'object') return {}
  return Object.fromEntries(Object.entries(records).map(([key, entry]) => [
    key,
    entry?.type === 'richtext' && typeof entry.value === 'string'
      ? { ...entry, value: sanitizeRichText(entry.value) }
      : entry,
  ])) as ContentRecord
}

export function useEditableContext(): EditableContextValue {
  const ctx = useContext(EditableContext)
  if (!ctx) throw new Error('useEditableContext must be used inside EditableProvider')
  return ctx
}
