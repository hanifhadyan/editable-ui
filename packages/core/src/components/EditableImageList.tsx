'use client'

import React, { useEffect, useRef, useState } from 'react'
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

export interface EditableImageListProps {
  images: string[]
  files: File[]
  onImagesChange(images: string[]): void
  onFilesChange(files: File[]): void
  accept?: string
  multiple?: boolean
  className?: string
  itemClassName?: string
  imageClassName?: string
  addLabel?: string
  removeLabel?: string
  renderImage?: (src: string, index: number) => React.ReactNode
  renderFile?: (file: File, index: number, previewUrl: string) => React.ReactNode
}

export function EditableImageList({
  images,
  files,
  onImagesChange,
  onFilesChange,
  accept = 'image/*',
  multiple = true,
  className,
  itemClassName,
  imageClassName,
  addLabel = 'Add images',
  removeLabel = 'Remove image',
  renderImage,
  renderFile,
}: EditableImageListProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    const nextPreviews = files.map((file) => URL.createObjectURL(file))
    setPreviews(nextPreviews)
    return () => nextPreviews.forEach(URL.revokeObjectURL)
  }, [files])

  function addFiles(nextFiles: File[]) {
    onFilesChange(multiple ? [...files, ...nextFiles] : nextFiles.slice(0, 1))
  }

  function removeImage(index: number) {
    onImagesChange(images.filter((_, itemIndex) => itemIndex !== index))
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))
  }

  function reorder(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = images.indexOf(String(active.id))
    const to = images.indexOf(String(over.id))
    if (from !== -1 && to !== -1) onImagesChange(arrayMove(images, from, to))
  }

  return (
    <div className={className}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
        <SortableContext items={images} strategy={rectSortingStrategy}>
          <div style={gridStyle}>
            {images.map((src, index) => (
              <SortableImage
                key={src}
                src={src}
                index={index}
                itemClassName={itemClassName}
                imageClassName={imageClassName}
                removeLabel={removeLabel}
                onRemove={() => removeImage(index)}
                renderImage={renderImage}
              />
            ))}
            {files.map((file, index) => (
              <PendingImage
                key={`${file.name}-${file.lastModified}-${index}`}
                file={file}
                index={index}
                previewUrl={previews[index] || ''}
                itemClassName={itemClassName}
                imageClassName={imageClassName}
                removeLabel={removeLabel}
                onRemove={() => removeFile(index)}
                renderFile={renderFile}
              />
            ))}
            <button type="button" style={addButtonStyle} onClick={() => inputRef.current?.click()}>{addLabel}</button>
          </div>
        </SortableContext>
      </DndContext>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          addFiles(Array.from(event.target.files || []))
          event.target.value = ''
        }}
      />
    </div>
  )
}

function SortableImage({ src, index, itemClassName, imageClassName, removeLabel, onRemove, renderImage }: {
  src: string
  index: number
  itemClassName?: string
  imageClassName?: string
  removeLabel: string
  onRemove(): void
  renderImage?: (src: string, index: number) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: src })
  return (
    <div ref={setNodeRef} className={itemClassName} style={{ ...itemStyle, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} {...attributes} {...listeners}>
      {renderImage ? renderImage(src, index) : <img src={src} alt="" className={imageClassName} style={imageStyle} />}
      <button type="button" aria-label={`${removeLabel} ${index + 1}`} style={removeButtonStyle} onPointerDown={(event) => event.stopPropagation()} onClick={onRemove}>×</button>
    </div>
  )
}

function PendingImage({ file, index, previewUrl, itemClassName, imageClassName, removeLabel, onRemove, renderFile }: {
  file: File
  index: number
  previewUrl: string
  itemClassName?: string
  imageClassName?: string
  removeLabel: string
  onRemove(): void
  renderFile?: (file: File, index: number, previewUrl: string) => React.ReactNode
}) {
  return (
    <div className={itemClassName} style={itemStyle}>
      {renderFile ? renderFile(file, index, previewUrl) : <img src={previewUrl} alt="" className={imageClassName} style={imageStyle} />}
      <button type="button" aria-label={`${removeLabel} ${index + 1}`} style={removeButtonStyle} onClick={onRemove}>×</button>
    </div>
  )
}

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }
const itemStyle: React.CSSProperties = { position: 'relative', minWidth: 0, cursor: 'grab' }
const imageStyle: React.CSSProperties = { display: 'block', width: '100%', aspectRatio: '1', objectFit: 'cover' }
const addButtonStyle: React.CSSProperties = { minHeight: 110, border: '2px dashed #ddd', background: 'transparent', cursor: 'pointer' }
const removeButtonStyle: React.CSSProperties = { position: 'absolute', top: 4, right: 4, width: 24, height: 24, border: 0, borderRadius: '50%', background: 'rgba(0,0,0,.65)', color: '#fff', cursor: 'pointer' }
