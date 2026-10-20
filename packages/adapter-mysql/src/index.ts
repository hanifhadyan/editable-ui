import mysql, { type Pool, type PoolOptions } from 'mysql2/promise'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

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

  constructor(config: PoolOptions | string, table = 'editable_content') {
    this.table = quoteTableName(table)
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

  async get(key: string): Promise<ContentEntry | null> {
    const [rows] = await this.pool.query(
      `SELECT \`value\`, \`type\`, \`updated_at\` FROM ${this.table} WHERE \`key\` = ?`,
      [key]
    ) as [any[], any]
    const row = rows[0]
    if (!row) return null
    return { value: row.value, type: row.type, updatedAt: row.updated_at }
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.table} (\`key\`, \`value\`, \`type\`) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), \`type\` = VALUES(\`type\`)`,
      [key, value, type]
    )
  }

  async getAll(): Promise<ContentRecord> {
    const [rows] = await this.pool.query(
      `SELECT \`key\`, \`value\`, \`type\`, \`updated_at\` FROM ${this.table}`
    ) as [any[], any]
    return Object.fromEntries(
      rows.map((r: any) => [r.key, { value: r.value, type: r.type, updatedAt: r.updated_at }])
    )
  }

  async delete(key: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.table} WHERE \`key\` = ?`, [key])
  }
}
