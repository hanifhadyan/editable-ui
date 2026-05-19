import Database from 'better-sqlite3'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

export class SQLiteAdapter implements ContentAdapter {
  private db: Database.Database
  private table: string

  constructor(filePath = './data/content.db', table = 'editable_content') {
    this.db = new Database(filePath)
    this.table = table
  }

  async initialize(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${this.table}" (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        type       TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)
  }

  async get(key: string): Promise<ContentEntry | null> {
    const row = this.db
      .prepare(`SELECT value, type, updated_at FROM "${this.table}" WHERE key = ?`)
      .get(key) as any
    if (!row) return null
    return { value: row.value, type: row.type, updatedAt: row.updated_at }
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO "${this.table}" (key, value, type, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = datetime('now')`
      )
      .run(key, value, type)
  }

  async getAll(): Promise<ContentRecord> {
    const rows = this.db
      .prepare(`SELECT key, value, type, updated_at FROM "${this.table}"`)
      .all() as any[]
    return Object.fromEntries(
      rows.map(r => [r.key, { value: r.value, type: r.type, updatedAt: r.updated_at }])
    )
  }

  async delete(key: string): Promise<void> {
    this.db.prepare(`DELETE FROM "${this.table}" WHERE key = ?`).run(key)
  }
}
