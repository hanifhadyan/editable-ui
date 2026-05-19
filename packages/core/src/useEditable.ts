'use client'

import { useEditableContext } from './EditableContext'
import type { ContentType } from './types'

export function useEditable(contentKey: string, defaultValue = '') {
  const { isAdmin, content, setContent } = useEditableContext()

  const entry = content[contentKey]
  const value = entry?.value ?? defaultValue

  const save = (newValue: string, type: ContentType = 'text') =>
    setContent(contentKey, newValue, type)

  return { value, isAdmin, save }
}
