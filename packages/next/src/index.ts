import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { MAX_UPLOAD_SIZE, sanitizeCollectionValue, sanitizeRichText } from '@editable-ui/core'
import type { CollectionField, ContentAdapter, ContentType, StorageAdapter } from '@editable-ui/core'

export { MAX_UPLOAD_SIZE }
export const MAX_UPLOAD_REQUEST_SIZE = 14 * 1024 * 1024
export const MAX_CONTENT_REQUEST_SIZE = 1024 * 1024
const CONTENT_TYPES = new Set([
  'text', 'richtext', 'image', 'link', 'attribute', 'collection', 'collection-schema',
])

type RequestLike = {
  url?: string
  headers: Headers | Record<string, string | string[] | undefined>
  socket?: object
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
      const encrypted = req.socket && 'encrypted' in req.socket && req.socket.encrypted === true
      const protocol = (getHeader(req, 'x-forwarded-proto') ?? (encrypted ? 'https' : 'http'))
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

export function isCollectionSchema(value: unknown): value is CollectionField[] {
  return Array.isArray(value) && value.every(field =>
    field && typeof field === 'object' &&
    typeof field.field === 'string' && typeof field.label === 'string' &&
    (field.type === undefined || ['text', 'richtext', 'image', 'select'].includes(field.type)) &&
    (field.options === undefined || Array.isArray(field.options) && field.options.every((option: unknown) => typeof option === 'string'))
  )
}

export async function prepareCollectionValue(
  adapter: ContentAdapter,
  key: string,
  value: string,
  requestedSchema?: unknown
): Promise<string> {
  const schemaKey = `${key}.__schema`
  const stored = await adapter.get(schemaKey)
  let schema: CollectionField[] | undefined
  if (stored) {
    if (stored.type !== 'collection-schema') throw new TypeError('Invalid collection schema record')
    try {
      const parsed: unknown = JSON.parse(stored.value)
      if (!isCollectionSchema(parsed)) throw new TypeError('Invalid collection schema')
      schema = parsed
    } catch {
      throw new TypeError('Invalid collection schema')
    }
  } else if (requestedSchema !== undefined) {
    if (!isCollectionSchema(requestedSchema)) throw new TypeError('Invalid collection schema')
    schema = requestedSchema
  }

  if (!schema) return value
  let safeValue: string
  try {
    safeValue = sanitizeCollectionValue(value, schema)
  } catch {
    throw new TypeError('Invalid collection content')
  }
  if (!stored) await adapter.set(schemaKey, JSON.stringify(schema), 'collection-schema')
  return safeValue
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

const contentMutationQueues = new WeakMap<ContentAdapter, Promise<void>>()
const activeContentMutations = new AsyncLocalStorage<Set<ContentAdapter>>()

export function withContentMutationLock<T>(adapter: ContentAdapter, mutation: () => Promise<T>): Promise<T> {
  if (activeContentMutations.getStore()?.has(adapter)) return mutation()
  const previous = contentMutationQueues.get(adapter) ?? Promise.resolve()
  const result = previous.then(() => {
    const active = activeContentMutations.getStore()
    if (active?.has(adapter)) return mutation()
    const run = () => activeContentMutations.run(new Set([...(active ?? []), adapter]), mutation)
    if (adapter.withSharedContentLock && adapter.supportsCrossProcessMutationLock !== false) {
      return adapter.withSharedContentLock(run)
    }
    return run()
  })
  contentMutationQueues.set(adapter, result.then(() => undefined, () => undefined))
  return result
}

function supportsSafeUploadCleanup(adapter: ContentAdapter, storage: StorageAdapter | undefined): storage is StorageAdapter & Required<Pick<StorageAdapter, 'owns' | 'exists'>> {
  return Boolean(
    adapter.withSharedContentLock && adapter.supportsCrossProcessMutationLock !== false &&
    storage?.owns && storage.exists
  )
}

function collectStrings(value: string): Set<string> {
  const strings = new Set([value])
  const visit = (item: unknown) => {
    if (typeof item === 'string') strings.add(item)
    else if (Array.isArray(item)) item.forEach(visit)
    else if (item && typeof item === 'object') Object.values(item).forEach(visit)
  }
  try { visit(JSON.parse(value)) } catch { /* keep the original value as a possible URL */ }
  return strings
}

async function removeUnreferencedUploads(
  adapter: ContentAdapter,
  storage: StorageAdapter | undefined,
  previousValue: string | undefined
): Promise<void> {
  if (!supportsSafeUploadCleanup(adapter, storage) || !previousValue) return
  const urls = [...collectStrings(previousValue)].filter(url => storage.owns?.(url))
  for (const url of urls) {
    try {
      await deleteUnreferencedUpload(adapter, storage, url)
    } catch (error) {
      console.error('[editable-ui] Could not delete an unused upload', error)
    }
  }
}

export async function writeContent(
  adapter: ContentAdapter,
  storage: StorageAdapter | undefined,
  key: string,
  value: string,
  type: ContentType,
  schema?: unknown
): Promise<void> {
  let previousValue: string | undefined
  await withContentMutationLock(adapter, async () => {
    const previous = await adapter.get(key)
    previousValue = previous?.value
    let safeValue = type === 'richtext' ? sanitizeRichText(value) : value
    if (type === 'collection') safeValue = await prepareCollectionValue(adapter, key, value, schema)
    if (type === 'collection-schema') {
      let parsed: unknown
      try { parsed = JSON.parse(value) } catch { throw new TypeError('Invalid collection schema') }
      if (!isCollectionSchema(parsed)) throw new TypeError('Invalid collection schema')
    }
    if (supportsSafeUploadCleanup(adapter, storage)) {
      for (const url of collectStrings(safeValue)) {
        if (storage.owns(url) && !await storage.exists(url)) {
          throw new TypeError('Referenced upload no longer exists')
        }
      }
    }
    await adapter.set(key, safeValue, type)
  })
  await removeUnreferencedUploads(adapter, storage, previousValue)
}

export async function deleteContent(
  adapter: ContentAdapter,
  storage: StorageAdapter | undefined,
  key: string
): Promise<void> {
  let previousValue: string | undefined
  await withContentMutationLock(adapter, async () => {
    const previous = await adapter.get(key)
    previousValue = previous?.value
    await adapter.delete(key)
  })
  await removeUnreferencedUploads(adapter, storage, previousValue)
}

export async function deleteUnreferencedUpload(
  adapter: ContentAdapter,
  storage: StorageAdapter,
  url: string
): Promise<boolean> {
  if (!supportsSafeUploadCleanup(adapter, storage)) return false
  return withContentMutationLock(adapter, async () => {
    if (!storage.owns(url) || !await storage.exists(url)) return false
    const records = await adapter.getAll()
    if (Object.values(records).some(entry => typeof entry?.value === 'string' && entry.value.includes(url))) return false
    await storage.delete(url)
    return true
  })
}

export async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
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
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new RequestBodyError('Invalid JSON body', 400)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RequestBodyError('JSON body must be an object', 400)
  }
  return parsed as Record<string, unknown>
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
  storage?: StorageAdapter
  isAdmin: (req: NextApiRequest, res: NextApiResponse) => boolean | Promise<boolean>
}

export function createContentHandler({ adapter, storage, isAdmin }: CreateHandlerOptions) {
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
      const { key, value, type, schema } = req.body ?? {}
      if (typeof key !== 'string' || !key || typeof value !== 'string' || !isContentType(type)) {
        return res.status(400).json({ error: 'Missing key, value, or type' })
      }
      if (type === 'collection-schema') {
        try {
          if (!isCollectionSchema(JSON.parse(value))) return res.status(400).json({ error: 'Invalid collection schema' })
        } catch {
          return res.status(400).json({ error: 'Invalid collection schema' })
        }
      }
      await initialize()
      try {
        await writeContent(adapter, storage, key, value, type, schema)
      } catch (error) {
        if (error instanceof TypeError) return res.status(400).json({ error: error.message })
        throw error
      }
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      if (!isJsonRequest(req)) return res.status(415).json({ error: 'Expected JSON request' })
      if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Invalid origin' })
      const { key } = req.body ?? {}
      if (typeof key !== 'string' || !key) return res.status(400).json({ error: 'Missing key' })
      await initialize()
      await deleteContent(adapter, storage, key)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }
}

export function createUploadHandler({
  storage,
  adapter,
  isAdmin,
}: {
  storage: StorageAdapter
  adapter?: ContentAdapter
  isAdmin: (req: NextApiRequest, res: NextApiResponse) => boolean | Promise<boolean>
}) {
  const initialize = adapter ? createInitializer(() => adapter.initialize()) : undefined
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const admin = await isAdmin(req, res)
    if (!admin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (!isJsonRequest(req)) return res.status(415).json({ error: 'Expected JSON request' })
    if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Invalid origin' })

    if (req.method === 'DELETE') {
      if (!adapter) return res.status(501).json({ error: 'Upload cleanup is not configured' })
      const url = req.body?.url
      if (typeof url !== 'string' || !url) return res.status(400).json({ error: 'Missing upload URL' })
      await initialize?.()
      const deleted = await deleteUnreferencedUpload(adapter, storage, url)
      return res.status(200).json({ ok: true, deleted })
    }

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
