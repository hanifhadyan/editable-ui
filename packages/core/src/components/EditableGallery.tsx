'use client'

import React, { useRef, useState } from 'react'
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
import { useGallery } from '../hooks/useGallery'
import type { GalleryImage } from '../types'

interface EditableGalleryProps {
  contentKey: string
  /** className for the grid/container wrapper */
  className?: string
  /** className applied to each image element (when no renderImage provided) */
  imageClassName?: string
  /** Custom render per image — you control markup. Plugin wraps with drag + delete for admin. */
  renderImage?: (image: GalleryImage) => React.ReactNode
}

export function EditableGallery({
  contentKey,
  className,
  imageClassName = 'w-full h-full object-cover',
  renderImage,
}: EditableGalleryProps) {
  const { images, isAdmin, addImages, removeImage, reorder } = useGallery(contentKey)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(false)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = images.findIndex(img => img.id === active.id)
    const to   = images.findIndex(img => img.id === over.id)
    if (from !== -1 && to !== -1) reorder(from, to)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addImages(files)
    e.target.value = ''
  }

  const grid = (
    <div className={className} style={className ? undefined : defaultGridStyle}>
      {images.map(img => (
        <SortableImage
          key={img.id}
          image={img}
          isAdmin={isAdmin}
          onRemove={() => removeImage(img.id)}
          renderImage={renderImage}
          imageClassName={imageClassName}
        />
      ))}

      {/* add button — admin only */}
      {isAdmin && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={addBtnStyle}
          title="Add images"
        >
          <span style={{ fontSize: 28, lineHeight: 1, color: '#bbb' }}>+</span>
          <span style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Add images</span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )

  if (!isAdmin) return grid

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={images.map(img => img.id)} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  )
}

// ─── Sortable Image Item ─────────────────────────────────────────────────────

function SortableImage({
  image,
  isAdmin,
  onRemove,
  renderImage,
  imageClassName,
}: {
  image: GalleryImage
  isAdmin: boolean
  onRemove: () => void
  renderImage?: (image: GalleryImage) => React.ReactNode
  imageClassName: string
}) {
  const [hovered, setHovered] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    cursor: isAdmin ? 'grab' : 'default',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => isAdmin && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...(isAdmin ? { ...attributes, ...listeners } : {})}
    >
      {/* image content */}
      {renderImage
        ? renderImage(image)
        : <img src={image.src} alt={image.alt ?? ''} className={imageClassName} />
      }

      {/* admin overlays */}
      {isAdmin && hovered && !isDragging && (
        <>
          {/* drag hint */}
          <div style={dragHintStyle} title="Drag to reorder">⠿</div>

          {/* delete */}
          <button
            onPointerDown={e => e.stopPropagation()} // prevent drag on delete click
            onClick={e => { e.stopPropagation(); onRemove() }}
            style={deleteBtnStyle}
            title="Remove image"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const defaultGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
}

const addBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px dashed #ddd',
  borderRadius: 8,
  background: 'none',
  cursor: 'pointer',
  aspectRatio: '1',
  minHeight: 120,
}

const dragHintStyle: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  left: 6,
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 14,
  lineHeight: 1.4,
  pointerEvents: 'none',
  userSelect: 'none',
}

const deleteBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: 26,
  height: 26,
  cursor: 'pointer',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}
