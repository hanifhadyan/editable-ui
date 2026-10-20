'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CollectionItem, CollectionField } from '../types'
import { useEditableContext } from '../EditableContext'

interface CollectionModalProps {
  item: CollectionItem
  schema: CollectionField[]
  onClose: () => void
  onSave: (id: string, patch: Record<string, string>) => Promise<void> | void
  renderView?: (item: CollectionItem) => React.ReactNode
}

export function CollectionModal({ item, schema, onClose, onSave, renderView }: CollectionModalProps) {
  const { isAdmin, uploadImage, deleteImage } = useEditableContext()
  const [mode, setMode] = useState<'view' | 'edit'>(isAdmin ? 'edit' : 'view')
  const [draft, setDraft] = useState<CollectionItem>({ ...item })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const pendingUploads = useRef(new Set<string>())
  const uploadGeneration = useRef(0)

  const close = useCallback(() => {
    if (saving || uploading) return
    uploadGeneration.current++
    for (const url of pendingUploads.current) void deleteImage(url).catch(() => {})
    pendingUploads.current.clear()
    onClose()
  }, [deleteImage, onClose, saving, uploading])

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => () => {
    uploadGeneration.current++
    for (const url of pendingUploads.current) void deleteImage(url).catch(() => {})
    pendingUploads.current.clear()
  }, [deleteImage])

  const save = async () => {
    const patch = Object.fromEntries(Object.entries(draft).filter(
      ([field, value]) => field !== 'id' && value !== item[field]
    )) as Record<string, string>
    if (Object.keys(patch).length === 0) return close()

    setSaving(true)
    setError('')
    try {
      await onSave(item.id, patch)
      const retained = new Set(Object.values(draft))
      await Promise.allSettled([...pendingUploads.current]
        .filter(url => !retained.has(url))
        .map(url => deleteImage(url)))
      pendingUploads.current.clear()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this item')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (field: string, file: File) => {
    const generation = uploadGeneration.current
    setUploading(true)
    setError('')
    try {
      const url = await uploadImage(file)
      if (generation !== uploadGeneration.current) {
        await deleteImage(url).catch(() => {})
        return
      }
      pendingUploads.current.add(url)
      setDraft(prev => ({ ...prev, [field]: url }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload image')
    } finally {
      setUploading(false)
    }
  }

  const modal = (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) close() }}
      style={overlayStyle}
    >
      <div role="dialog" aria-modal="true" aria-label="Collection item" style={modalStyle}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {renderView && (
              <TabBtn active={mode === 'view'} onClick={() => setMode('view')}>View</TabBtn>
            )}
            {isAdmin && (
              <TabBtn active={mode === 'edit'} onClick={() => setMode('edit')}>Edit</TabBtn>
            )}
          </div>
          <button onClick={close} disabled={saving || uploading} aria-label="Close collection item" style={closeBtnStyle}>✕</button>
        </div>

        {/* view mode — user's render prop */}
        {mode === 'view' && renderView && (
          <div>{renderView(item)}</div>
        )}

        {/* edit mode — auto-generated form */}
        {mode === 'edit' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {schema.map(f => (
              <div key={f.field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor={`collection-${f.field}`} style={labelStyle}>{f.label}</label>

                {(!f.type || f.type === 'text') && (
                  <input
                    id={`collection-${f.field}`}
                    value={draft[f.field] ?? ''}
                    onChange={e => setDraft(prev => ({ ...prev, [f.field]: e.target.value }))}
                    style={inputStyle}
                  />
                )}

                {f.type === 'richtext' && (
                  <textarea
                    id={`collection-${f.field}`}
                    value={draft[f.field] ?? ''}
                    rows={4}
                    onChange={e => setDraft(prev => ({ ...prev, [f.field]: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                )}

                {f.type === 'select' && f.options && (
                  <select
                    id={`collection-${f.field}`}
                    value={draft[f.field] ?? ''}
                    onChange={e => setDraft(prev => ({ ...prev, [f.field]: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">— select —</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}

                {f.type === 'image' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {draft[f.field] && (
                      <img
                        src={draft[f.field]}
                        alt={f.label}
                        style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6 }}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ ...inputStyle, cursor: 'pointer', textAlign: 'center', padding: '6px 12px' }}>
                        Upload
                        <input
                          aria-label={`${f.label} upload`}
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          style={{ display: 'none' }}
                          disabled={saving || uploading}
                          onChange={e => {
                            const file = e.target.files?.[0]
                              if (file) void handleImageUpload(f.field, file)
                              e.target.value = ''
                          }}
                        />
                      </label>
                      <input
                        id={`collection-${f.field}`}
                        aria-label={`${f.label} URL`}
                        placeholder="or paste URL"
                        value={draft[f.field] ?? ''}
                        onChange={e => setDraft(prev => ({ ...prev, [f.field]: e.target.value }))}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={close} disabled={saving || uploading} style={cancelBtnStyle}>Cancel</button>
              <button onClick={save} disabled={saving || uploading} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
            {error && <p role="alert" style={{ color: '#b00020', margin: '12px 0 0' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  )

  return typeof window !== 'undefined' ? createPortal(modal, document.body) : null
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 14px',
        borderRadius: 6,
        border: '1px solid #ddd',
        background: active ? '#000' : '#fff',
        color: active ? '#fff' : '#333',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 99999,
  backdropFilter: 'blur(2px)',
}

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 28,
  width: '90%',
  maxWidth: 560,
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#666',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#000',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#eee',
  color: '#333',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 18,
  cursor: 'pointer',
  color: '#999',
  padding: '0 4px',
  lineHeight: 1,
}
