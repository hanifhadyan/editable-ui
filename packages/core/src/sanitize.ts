import DOMPurify from 'isomorphic-dompurify'

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
