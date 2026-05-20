'use client'

import React, { useState, useRef } from 'react'
import type { CollectionItem, CollectionField } from '../types'
import { HoverPreview } from './HoverPreview'

interface CollectionTableProps {
  items: CollectionItem[]
  schema: CollectionField[]
  isAdmin: boolean
  hoverPreview?: string
  className?: string
  onRowClick: (item: CollectionItem) => void
  onRowHover?: (item: CollectionItem | null) => void
  onCellSave: (id: string, field: string, value: string) => void
  onDeleteItem: (id: string) => void
  onAddItem: () => void
  onLabelChange: (field: string, label: string) => void
}

export function CollectionTable({
  items,
  schema,
  isAdmin,
  hoverPreview,
  className,
  onRowClick,
  onRowHover,
  onCellSave,
  onDeleteItem,
  onAddItem,
  onLabelChange,
}: CollectionTableProps) {
  const visibleFields = schema.filter(f => f.visible !== false)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={className} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {visibleFields.map(f => (
              <HeaderCell
                key={f.field}
                field={f}
                isAdmin={isAdmin}
                onLabelChange={onLabelChange}
              />
            ))}
            {isAdmin && <th style={thStyle} />}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <TableRow
              key={item.id}
              item={item}
              visibleFields={visibleFields}
              isAdmin={isAdmin}
              hoverPreview={hoverPreview}
              onRowClick={onRowClick}
              onRowHover={onRowHover}
              onCellSave={onCellSave}
              onDeleteItem={onDeleteItem}
            />
          ))}
          {items.length === 0 && (
            <tr>
              <td
                colSpan={visibleFields.length + (isAdmin ? 1 : 0)}
                style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: 14 }}
              >
                No items yet.{isAdmin ? ' Click "+ Add row" to start.' : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isAdmin && (
        <button onClick={onAddItem} style={addRowBtnStyle}>
          + Add row
        </button>
      )}
    </div>
  )
}

// ─── Header Cell ────────────────────────────────────────────────────────────

function HeaderCell({
  field,
  isAdmin,
  onLabelChange,
}: {
  field: CollectionField
  isAdmin: boolean
  onLabelChange: (field: string, label: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(field.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    setEditing(false)
    if (label !== field.label) onLabelChange(field.field, label)
  }

  if (isAdmin && editing) {
    return (
      <th style={thStyle}>
        <input
          ref={inputRef}
          value={label}
          autoFocus
          onChange={e => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          style={{ border: 'none', outline: 'none', fontWeight: 700, fontSize: 'inherit', background: 'transparent', width: '100%' }}
        />
      </th>
    )
  }

  return (
    <th
      style={thStyle}
      onClick={() => isAdmin && setEditing(true)}
      title={isAdmin ? 'Click to rename column' : undefined}
    >
      {field.label}
      {isAdmin && <span style={{ marginLeft: 4, opacity: 0.4, fontSize: 10 }}>✎</span>}
    </th>
  )
}

// ─── Table Row ───────────────────────────────────────────────────────────────

function TableRow({
  item,
  visibleFields,
  isAdmin,
  hoverPreview,
  onRowClick,
  onRowHover,
  onCellSave,
  onDeleteItem,
}: {
  item: CollectionItem
  visibleFields: CollectionField[]
  isAdmin: boolean
  hoverPreview?: string
  onRowClick: (item: CollectionItem) => void
  onRowHover?: (item: CollectionItem | null) => void
  onCellSave: (id: string, field: string, value: string) => void
  onDeleteItem: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [editingCell, setEditingCell] = useState<string | null>(null)

  const previewSrc = hoverPreview ? item[hoverPreview] : ''

  const row = (
    <tr
      onMouseEnter={() => { setHovered(true); onRowHover?.(item) }}
      onMouseLeave={() => { setHovered(false); setEditingCell(null); onRowHover?.(null) }}
      style={{
        cursor: 'pointer',
        background: hovered ? '#f9f9f9' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {visibleFields.map(f => (
        <EditableCell
          key={f.field}
          field={f}
          value={item[f.field] ?? ''}
          isAdmin={isAdmin}
          isEditing={editingCell === f.field}
          onStartEdit={() => isAdmin && setEditingCell(f.field)}
          onStopEdit={() => setEditingCell(null)}
          onSave={(val) => onCellSave(item.id, f.field, val)}
          onRowClick={() => {
            if (editingCell) return
            onRowClick(item)
          }}
        />
      ))}

      {isAdmin && (
        <td style={{ ...tdStyle, width: 36 }}>
          {hovered && (
            <button
              onClick={e => { e.stopPropagation(); onDeleteItem(item.id) }}
              title="Delete row"
              style={deleteBtnStyle}
            >
              🗑
            </button>
          )}
        </td>
      )}
    </tr>
  )

  if (hoverPreview && previewSrc) {
    return <HoverPreview src={previewSrc}>{row}</HoverPreview>
  }

  return row
}

// ─── Editable Cell ───────────────────────────────────────────────────────────

function EditableCell({
  field,
  value,
  isAdmin,
  isEditing,
  onStartEdit,
  onStopEdit,
  onSave,
  onRowClick,
}: {
  field: CollectionField
  value: string
  isAdmin: boolean
  isEditing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onSave: (val: string) => void
  onRowClick: () => void
}) {
  const [draft, setDraft] = useState(value)

  const commit = () => {
    onStopEdit()
    if (draft !== value) onSave(draft)
  }

  if (isAdmin && isEditing) {
    if (field.type === 'select' && field.options) {
      return (
        <td style={tdStyle} onClick={e => e.stopPropagation()}>
          <select
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 'inherit', cursor: 'pointer' }}
          >
            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </td>
      )
    }

    return (
      <td style={tdStyle} onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); onStopEdit() } }}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 'inherit', width: '100%' }}
        />
      </td>
    )
  }

  return (
    <td
      style={{
        ...tdStyle,
        outline: isAdmin ? '1px dashed transparent' : 'none',
      }}
      onDoubleClick={e => { e.stopPropagation(); onStartEdit() }}
      onClick={onRowClick}
      title={isAdmin ? 'Double-click to edit, single-click to open detail' : undefined}
    >
      {value || <span style={{ color: '#bbb' }}>—</span>}
    </td>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#666',
  borderBottom: '2px solid #eee',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 14,
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'middle',
}

const deleteBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  opacity: 0.5,
  padding: 4,
  lineHeight: 1,
}

const addRowBtnStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 16px',
  background: 'none',
  border: '1px dashed #ccc',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  color: '#666',
  width: '100%',
}
