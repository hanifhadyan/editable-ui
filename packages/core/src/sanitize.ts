import DOMPurify from 'isomorphic-dompurify'
import type { CollectionField } from './types'

const ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'li', 'ol', 'p', 'pre', 's', 'strong', 'u', 'ul',
]

function restrictStyle(
  node: Element,
  data: { attrName: string; attrValue: string; keepAttr: boolean }
) {
  if (data.attrName !== 'style') return
  const alignment = /^text-align\s*:\s*(left|center|right|justify)\s*;?$/i.exec(data.attrValue.trim())
  if (!/^(p|h[1-6])$/i.test(node.nodeName) || !alignment) {
    data.keepAttr = false
    return
  }
  data.attrValue = `text-align: ${alignment[1].toLowerCase()}`
}

export function sanitizeRichText(html: string): string {
  DOMPurify.addHook('uponSanitizeAttribute', restrictStyle)
  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ['href', 'rel', 'style', 'target'],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
    })
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', restrictStyle)
  }
}

export function sanitizeCollectionValue(value: string, schema: CollectionField[]): string {
  const items: unknown = JSON.parse(value)
  if (!Array.isArray(items)) throw new TypeError('Collection content must be a JSON array')

  const richTextFields = schema.filter(field => field.type === 'richtext').map(field => field.field)
  return JSON.stringify(items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const safe = { ...item }
    for (const field of richTextFields) {
      if (typeof safe[field] === 'string') safe[field] = sanitizeRichText(safe[field])
    }
    return safe
  }))
}
