import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { MAX_UPLOAD_SIZE, sanitizeRichText } from '@editable-ui/core'
import type { ContentAdapter, ContentType, StorageAdapter } from '@editable-ui/core'

export { MAX_UPLOAD_SIZE }
export const MAX_UPLOAD_REQUEST_SIZE = 14 * 1024 * 1024
export const MAX_CONTENT_REQUEST_SIZE = 1024 * 1024
const CONTENT_TYPES = new Set([
  'text', 'richtext', 'image', 'link', 'attribute', 'collection', 'collection-schema',
])

type RequestLike = {
  url?: string
  headers: Headers | Record<string, string | string[] | undefined>
  socket?: any
}

function getHeader(req: RequestLike, name: string): string | undefined {
  const headers = req.headers
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined
  const value = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

export function isSameOriginRequest(req: RequestLike): boolean {
  const origin = getHeader(req, 'origin')
  const fetchSite = getHeader(req, 'sec-fetch-site')
  if (!origin || (fetchSite && fetchSite.toLowerCase() !== 'same-origin')) return false

  try {
    let requestOrigin: string
    if (req.url && /^https?:\/\//i.test(req.url)) {
      const target = new URL(req.url)
      if (target.username || target.password) return false
      requestOrigin = target.origin
    } else {
      const host = (getHeader(req, 'x-forwarded-host') ?? getHeader(req, 'host'))?.split(',')[0].trim()
      const protocol = (getHeader(req, 'x-forwarded-proto') ?? (req.socket?.encrypted ? 'https' : 'http'))
        .split(',')[0].trim().toLowerCase()
      if (!host || !['http', 'https'].includes(protocol)) return false
      const target = new URL(`${protocol}://${host}`)
      if (target.username || target.password || target.pathname !== '/' || target.search || target.hash) return false
      requestOrigin = target.origin
    }

    const source = new URL(origin)
    return !source.username && !source.password && source.pathname === '/' && !source.search && !source.hash && source.origin === requestOrigin
  } catch {
    return false
  }
}

export function isJsonRequest(req: RequestLike): boolean {
  return /^application\/json(?:\s*;|$)/i.test(getHeader(req, 'content-type') ?? '')
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && CONTENT_TYPES.has(value)
}

export class RequestBodyError extends Error {
  constructor(message: string, readonly statusCode: 400 | 413) {
    super(message)
  }
}

export function createInitializer(initialize: () => Promise<void>): () => Promise<void> {
  let pending: Promise<void> | undefined
  return () => {
    pending ??= initialize().catch(error => {
      pending = undefined
      throw error
    })
    return pending
  }
}

export async function readJsonBody(req: Request, maxBytes: number): Promise<any> {
  const contentLength = req.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new RequestBodyError('Request body is too large', 413)
  }
  if (!req.body) throw new RequestBodyError('Request body is empty', 400)

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new RequestBodyError('Request body is too large', 413)
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new RequestBodyError('Invalid JSON body', 400)
  }
}

export class ImageUploadError extends Error {
  constructor(message: string, readonly statusCode: 400 | 413 | 415) {
    super(message)
  }
}

export async function storeUploadedImage(storage: StorageAdapter, encoded: unknown): Promise<string> {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new ImageUploadError('Missing image data', 400)
  }
  if (encoded.length > Math.ceil(MAX_UPLOAD_SIZE / 3) * 4) {
    throw new ImageUploadError('Image exceeds the 10 MiB limit', 413)
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new ImageUploadError('Invalid base64 image data', 400)
  }

  const buffer = Buffer.from(encoded, 'base64')
  if (buffer.length > MAX_UPLOAD_SIZE) {
    throw new ImageUploadError('Image exceeds the 10 MiB limit', 413)
  }
  if (buffer.toString('base64') !== encoded) {
    throw new ImageUploadError('Invalid base64 image data', 400)
  }

  let mimeType: string
  let extension: string
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    mimeType = 'image/png'
    extension = 'png'
  } else if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    mimeType = 'image/jpeg'
    extension = 'jpg'
  } else if (buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/)) {
    mimeType = 'image/gif'
    extension = 'gif'
  } else if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    mimeType = 'image/webp'
    extension = 'webp'
  } else {
    throw new ImageUploadError('Only PNG, JPEG, GIF, and WebP images are supported', 415)
  }

  return storage.upload(buffer, `${randomUUID()}.${extension}`, mimeType)
}

interface CreateHandlerOptions {
  adapter: ContentAdapter
  isAdmin: (req: NextApiRequest, res: NextApiResponse) => boolean | Promise<boolean>
}

export function createContentHandler({ adapter, isAdmin }: CreateHandlerOptions) {
  const initialize = createInitializer(() => adapter.initialize())

  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const admin = await isAdmin(req, res)
    if (!admin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'private, no-store')
      await initialize()
      const all = await adapter.getAll()
      return res.status(200).json(all)
    }

    if (req.method === 'POST') {
      if (!isJsonRequest(req)) return res.status(415).json({ error: 'Expected JSON request' })
      if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Invalid origin' })
      const { key, value, type } = req.body ?? {}
      if (typeof key !== 'string' || !key || typeof value !== 'string' || !isContentType(type)) {
        return res.status(400).json({ error: 'Missing key, value, or type' })
      }
      await initialize()
      await adapter.set(key, type === 'richtext' ? sanitizeRichText(value) : value, type)
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      if (!isJsonRequest(req)) return res.status(415).json({ error: 'Expected JSON request' })
      if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Invalid origin' })
      const { key } = req.body ?? {}
      if (typeof key !== 'string' || !key) return res.status(400).json({ error: 'Missing key' })
      await initialize()
      await adapter.delete(key)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }
}

export function createUploadHandler({
  storage,
  isAdmin,
}: {
  storage: StorageAdapter
  isAdmin: (req: NextApiRequest, res: NextApiResponse) => boolean | Promise<boolean>
}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const admin = await isAdmin(req, res)
    if (!admin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (!isJsonRequest(req)) return res.status(415).json({ error: 'Expected JSON request' })
    if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Invalid origin' })

    try {
      const url = await storeUploadedImage(storage, req.body?.file)
      return res.status(200).json({ url })
    } catch (error) {
      if (error instanceof ImageUploadError) {
        return res.status(error.statusCode).json({ error: error.message })
      }
      throw error
    }
  }
}
