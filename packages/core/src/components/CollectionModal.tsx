'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CollectionItem, CollectionField } from '../types'
import { useEditableContext } from '../EditableContext'

interface CollectionModalProps {
  item: CollectionItem
  schema: CollectionField[]
  onClose: () => void
  onSave: (id: string, field: string, value: string) => void
  renderView?: (item: CollectionItem) => React.ReactNode
}

export function CollectionModal({ item, schema, onClose, onSave, renderView }: CollectionModalProps) {
  const { isAdmin, uploadImage } = useEditableContext()
  const [mode, setMode] = useState<'view' | 'edit'>(isAdmin ? 'edit' : 'view')
  const [draft, setDraft] = useState<CollectionItem>({ ...item })
  const overlayRef = useRef<HTMLDivElement>(null)

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const save = () => {
    Object.entries(draft).forEach(([field, value]) => {
      if (field !== 'id' && value !== item[field]) {
        onSave(item.id, field, value as string)
      }
    })
    onClose()
  }

  const handleImageUpload = async (field: string, file: File) => {
    const url = await uploadImage(file)
    setDraft(prev => ({ ...prev, [field]: url }))
  }

  const modal = (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={overlayStyle}
    >
      <div style={modalStyle}>
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
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
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
                <label style={labelStyle}>{f.label}</label>

                {(!f.type || f.type === 'text') && (
                  <input
                    value={draft[f.field] ?? ''}
                    onChange={e => setDraft(prev => ({ ...prev, [f.field]: e.target.value }))}
                    style={inputStyle}
                  />
                )}

                {f.type === 'richtext' && (
                  <textarea
                    value={draft[f.field] ?? ''}
                    rows={4}
                    onChange={e => setDraft(prev => ({ ...prev, [f.field]: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                )}

                {f.type === 'select' && f.options && (
                  <select
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
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(f.field, file)
                          }}
                        />
                      </label>
                      <input
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
              <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
              <button onClick={save} style={saveBtnStyle}>Save</button>
            </div>
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
