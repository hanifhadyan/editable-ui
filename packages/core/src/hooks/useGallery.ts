'use client'

import { useCallback } from 'react'
import { useEditableContext } from '../EditableContext'
import type { GalleryImage } from '../types'

function parse(raw: string | undefined): GalleryImage[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export function useGallery(contentKey: string) {
  const { isAdmin, content, setContent, uploadImage } = useEditableContext()

  const images = parse(content[contentKey]?.value)

  const save = useCallback(
    (next: GalleryImage[]) => setContent(contentKey, JSON.stringify(next), 'collection'),
    [contentKey, setContent]
  )

  const addImages = useCallback(
    async (files: File[]) => {
      const uploaded: GalleryImage[] = await Promise.all(
        files.map(async (file) => ({
          id: crypto.randomUUID(),
          src: await uploadImage(file),
          alt: file.name.replace(/\.[^.]+$/, ''),
          caption: '',
        }))
      )
      save([...images, ...uploaded])
    },
    [images, save, uploadImage]
  )

  const removeImage = useCallback(
    (id: string) => save(images.filter(img => img.id !== id)),
    [images, save]
  )

  const reorder = useCallback(
    (from: number, to: number) => {
      const next = [...images]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      save(next)
    },
    [images, save]
  )

  const updateImage = useCallback(
    (id: string, patch: Partial<Omit<GalleryImage, 'id'>>) => {
      save(images.map(img => img.id === id ? { ...img, ...patch } : img))
    },
    [images, save]
  )

  return { images, isAdmin, addImages, removeImage, reorder, updateImage }
}
