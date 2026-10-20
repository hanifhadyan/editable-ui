'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useEditableContext } from '../EditableContext'
import { FloatingEditBar } from './FloatingEditBar'

type EditState = 'idle' | 'editing' | 'preview'

interface EditableTextProps {
  contentKey: string
  defaultValue?: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
  /** Allow Enter key to insert newline (default: false) */
  multiline?: boolean
}

export function EditableText({
  contentKey,
  defaultValue = '',
  as: Tag = 'span',
  className,
  style,
  multiline = false,
}: EditableTextProps) {
  const { isAdmin, content, setContent } = useEditableContext()
  const savedValue = content[contentKey]?.value ?? defaultValue

  const [state, setState] = useState<EditState>('idle')
  const [draft, setDraft] = useState(savedValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLElement>(null)

  // Sync external value changes when idle
  useEffect(() => {
    if (state === 'idle') setDraft(savedValue)
  }, [savedValue]) // eslint-disable-line react-hooks/exhaustive-deps

  // Set content + focus when entering edit mode
  useEffect(() => {
    if (state !== 'editing' || !ref.current) return
    ref.current.innerText = draft
    ref.current.focus()
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(ref.current)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const captureDraft = () => ref.current?.innerText ?? draft

  const handlePreview = useCallback(() => {
    setDraft(captureDraft())
    setState('preview')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    const text = state === 'editing' ? captureDraft() : draft
    setSaving(true)
    setDraft(text)
    setError('')
    try {
      await setContent(contentKey, text, 'text')
      setState('idle')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save text')
    } finally {
      setSaving(false)
    }
  }, [state, draft, contentKey, setContent]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = useCallback(() => {
    setDraft(savedValue)
    setError('')
    setState('idle')
  }, [savedValue])

  // Non-admin: plain render
  if (!isAdmin) {
    const El = Tag as React.ElementType
    return <El className={className} style={style}>{savedValue}</El>
  }

  return (
    <>
      {(state === 'editing' || state === 'preview') && (
        <FloatingEditBar
          label={contentKey}
          isPreview={state === 'preview'}
          onEdit={() => setState('editing')}
          onPreview={handlePreview}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
          error={error}
        />
      )}

      <div
        style={{ position: 'relative', width: '100%' }}
      >
        {state === 'idle' && (
          <>
            {React.createElement(Tag as string, { className, style }, savedValue || defaultValue)}
            <button type="button" onClick={() => setState('editing')} style={editBtnStyle} aria-label={`Edit ${contentKey}`}>
              ✏ Edit
            </button>
          </>
        )}

        {state === 'editing' &&
          React.createElement(Tag as string, {
            ref,
            className,
            style: {
              ...style,
              display: 'block',
              outline: '2px solid #111',
              borderRadius: 2,
              minWidth: 40,
              padding: '0 2px',
              width: '100%',
              boxSizing: 'border-box',
            } as React.CSSProperties,
            contentEditable: true,
            suppressContentEditableWarning: true,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (!multiline && e.key === 'Enter') e.preventDefault()
              if (e.key === 'Escape') handleCancel()
            },
          })
        }

        {state === 'preview' &&
          React.createElement(Tag as string, {
            className,
            style: {
              ...style,
              outline: '1.5px dashed rgba(0,0,0,0.25)',
              borderRadius: 2,
              padding: '0 2px',
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
            } as React.CSSProperties,
          }, draft)
        }
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
