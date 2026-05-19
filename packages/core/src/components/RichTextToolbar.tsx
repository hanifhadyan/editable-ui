'use client'

import React from 'react'
import type { Editor } from '@tiptap/react'

interface RichTextToolbarProps {
  editor: Editor | null
  onSave: () => void
  onCancel: () => void
}

export function RichTextToolbar({ editor, onSave, onCancel }: RichTextToolbarProps) {
  if (!editor) return null

  return (
    <div style={toolbarStyle}>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <strong>B</strong>
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <em>I</em>
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <span style={{ textDecoration: 'underline' }}>U</span>
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </ToolBtn>
      <Divider />
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        H1
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolBtn>
      <Divider />
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        •≡
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Ordered list"
      >
        1≡
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        "
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code block"
      >
        {'</>'}
      </ToolBtn>
      <Divider />
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
        ←
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
        ↔
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
        →
      </ToolBtn>
      <Divider />
      <button onClick={onSave} style={{ ...toolBtnStyle, background: '#000', color: '#fff' }}>
        Save
      </button>
      <button onClick={onCancel} style={{ ...toolBtnStyle, background: '#eee', color: '#333' }}>
        Cancel
      </button>
    </div>
  )
}

function Divider() {
  return <span style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />
}

function ToolBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...toolBtnStyle,
        background: active ? '#000' : 'transparent',
        color: active ? '#fff' : '#333',
      }}
    >
      {children}
    </button>
  )
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '6px 8px',
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 8,
  boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
  flexWrap: 'wrap',
  marginBottom: 8,
  zIndex: 9999,
}

const toolBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit',
  minWidth: 28,
}
