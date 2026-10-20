import { createHash } from 'node:crypto'
import mysql, { type Pool, type PoolConnection, type PoolOptions, type RowDataPacket } from 'mysql2/promise'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

interface ContentRow extends RowDataPacket {
  value: string
  type: ContentType
  updated_at: string | Date
}

interface ContentRecordRow extends ContentRow {
  key: string
}

function quoteTableName(table: string): string {
  const parts = typeof table === 'string' ? table.split('.') : []
  if (parts.length > 2 || parts.some(part => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(part))) {
    throw new Error('Invalid SQL table name')
  }
  return parts.map(part => `\`${part}\``).join('.')
}

export class MySQLAdapter implements ContentAdapter {
  private pool: Pool
  private table: string
  private lockName: string
  private mutationConnection?: PoolConnection

  constructor(config: PoolOptions | string, table = 'editable_content') {
    this.table = quoteTableName(table)
    this.lockName = `editable-ui:${createHash('sha256').update(this.table).digest('hex').slice(0, 40)}`
    this.pool = mysql.createPool(typeof config === 'string' ? { uri: config } : config)
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        \`key\`       VARCHAR(500) PRIMARY KEY,
        \`value\`     LONGTEXT NOT NULL,
        \`type\`      VARCHAR(50) NOT NULL,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
  }

  async withSharedContentLock<T>(mutation: () => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection()
    let acquired = false
    let destroyConnection = false
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT GET_LOCK(?, 2147483647) AS acquired', [this.lockName]
      )
      if (Number(rows[0]?.acquired) !== 1) throw new Error('Could not acquire content lock')
      acquired = true
      this.mutationConnection = connection
      return await mutation()
    } finally {
      this.mutationConnection = undefined
      if (acquired) {
        try {
          const [rows] = await connection.query<RowDataPacket[]>(
            'SELECT RELEASE_LOCK(?) AS released', [this.lockName]
          )
          if (Number(rows[0]?.released) !== 1) destroyConnection = true
        } catch {
          destroyConnection = true
        }
      }
      if (destroyConnection) connection.destroy()
      else connection.release()
    }
  }

  async get(key: string): Promise<ContentEntry | null> {
    const [rows] = await (this.mutationConnection ?? this.pool).query<ContentRecordRow[]>(
      `SELECT \`value\`, \`type\`, \`updated_at\` FROM ${this.table} WHERE \`key\` = ?`,
      [key]
    )
    const row = rows[0]
    if (!row) return null
    return { value: row.value, type: row.type, updatedAt: toISOString(row.updated_at) }
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    await (this.mutationConnection ?? this.pool).query(
      `INSERT INTO ${this.table} (\`key\`, \`value\`, \`type\`) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), \`type\` = VALUES(\`type\`)`,
      [key, value, type]
    )
  }

  async getAll(): Promise<ContentRecord> {
    const [rows] = await (this.mutationConnection ?? this.pool).query<ContentRow[]>(
      `SELECT \`key\`, \`value\`, \`type\`, \`updated_at\` FROM ${this.table}`
    )
    return Object.fromEntries(
      rows.map(row => [row.key, { value: row.value, type: row.type, updatedAt: toISOString(row.updated_at) }])
    )
  }

  async delete(key: string): Promise<void> {
    await (this.mutationConnection ?? this.pool).query(`DELETE FROM ${this.table} WHERE \`key\` = ?`, [key])
  }
}

function toISOString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}
