'use client'

import React, { useRef, useState, useCallback } from 'react'
import { useEditableContext } from '../EditableContext'
import { EditIcon } from './EditIcon'

interface EditableTextProps extends React.HTMLAttributes<HTMLElement> {
  contentKey: string
  as?: keyof JSX.IntrinsicElements
  defaultValue?: string
}

export function EditableText({
  contentKey,
  as: Tag = 'p',
  defaultValue = '',
  className,
  style,
  ...props
}: EditableTextProps) {
  const { isAdmin, content, setContent } = useEditableContext()
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const ref = useRef<HTMLElement>(null)

  const value = content[contentKey]?.value ?? defaultValue

  const startEdit = useCallback(() => {
    if (!isAdmin) return
    setIsEditing(true)
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus()
        const range = document.createRange()
        range.selectNodeContents(ref.current)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }, 0)
  }, [isAdmin])

  const save = useCallback(() => {
    setIsEditing(false)
    const newValue = ref.current?.innerText ?? ''
    if (newValue !== value) {
      setContent(contentKey, newValue, 'text')
    }
  }, [contentKey, value, setContent])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ref.current) ref.current.innerText = value
        setIsEditing(false)
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        save()
      }
    },
    [save, value]
  )

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => isAdmin && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {React.createElement(Tag, {
        ref,
        className,
        style,
        contentEditable: isEditing ? true : undefined,
        suppressContentEditableWarning: true,
        onBlur: isEditing ? save : undefined,
        onKeyDown: isEditing ? onKeyDown : undefined,
        dangerouslySetInnerHTML: !isEditing ? { __html: value } : undefined,
        ...(!isEditing ? props : {}),
      })}
      {isAdmin && isHovered && !isEditing && (
        <EditIcon onClick={startEdit} />
      )}
    </span>
  )
}
