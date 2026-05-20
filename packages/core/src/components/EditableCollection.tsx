'use client'

import React, { useState } from 'react'
import type { CollectionItem, CollectionField } from '../types'
import { useCollection } from '../hooks/useCollection'
import { CollectionTable } from './CollectionTable'
import { CollectionModal } from './CollectionModal'

interface EditableCollectionProps {
  contentKey: string
  schema: CollectionField[]
  /**
   * Render prop for right-side panel (toto-wines style split layout).
   * Receives hovered item. Updates on row hover.
   * When provided, layout becomes: left table | right panel.
   */
  panel?: (item: CollectionItem | null) => React.ReactNode
  /**
   * Render prop for click modal.
   * Receives clicked item. Same data as panel, different context.
   */
  modal?: (item: CollectionItem) => React.ReactNode
  /** Field name to use for cursor-following image preview (optional, separate from panel) */
  hoverPreview?: string
  /** Custom handler for row click — bypasses built-in modal */
  onRowClick?: (item: CollectionItem) => void
  className?: string
  /** Width of left table side when panel is active. Default: '50%' */
  tableWidth?: string | number
  /** Width of right panel side. Default: '50%' */
  panelWidth?: string | number
}

export function EditableCollection({
  contentKey,
  schema: schemaFallback,
  panel,
  modal,
  hoverPreview,
  onRowClick,
  className,
  tableWidth = '50%',
  panelWidth = '50%',
}: EditableCollectionProps) {
  const { items, schema, isAdmin, addItem, updateItem, deleteItem, updateSchema } =
    useCollection(contentKey, schemaFallback)

  const [modalItem, setModalItem] = useState<CollectionItem | null>(null)
  const [hoveredItem, setHoveredItem] = useState<CollectionItem | null>(null)

  // default panel item = first item if nothing hovered
  const panelItem = hoveredItem ?? items[0] ?? null

  const handleRowClick = (item: CollectionItem) => {
    if (onRowClick) {
      onRowClick(item)
    } else if (modal) {
      setModalItem(item)
    }
  }

  const handleLabelChange = (field: string, label: string) => {
    updateSchema(schema.map(f => f.field === field ? { ...f, label } : f))
  }

  const table = (
    <CollectionTable
      items={items}
      schema={schema}
      isAdmin={isAdmin}
      hoverPreview={panel ? undefined : hoverPreview} // cursor preview only when no panel
      className={className}
      onRowClick={handleRowClick}
      onRowHover={panel ? setHoveredItem : undefined}
      onCellSave={updateItem}
      onDeleteItem={deleteItem}
      onAddItem={addItem}
      onLabelChange={handleLabelChange}
    />
  )

  return (
    <>
      {panel ? (
        // ── Split layout ────────────────────────────────────────────────
        <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
          <div style={{ width: tableWidth, flexShrink: 0 }}>
            {table}
          </div>
          <div
            style={{
              width: panelWidth,
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              height: '100vh',
              overflow: 'hidden',
            }}
          >
            {panel(panelItem)}
          </div>
        </div>
      ) : (
        // ── Table only ──────────────────────────────────────────────────
        table
      )}

      {modalItem && (
        <CollectionModal
          item={modalItem}
          schema={schema}
          onClose={() => setModalItem(null)}
          onSave={updateItem}
          renderView={modal}
        />
      )}
    </>
  )
}
