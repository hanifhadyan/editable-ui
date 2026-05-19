import { Pool, type PoolConfig } from 'pg'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

export class PostgresAdapter implements ContentAdapter {
  private pool: Pool
  private table: string

  constructor(config: PoolConfig | string, table = 'editable_content') {
    this.pool = new Pool(typeof config === 'string' ? { connectionString: config } : config)
    this.table = table
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        type       TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)
  }

  async get(key: string): Promise<ContentEntry | null> {
    const res = await this.pool.query(
      `SELECT value, type, updated_at FROM ${this.table} WHERE key = $1`,
      [key]
    )
    const row = res.rows[0]
    if (!row) return null
    return { value: row.value, type: row.type, updatedAt: row.updated_at }
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.table} (key, value, type, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, type = $3, updated_at = now()`,
      [key, value, type]
    )
  }

  async getAll(): Promise<ContentRecord> {
    const res = await this.pool.query(`SELECT key, value, type, updated_at FROM ${this.table}`)
    return Object.fromEntries(
      res.rows.map(r => [r.key, { value: r.value, type: r.type, updatedAt: r.updated_at }])
    )
  }

  async delete(key: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.table} WHERE key = $1`, [key])
  }
}
