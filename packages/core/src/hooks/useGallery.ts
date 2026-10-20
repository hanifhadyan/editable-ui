'use client'

import { useCallback } from 'react'
import { useEditableContext } from '../EditableContext'
import type { GalleryImage } from '../types'

function parse(raw: string | undefined): GalleryImage[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export function useGallery(contentKey: string) {
  const { isAdmin, content, setContent, uploadImage, deleteImage } = useEditableContext()

  const images = parse(content[contentKey]?.value)

  const save = useCallback(
    (next: GalleryImage[]) => setContent(contentKey, JSON.stringify(next), 'collection'),
    [contentKey, setContent]
  )

  const addImages = useCallback(
    async (files: File[]) => {
      const results = await Promise.allSettled(
        files.map(async (file) => ({
          id: crypto.randomUUID(),
          src: await uploadImage(file),
          alt: file.name.replace(/\.[^.]+$/, ''),
          caption: '',
        }))
      )
      const uploaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      if (uploaded.length) {
        try {
          await save([...images, ...uploaded])
        } catch (error) {
          await Promise.allSettled(uploaded.map(image => deleteImage(image.src)))
          throw error
        }
      }
      if (uploaded.length !== files.length) {
        throw new Error(uploaded.length
          ? `Uploaded ${uploaded.length} of ${files.length} images; successful uploads were saved.`
          : 'Could not upload any images.')
      }
    },
    [images, save, uploadImage, deleteImage]
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
