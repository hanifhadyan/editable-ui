'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useEditableContext } from '../EditableContext'
import { EditIcon } from './EditIcon'

interface EditableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  contentKey: string
  defaultSrc?: string
}

export function EditableImage({
  contentKey,
  defaultSrc = '',
  className,
  style,
  alt,
  ...props
}: EditableImageProps) {
  const { isAdmin, content, setContent, uploadImage } = useEditableContext()
  const [isHovered, setIsHovered] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLSpanElement>(null)

  // Detect cursor already inside on mount
  useEffect(() => {
    if (isAdmin && containerRef.current?.matches(':hover')) setIsHovered(true)
  }, [isAdmin])

  const src = content[contentKey]?.value ?? defaultSrc

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const url = await uploadImage(file)
      await setContent(contentKey, url, 'image')
    } finally {
      setIsUploading(false)
      setShowModal(false)
    }
  }

  const handleUrlSave = async () => {
    if (!urlInput.trim()) return
    await setContent(contentKey, urlInput.trim(), 'image')
    setUrlInput('')
    setShowModal(false)
  }

  return (
    <span
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={() => isAdmin && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, opacity: isUploading ? 0.5 : 1 }}
        {...props}
      />
      {isAdmin && isHovered && !showModal && (
        <EditIcon onClick={() => setShowModal(true)} />
      )}
      {showModal && (
        <div style={modalStyle}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Change image</p>
          <button onClick={() => fileRef.current?.click()} style={btnStyle}>
            Upload file
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <div style={{ margin: '8px 0', textAlign: 'center', color: '#999' }}>or</div>
          <input
            type="url"
            placeholder="Paste image URL"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleUrlSave} style={btnStyle}>Save URL</button>
            <button onClick={() => setShowModal(false)} style={{ ...btnStyle, background: '#eee', color: '#333' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </span>
  )
}

const modalStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 9999,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  minWidth: 260,
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#000',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14,
  boxSizing: 'border-box',
}
