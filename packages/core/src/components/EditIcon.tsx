'use client'

interface EditIconProps {
  onClick: () => void
}

export function EditIcon({ onClick }: EditIconProps) {
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 9999,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: '#000',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        opacity: 0.85,
      }}
      title="Edit"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
}
