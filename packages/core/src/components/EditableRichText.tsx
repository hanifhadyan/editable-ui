'use client'

import React, { useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { useEditableContext } from '../EditableContext'
import { EditIcon } from './EditIcon'
import { RichTextToolbar } from './RichTextToolbar'

interface EditableRichTextProps extends React.HTMLAttributes<HTMLDivElement> {
  contentKey: string
  as?: keyof JSX.IntrinsicElements
  defaultValue?: string
}

export function EditableRichText({
  contentKey,
  as: Tag = 'div',
  defaultValue = '',
  className,
  style,
}: EditableRichTextProps) {
  const { isAdmin, content, setContent } = useEditableContext()
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const value = content[contentKey]?.value ?? defaultValue

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    editable: isEditing,
  })

  const startEdit = useCallback(() => {
    if (!isAdmin) return
    editor?.setEditable(true)
    setIsEditing(true)
    setTimeout(() => editor?.commands.focus(), 0)
  }, [isAdmin, editor])

  const save = useCallback(() => {
    const html = editor?.getHTML() ?? ''
    setContent(contentKey, html, 'richtext')
    editor?.setEditable(false)
    setIsEditing(false)
  }, [contentKey, editor, setContent])

  const cancel = useCallback(() => {
    editor?.commands.setContent(value)
    editor?.setEditable(false)
    setIsEditing(false)
  }, [editor, value])

  if (!isEditing) {
    return (
      <span
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => isAdmin && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {React.createElement(Tag, {
          className,
          style,
          dangerouslySetInnerHTML: { __html: value },
        })}
        {isAdmin && isHovered && <EditIcon onClick={startEdit} />}
      </span>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <RichTextToolbar editor={editor} onSave={save} onCancel={cancel} />
      <EditorContent editor={editor} className={className} style={style} />
    </div>
  )
}
