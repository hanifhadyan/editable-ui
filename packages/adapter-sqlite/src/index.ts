import Database from 'better-sqlite3'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

interface ContentRow {
  key: string
  value: string
  type: ContentType
  updated_at: string
}

function quoteTableName(table: string): string {
  const parts = typeof table === 'string' ? table.split('.') : []
  if (parts.length > 2 || parts.some(part => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(part))) {
    throw new Error('Invalid SQL table name')
  }
  return parts.map(part => `"${part}"`).join('.')
}

export class SQLiteAdapter implements ContentAdapter {
  private db: Database.Database
  private table: string

  constructor(filePath = './data/content.db', table = 'editable_content') {
    this.table = quoteTableName(table)
    this.db = new Database(filePath)
  }

  async initialize(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        type       TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)
  }

  async withSharedContentLock<T>(mutation: () => Promise<T>): Promise<T> {
    const previousTimeout = Number(this.db.pragma('busy_timeout', { simple: true }))
    this.db.pragma('busy_timeout = 0')
    try {
      while (true) {
        try {
          this.db.exec('BEGIN IMMEDIATE')
          break
        } catch (error) {
          if (!error || typeof error !== 'object' || !('code' in error) ||
            typeof error.code !== 'string' || !/^SQLITE_(?:BUSY|LOCKED)/.test(error.code)) throw error
          await new Promise(resolve => setTimeout(resolve, 25))
        }
      }

      try {
        const result = await mutation()
        this.db.exec('COMMIT')
        return result
      } catch (error) {
        if (this.db.inTransaction) this.db.exec('ROLLBACK')
        throw error
      }
    } finally {
      this.db.pragma(`busy_timeout = ${previousTimeout}`)
    }
  }

  async get(key: string): Promise<ContentEntry | null> {
    const row = this.db
      .prepare(`SELECT value, type, updated_at FROM ${this.table} WHERE key = ?`)
      .get(key) as ContentRow | undefined
    if (!row) return null
    return { value: row.value, type: row.type, updatedAt: row.updated_at }
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO ${this.table} (key, value, type, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = datetime('now')`
      )
      .run(key, value, type)
  }

  async getAll(): Promise<ContentRecord> {
    const rows = this.db
      .prepare(`SELECT key, value, type, updated_at FROM ${this.table}`)
      .all() as ContentRow[]
    return Object.fromEntries(
      rows.map(r => [r.key, { value: r.value, type: r.type, updatedAt: r.updated_at }])
    )
  }

  async delete(key: string): Promise<void> {
    this.db.prepare(`DELETE FROM ${this.table} WHERE key = ?`).run(key)
  }
}
