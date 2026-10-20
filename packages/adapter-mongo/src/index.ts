import { MongoClient, type ClientSession, type Db } from 'mongodb'
import type { ContentAdapter, ContentEntry, ContentRecord, ContentType } from '@editable-ui/core'

export class MongoAdapter implements ContentAdapter {
  private client: MongoClient
  private dbName: string
  private collection: string
  private db!: Db
  private mutationSession?: ClientSession
  supportsCrossProcessMutationLock = false

  constructor(uri: string, dbName = 'editable_ui', collection = 'content') {
    this.client = new MongoClient(uri)
    this.dbName = dbName
    this.collection = collection
  }

  async initialize(): Promise<void> {
    await this.client.connect()
    this.db = this.client.db(this.dbName)
    const topology = await this.client.db('admin').command({ hello: 1 })
    this.supportsCrossProcessMutationLock = typeof topology.setName === 'string' || topology.msg === 'isdbgrid'
    await this.db.collection(this.collection).createIndex({ key: 1 }, { unique: true })
    if (this.supportsCrossProcessMutationLock) {
      try {
        await this.db.collection<{ _id: string; sequence: number }>('_editable_ui_locks').updateOne(
          { _id: `${this.collection}:content` },
          { $setOnInsert: { sequence: 0 } },
          { upsert: true }
        )
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error
      }
    }
  }

  async withSharedContentLock<T>(mutation: () => Promise<T>): Promise<T> {
    if (!this.supportsCrossProcessMutationLock) return mutation()
    const session = this.client.startSession()
    let result!: T
    try {
      await session.withTransaction(async () => {
        this.mutationSession = session
        try {
          await this.db.collection<{ _id: string; sequence: number }>('_editable_ui_locks').updateOne(
            { _id: `${this.collection}:content` },
            { $inc: { sequence: 1 } },
            { session }
          )
          result = await mutation()
          return result
        } finally {
          this.mutationSession = undefined
        }
      })
      return result
    } finally {
      this.mutationSession = undefined
      await session.endSession()
    }
  }

  async get(key: string): Promise<ContentEntry | null> {
    const doc = await this.db.collection(this.collection).findOne(
      { key }, this.mutationSession ? { session: this.mutationSession } : {}
    )
    if (!doc) return null
    return { value: doc.value, type: doc.type, updatedAt: doc.updatedAt }
  }

  async set(key: string, value: string, type: ContentType): Promise<void> {
    await this.db.collection(this.collection).updateOne(
      { key },
      { $set: { value, type, updatedAt: new Date().toISOString() } },
      { upsert: true, ...(this.mutationSession ? { session: this.mutationSession } : {}) }
    )
  }

  async getAll(): Promise<ContentRecord> {
    const docs = await this.db.collection(this.collection)
      .find({}, this.mutationSession ? { session: this.mutationSession } : {})
      .toArray()
    return Object.fromEntries(
      docs.map(d => [d.key, { value: d.value, type: d.type, updatedAt: d.updatedAt }])
    )
  }

  async delete(key: string): Promise<void> {
    await this.db.collection(this.collection).deleteOne(
      { key }, this.mutationSession ? { session: this.mutationSession } : {}
    )
  }
}
