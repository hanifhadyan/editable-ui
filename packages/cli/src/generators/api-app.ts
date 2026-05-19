export function generateAppContentRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server'
import { adapter, isAdmin } from '../../../../editable.config'

adapter.initialize()

async function checkAdmin(req: NextRequest): Promise<boolean> {
  // next-auth / clerk: adapt isAdmin to App Router request
  return isAdmin(req as any, {} as any)
}

export async function GET(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const all = await adapter.getAll()
  return NextResponse.json(all)
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { key, value, type } = await req.json()
  if (!key || value === undefined || !type) {
    return NextResponse.json({ error: 'Missing key, value, or type' }, { status: 400 })
  }
  await adapter.set(key, value, type)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { key } = await req.json()
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  await adapter.delete(key)
  return NextResponse.json({ ok: true })
}
`
}

export function generateAppUploadRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server'
import { storage, isAdmin } from '../../../../editable.config'

async function checkAdmin(req: NextRequest): Promise<boolean> {
  return isAdmin(req as any, {} as any)
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { file, filename, mimeType } = await req.json()
  if (!file || !filename) {
    return NextResponse.json({ error: 'Missing file or filename' }, { status: 400 })
  }
  const buffer = Buffer.from(file, 'base64')
  const url = await storage.upload(buffer, filename, mimeType ?? 'application/octet-stream')
  return NextResponse.json({ url })
}
`
}
