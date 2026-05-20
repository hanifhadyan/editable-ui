'use client'

import React, { useState } from 'react'
import type { CollectionItem, CollectionField } from '../types'
import { useCollection } from '../hooks/useCollection'
import { CollectionTable } from './CollectionTable'
import { CollectionModal } from './CollectionModal'

interface EditableCollectionProps {
  contentKey: string
  schema: CollectionField[]
  modal?: (item: CollectionItem) => React.ReactNode
  hoverPreview?: string
  className?: string
  onRowClick?: (item: CollectionItem) => void
}

export function EditableCollection({
  contentKey,
  schema: schemaFallback,
  modal,
  hoverPreview,
  className,
  onRowClick,
}: EditableCollectionProps) {
  const { items, schema, isAdmin, addItem, updateItem, deleteItem, updateSchema } =
    useCollection(contentKey, schemaFallback)

  const [activeItem, setActiveItem] = useState<CollectionItem | null>(null)

  const handleRowClick = (item: CollectionItem) => {
    if (onRowClick) {
      onRowClick(item)
    } else {
      setActiveItem(item)
    }
  }

  const handleLabelChange = (field: string, label: string) => {
    updateSchema(schema.map(f => f.field === field ? { ...f, label } : f))
  }

  return (
    <>
      <CollectionTable
        items={items}
        schema={schema}
        isAdmin={isAdmin}
        hoverPreview={hoverPreview}
        className={className}
        onRowClick={handleRowClick}
        onCellSave={updateItem}
        onDeleteItem={deleteItem}
        onAddItem={addItem}
        onLabelChange={handleLabelChange}
      />

      {activeItem && (
        <CollectionModal
          item={activeItem}
          schema={schema}
          onClose={() => setActiveItem(null)}
          onSave={updateItem}
          renderView={modal}
        />
      )}
    </>
  )
}
