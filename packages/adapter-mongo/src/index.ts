import { MongoClient, type Db } from 'mongodb'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

export class MongoAdapter implements ContentAdapter {
  private client: MongoClient
  private dbName: string
  private collection: string
  private db!: Db

  constructor(uri: string, dbName = 'editable_ui', collection = 'content') {
    this.client = new MongoClient(uri)
    this.dbName = dbName
    this.collection = collection
  }

  async initialize(): Promise<void> {
    await this.client.connect()
    this.db = this.client.db(this.dbName)
    await this.db.collection(this.collection).createIndex({ key: 1 }, { unique: true })
  }

  async get(key: string): Promise<ContentEntry | null> {
    const doc = await this.db.collection(this.collection).findOne({ key })
    if (!doc) return null
    return { value: doc.value, type: doc.type, updatedAt: doc.updatedAt }
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    await this.db.collection(this.collection).updateOne(
      { key },
      { $set: { value, type, updatedAt: new Date().toISOString() } },
      { upsert: true }
    )
  }

  async getAll(): Promise<ContentRecord> {
    const docs = await this.db.collection(this.collection).find().toArray()
    return Object.fromEntries(
      docs.map(d => [d.key, { value: d.value, type: d.type, updatedAt: d.updatedAt }])
    )
  }

  async delete(key: string): Promise<void> {
    await this.db.collection(this.collection).deleteOne({ key })
  }
}
