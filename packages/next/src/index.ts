import type { NextApiRequest, NextApiResponse } from 'next'
import type { ContentAdapter, StorageAdapter } from '@editable-ui/core'

interface CreateHandlerOptions {
  adapter: ContentAdapter
  storage?: StorageAdapter
  isAdmin: (req: NextApiRequest) => boolean | Promise<boolean>
}

export function createContentHandler({ adapter, storage: _storage, isAdmin }: CreateHandlerOptions) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const admin = await isAdmin(req)
    if (!admin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.method === 'GET') {
      const all = await adapter.getAll()
      return res.status(200).json(all)
    }

    if (req.method === 'POST') {
      const { key, value, type } = req.body
      if (!key || value === undefined || !type) {
        return res.status(400).json({ error: 'Missing key, value, or type' })
      }
      await adapter.set(key, value, type)
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const { key } = req.body
      if (!key) return res.status(400).json({ error: 'Missing key' })
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
  isAdmin: (req: NextApiRequest) => boolean | Promise<boolean>
}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const admin = await isAdmin(req)
    if (!admin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { file, filename, mimeType } = req.body
    if (!file || !filename) {
      return res.status(400).json({ error: 'Missing file or filename' })
    }

    const buffer = Buffer.from(file, 'base64')
    const url = await storage.upload(buffer, filename, mimeType ?? 'application/octet-stream')
    return res.status(200).json({ url })
  }
}
