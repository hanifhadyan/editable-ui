'use client'

import React, { useState, useRef } from 'react'

interface HoverPreviewProps {
  src: string
  children: React.ReactNode
}

export function HoverPreview({ src, children }: HoverPreviewProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent) => {
    setPos({ x: e.clientX + 16, y: e.clientY + 16 })
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'contents' }}
      onMouseEnter={() => src && setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={onMove}
    >
      {children}
      {visible && src && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            zIndex: 99998,
            pointerEvents: 'none',
          }}
        >
          <img
            src={src}
            alt="preview"
            style={{
              width: 160,
              height: 200,
              objectFit: 'cover',
              borderRadius: 8,
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
              border: '2px solid #fff',
            }}
          />
        </div>
      )}
    </div>
  )
}
