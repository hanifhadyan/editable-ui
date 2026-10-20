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

  owns(url: string): boolean {
    const prefix = `${this.publicPath}/`
    return url.startsWith(prefix) && /^[a-f0-9]{16}\.(?:png|jpg|gif|webp)$/.test(url.slice(prefix.length))
  }

  async exists(url: string): Promise<boolean> {
    if (!this.owns(url)) return false
    try {
      await fs.access(path.join(this.dir, url.slice(`${this.publicPath}/`.length)))
      return true
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false
      throw error
    }
  }

  async delete(url: string): Promise<void> {
    if (!this.owns(url)) return
    const filename = url.slice(`${this.publicPath}/`.length)
    try {
      await fs.unlink(path.join(this.dir, filename))
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return
      throw error
    }
  }
}
