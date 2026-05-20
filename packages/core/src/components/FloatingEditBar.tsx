'use client'

import React from 'react'

interface FloatingEditBarProps {
  label: string
  isPreview: boolean
  onEdit: () => void
  onPreview: () => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
}

export function FloatingEditBar({
  label,
  isPreview,
  onEdit,
  onPreview,
  onSave,
  onCancel,
  saving = false,
}: FloatingEditBarProps) {
  return (
    <div style={barStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {isPreview ? (
          <button onClick={onEdit} style={btnStyle('#444', '#fff')}>✏ Edit</button>
        ) : (
          <button onClick={onPreview} style={btnStyle('#444', '#fff')}>👁 Preview</button>
        )}
        <button onClick={onSave} disabled={saving} style={btnStyle('#c9a84c', '#1a1008')}>
          {saving ? 'Saving…' : '✓ Save'}
        </button>
        <button onClick={onCancel} style={btnStyle('#333', '#aaa')}>✕ Cancel</button>
      </div>
    </div>
  )
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: 'none',
    borderRadius: 5,
    padding: '4px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'sans-serif',
    fontWeight: 600,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  }
}

const barStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#111',
  border: '1px solid #333',
  borderRadius: 8,
  padding: '6px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  zIndex: 99999,
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  fontFamily: 'sans-serif',
}

const labelStyle: React.CSSProperties = {
  color: '#888',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  borderRight: '1px solid #333',
  paddingRight: 10,
}
