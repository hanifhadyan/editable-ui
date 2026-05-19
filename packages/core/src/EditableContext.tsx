'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { EditableContextValue, EditableConfig, ContentRecord, ContentType } from './types'

const EditableContext = createContext<EditableContextValue | null>(null)

interface EditableProviderProps extends EditableConfig {
  children: React.ReactNode
  initialContent?: ContentRecord
}

export function EditableProvider({
  children,
  isAdmin,
  adapter,
  storage,
  initialContent = {},
}: EditableProviderProps) {
  const [content, setContentState] = useState<ContentRecord>(initialContent)

  useEffect(() => {
    if (!adapter) return
    adapter.initialize().then(() => {
      adapter.getAll().then(setContentState)
    })
  }, [adapter])

  const setContent = useCallback(
    async (key: string, value: string, type: ContentType) => {
      const entry = { value, type, updatedAt: new Date().toISOString() }
      setContentState(prev => ({ ...prev, [key]: entry }))
      if (adapter) {
        await adapter.set(key, value, type)
      }
    },
    [adapter]
  )

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!storage) {
        throw new Error('No storage adapter configured')
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      return storage.upload(buffer, file.name, file.type)
    },
    [storage]
  )

  return (
    <EditableContext.Provider value={{ isAdmin, content, setContent, uploadImage }}>
      {children}
    </EditableContext.Provider>
  )
}

export function useEditableContext(): EditableContextValue {
  const ctx = useContext(EditableContext)
  if (!ctx) throw new Error('useEditableContext must be used inside EditableProvider')
  return ctx
}
