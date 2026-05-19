import fs from 'fs/promises'
import path from 'path'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

export class JsonAdapter implements ContentAdapter {
  private filePath: string
  private cache: ContentRecord = {}

  constructor(filePath = './data/content.json') {
    this.filePath = path.resolve(filePath)
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true })
      const raw = await fs.readFile(this.filePath, 'utf-8')
      this.cache = JSON.parse(raw)
    } catch {
      this.cache = {}
      await this.flush()
    }
  }

  async get(key: string): Promise<ContentEntry | null> {
    return this.cache[key] ?? null
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    this.cache[key] = { value, type, updatedAt: new Date().toISOString() }
    await this.flush()
  }

  async getAll(): Promise<ContentRecord> {
    return { ...this.cache }
  }

  async delete(key: string): Promise<void> {
    delete this.cache[key]
    await this.flush()
  }

  private async flush(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8')
  }
}
