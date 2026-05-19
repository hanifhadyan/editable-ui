import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import type { StorageAdapter } from '@editable-ui/core'

interface LocalStorageOptions {
  dir?: string
  publicPath?: string
}

export class LocalStorageAdapter implements StorageAdapter {
  private dir: string
  private publicPath: string

  constructor({ dir = './public/uploads', publicPath = '/uploads' }: LocalStorageOptions = {}) {
    this.dir = path.resolve(dir)
    this.publicPath = publicPath
  }

  async upload(file: Buffer, filename: string, _mimeType: string): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true })
    const ext = path.extname(filename)
    const name = `${crypto.randomBytes(8).toString('hex')}${ext}`
    await fs.writeFile(path.join(this.dir, name), file)
    return `${this.publicPath}/${name}`
  }

  async delete(url: string): Promise<void> {
    const filename = path.basename(url)
    try {
      await fs.unlink(path.join(this.dir, filename))
    } catch {
      // ignore if file doesn't exist
    }
  }
}
