'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditableContext } from '../EditableContext'
import { FloatingEditBar } from './FloatingEditBar'
import type { GalleryImage } from '../types'

type EditState = 'idle' | 'editing' | 'preview'

function parseImages(raw: string | undefined): GalleryImage[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

interface EditableGalleryProps {
  contentKey: string
  /**
   * Custom viewer rendered in idle + preview states.
   * Receives the current image array. Fully replaces the default grid in those states.
   * In editing state this is hidden and replaced by the sortable edit grid.
   */
  renderViewer?: (images: GalleryImage[]) => React.ReactNode
  /** Per-image renderer inside the editing grid (drag/delete controls wrap this) */
  renderImage?: (image: GalleryImage, index: number) => React.ReactNode
  /** className for the default idle grid wrapper */
  className?: string
  /** className applied to each image when no renderImage provided */
  imageClassName?: string
  /** className applied to the editing + preview container wrapper */
  editContainerClassName?: string
  /** Number of columns in the edit grid. Default 3. */
  editGridColumns?: number
}

export function EditableGallery({
  contentKey,
  renderViewer,
  renderImage,
  className,
  imageClassName = 'w-full h-full object-cover',
  editContainerClassName,
  editGridColumns = 3,
}: EditableGalleryProps) {
  const { isAdmin, content, setContent, uploadImage } = useEditableContext()
  const savedImages = parseImages(content[contentKey]?.value)

  const [state, setState] = useState<EditState>('idle')
  const [draft, setDraft] = useState<GalleryImage[]>(savedImages)
  const [hovered, setHovered] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const idleContainerRef = useRef<HTMLDivElement>(null)

  // Detect cursor already inside on mount (page navigation mid-hover)
  useEffect(() => {
    if (state === 'idle' && idleContainerRef.current?.matches(':hover')) setHovered(true)
  }, [state])

  // Sync draft when external value changes (idle only)
  useEffect(() => {
    if (state === 'idle') setDraft(savedImages)
  }, [content[contentKey]?.value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before unload when preview has unsaved changes
  useEffect(() => {
    if (state !== 'preview') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have unsaved gallery changes. Leave anyway?'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state])

  const handleAddImages = useCallback(
    async (files: File[]) => {
      const uploaded: GalleryImage[] = await Promise.all(
        files.map(async file => ({
          id: crypto.randomUUID(),
          src: await uploadImage(file),
          alt: file.name.replace(/\.[^.]+$/, ''),
          caption: '',
        }))
      )
      setDraft(prev => [...prev, ...uploaded])
    },
    [uploadImage]
  )

  const handleRemoveImage = useCallback((id: string) => {
    setDraft(prev => prev.filter(img => img.id !== id))
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDraft(prev => {
      const from = prev.findIndex(img => img.id === active.id)
      const to = prev.findIndex(img => img.id === over.id)
      return from === -1 || to === -1 ? prev : arrayMove(prev, from, to)
    })
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await setContent(contentKey, JSON.stringify(draft), 'collection')
    setSaving(false)
    setState('idle')
  }, [contentKey, setContent, draft])

  const handleCancel = useCallback(() => {
    setDraft(savedImages)
    setState('idle')
  }, [savedImages]) // eslint-disable-line react-hooks/exhaustive-deps

  const defaultGrid = (images: GalleryImage[]) => (
    <div
      className={className}
      style={
        className
          ? undefined
          : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%' }
      }
    >
      {images.map((img, i) => (
        <div key={img.id}>
          {renderImage
            ? renderImage(img, i)
            : <img src={img.src} alt={img.alt ?? ''} className={imageClassName} />}
        </div>
      ))}
      {images.length === 0 && (
        <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', border: '1px dashed #ddd', borderRadius: 6 }}>
          <span style={{ color: '#bbb', fontFamily: 'sans-serif', fontSize: 13 }}>No images yet</span>
        </div>
      )}
    </div>
  )

  const viewer = (images: GalleryImage[]) =>
    renderViewer ? renderViewer(images) : defaultGrid(images)

  // Non-admin
  if (!isAdmin) return <>{viewer(savedImages)}</>

  // IDLE
  if (state === 'idle') {
    return (
      <div
        ref={idleContainerRef}
        style={{ position: 'relative', width: '100%' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {viewer(savedImages)}
        {hovered && (
          <button onClick={() => setState('editing')} style={editGalleryBtnStyle} title="Edit gallery images">
            ✏ Edit Gallery
          </button>
        )}
      </div>
    )
  }

  const editGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${editGridColumns}, 1fr)`,
    gap: 6,
    width: '100%',
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
        />
        <div className={editContainerClassName} style={{ position: 'relative', width: '100%' }}>
          <div style={previewLabelStyle}>👁 Preview — unsaved</div>
          {viewer(draft)}
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
        onPreview={() => setState('preview')}
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saving}
      />

      <div
        className={editContainerClassName}
        style={{ outline: '2px solid #111', borderRadius: 6, padding: 6, width: '100%', boxSizing: 'border-box' }}
      >
        <div style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#555', padding: '4px 6px 6px', letterSpacing: '0.04em' }}>
          ✏ Edit Gallery — drag to reorder · click + to add
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={draft.map(img => img.id)} strategy={rectSortingStrategy}>
            <div style={editGridStyle}>
              {draft.map((img, i) => (
                <SortableItem
                  key={img.id}
                  image={img}
                  index={i}
                  onRemove={() => handleRemoveImage(img.id)}
                  renderImage={renderImage}
                  imageClassName={imageClassName}
                />
              ))}
              <button onClick={() => fileInputRef.current?.click()} style={addBtnStyle} title="Add images">
                <span style={{ fontSize: 28, color: '#bbb', lineHeight: 1 }}>+</span>
                <span style={{ fontSize: 11, color: '#bbb', marginTop: 4, fontFamily: 'sans-serif' }}>Add images</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) handleAddImages(files)
            e.target.value = ''
          }}
        />
      </div>
    </>
  )
}

// ─── Sortable item ────────────────────────────────────────────────────────────

function SortableItem({
  image, index, onRemove, renderImage, imageClassName,
}: {
  image: GalleryImage
  index: number
  onRemove: () => void
  renderImage?: (image: GalleryImage, index: number) => React.ReactNode
  imageClassName: string
}) {
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: 'relative', cursor: 'grab' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...attributes}
      {...listeners}
    >
      {renderImage ? renderImage(image, index) : <img src={image.src} alt={image.alt ?? ''} className={imageClassName} />}
      {hovered && !isDragging && (
        <>
          <div style={dragHintStyle}>⠿</div>
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove() }} style={deleteBtnStyle} title="Remove image">✕</button>
        </>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const editGalleryBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 12, right: 12,
  background: '#111', color: '#fff', border: '1px solid #333',
  borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
  fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.04em',
  zIndex: 9998, boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
}
const previewLabelStyle: React.CSSProperties = {
  position: 'absolute', top: 12, left: 12,
  background: '#111', color: '#fff', border: '1px solid #333',
  borderRadius: 5, padding: '3px 9px', fontSize: 11,
  fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.04em',
  zIndex: 9998, pointerEvents: 'none',
}
const addBtnStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  border: '2px dashed #ddd', borderRadius: 8, background: 'none', cursor: 'pointer',
  aspectRatio: '1', minHeight: 100,
}
const dragHintStyle: React.CSSProperties = {
  position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.5)', color: '#fff',
  borderRadius: 4, padding: '2px 6px', fontSize: 14, lineHeight: 1.4,
  pointerEvents: 'none', userSelect: 'none',
}
const deleteBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff',
  border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer',
  fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
}
