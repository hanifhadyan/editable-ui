'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { useEditableContext } from '../EditableContext'
import { sanitizeRichText } from '../sanitize'
import { RichTextToolbar } from './RichTextToolbar'
import { FloatingEditBar } from './FloatingEditBar'

type EditState = 'idle' | 'editing' | 'preview'

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
  const savedValue = content[contentKey]?.value ?? defaultValue
  const safeSavedValue = sanitizeRichText(savedValue)

  const [state, setState] = useState<EditState>('idle')
  const [draft, setDraft] = useState(safeSavedValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync external value when idle
  useEffect(() => {
    if (state === 'idle') setDraft(safeSavedValue)
  }, [safeSavedValue]) // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before unload when preview has unsaved changes
  useEffect(() => {
    if (state !== 'preview') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Leave anyway?'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: safeSavedValue,
    editable: state === 'editing',
  })

  // Sync editor content + editability when state changes
  useEffect(() => {
    if (!editor) return
    if (state === 'editing') {
      editor.setEditable(true)
      setTimeout(() => editor.commands.focus(), 0)
    } else {
      editor.setEditable(false)
      editor.commands.setContent(state === 'preview' ? sanitizeRichText(draft) : safeSavedValue)
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreview = useCallback(() => {
    const html = sanitizeRichText(editor?.getHTML() ?? draft)
    setDraft(html)
    editor?.setEditable(false)
    setState('preview')
  }, [editor, draft])

  const handleSave = useCallback(async () => {
    const html = sanitizeRichText(state === 'editing' ? (editor?.getHTML() ?? draft) : draft)
    setSaving(true)
    setDraft(html)
    setError('')
    try {
      await setContent(contentKey, html, 'richtext')
      editor?.setEditable(false)
      setState('idle')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save rich text')
    } finally {
      setSaving(false)
    }
  }, [state, editor, draft, contentKey, setContent])

  const handleCancel = useCallback(() => {
    editor?.commands.setContent(safeSavedValue)
    editor?.setEditable(false)
    setDraft(safeSavedValue)
    setError('')
    setState('idle')
  }, [editor, safeSavedValue])

  // Non-admin
  if (!isAdmin) {
    return React.createElement(Tag as string, {
      className,
      style,
      dangerouslySetInnerHTML: { __html: safeSavedValue },
    })
  }

  // IDLE
  if (state === 'idle') {
    return (
      <div
        style={{ position: 'relative', width: '100%' }}
      >
        {React.createElement(Tag as string, {
          className,
          style,
          dangerouslySetInnerHTML: { __html: safeSavedValue },
        })}
        <button type="button" onClick={() => setState('editing')} style={editBtnStyle} aria-label={`Edit ${contentKey}`}>
          ✏ Edit
        </button>
      </div>
    )
  }

  // PREVIEW
  if (state === 'preview') {
    return (
      <>
        <FloatingEditBar
          label={contentKey}
          isPreview
          onEdit={() => setState('editing')}
          onPreview={() => {}}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
          error={error}
        />
        <div style={{ position: 'relative', width: '100%' }}>
          <div style={previewLabelStyle}>👁 Preview — unsaved</div>
          {React.createElement(Tag as string, {
            className,
            style: {
              ...style,
              outline: '1.5px dashed rgba(0,0,0,0.25)',
              borderRadius: 2,
              padding: '0 2px',
              width: '100%',
              boxSizing: 'border-box',
            } as React.CSSProperties,
            dangerouslySetInnerHTML: { __html: sanitizeRichText(draft) },
          })}
        </div>
      </>
    )
  }

  // EDITING
  return (
    <>
      <FloatingEditBar
        label={contentKey}
        isPreview={false}
        onEdit={() => {}}
        onPreview={handlePreview}
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saving}
        error={error}
      />
      <div style={{ position: 'relative', width: '100%', outline: '2px solid #111', borderRadius: 2, boxSizing: 'border-box' }}>
        <RichTextToolbar editor={editor} onSave={handleSave} onCancel={handleCancel} />
        <EditorContent editor={editor} className={className} style={{ ...style, width: '100%' }} />
      </div>
    </>
  )
}

const editBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: -30,
  right: 0,
  background: '#111',
  color: '#fff',
  border: '1px solid #333',
  borderRadius: 6,
  padding: '3px 9px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'sans-serif',
  fontWeight: 600,
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  zIndex: 9998,
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
}

const previewLabelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  background: '#111',
  color: '#fff',
  border: '1px solid #333',
  borderRadius: 5,
  padding: '3px 9px',
  fontSize: 11,
  fontFamily: 'sans-serif',
  fontWeight: 600,
  letterSpacing: '0.04em',
  zIndex: 9998,
  pointerEvents: 'none',
}
