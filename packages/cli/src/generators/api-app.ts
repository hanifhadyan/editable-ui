export function generateAppContentRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server'
import {
  createInitializer,
  isJsonRequest,
  isSameOriginRequest,
  isContentType,
  readJsonBody,
  RequestBodyError,
  MAX_CONTENT_REQUEST_SIZE,
} from '@editable-ui/next'
import { sanitizeRichText } from '@editable-ui/core'
import { adapter, isAdmin } from '../../../../editable.config'

export const dynamic = 'force-dynamic'

const ensureInitialized = createInitializer(() => adapter.initialize())

async function checkAdmin(req: NextRequest): Promise<boolean> {
  return isAdmin(req as any)
}

function mutationError(req: NextRequest) {
  if (!isJsonRequest(req)) return NextResponse.json({ error: 'Expected JSON request' }, { status: 415 })
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  return null
}

async function parseBody(req: NextRequest) {
  try {
    return await readJsonBody(req, MAX_CONTENT_REQUEST_SIZE)
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.statusCode : 400
    return NextResponse.json({ error: 'Invalid request body' }, { status })
  }
}

export async function GET(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await ensureInitialized()
  const all = await adapter.getAll()
  return NextResponse.json(all, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const error = mutationError(req)
  if (error) return error
  const body = await parseBody(req)
  if (body instanceof NextResponse) return body
  const { key, value, type } = body ?? {}
  if (typeof key !== 'string' || !key || typeof value !== 'string' || !isContentType(type)) {
    return NextResponse.json({ error: 'Missing key, value, or type' }, { status: 400 })
  }
  await ensureInitialized()
  await adapter.set(key, type === 'richtext' ? sanitizeRichText(value) : value, type)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const error = mutationError(req)
  if (error) return error
  const body = await parseBody(req)
  if (body instanceof NextResponse) return body
  const { key } = body ?? {}
  if (typeof key !== 'string' || !key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  await ensureInitialized()
  await adapter.delete(key)
  return NextResponse.json({ ok: true })
}
`
}

export function generateAppUploadRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server'
import {
  ImageUploadError,
  isJsonRequest,
  isSameOriginRequest,
  MAX_UPLOAD_REQUEST_SIZE,
  readJsonBody,
  RequestBodyError,
  storeUploadedImage,
} from '@editable-ui/next'
import { storage, isAdmin } from '../../../../editable.config'

export async function POST(req: NextRequest) {
  if (!await isAdmin(req as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isJsonRequest(req)) return NextResponse.json({ error: 'Expected JSON request' }, { status: 415 })
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })

  let body: any
  try {
    body = await readJsonBody(req, MAX_UPLOAD_REQUEST_SIZE)
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.statusCode : 400
    return NextResponse.json({ error: 'Invalid request body' }, { status })
  }

  try {
    const url = await storeUploadedImage(storage, body?.file)
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
`
}
