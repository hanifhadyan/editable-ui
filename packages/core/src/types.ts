export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

export type ContentType = 'text' | 'richtext' | 'image' | 'link' | 'attribute' | 'collection' | 'collection-schema'

export type CollectionFieldType = 'text' | 'richtext' | 'image' | 'select'

export interface CollectionField {
  field: string
  label: string
  type?: CollectionFieldType
  visible?: boolean
  options?: string[] // for select type
}

export interface CollectionItem {
  id: string
  [key: string]: string
}

export interface GalleryImage {
  id: string
  src: string
  alt?: string
  caption?: string
}

export interface ContentEntry {
  value: string
  type: ContentType
  updatedAt: string
}

export interface ContentRecord {
  [key: string]: ContentEntry
}

export interface ContentAdapter {
  get(key: string): Promise<ContentEntry | null>
  set(key: string, value: string, type: ContentType): Promise<void>
  getAll(): Promise<ContentRecord>
  delete(key: string): Promise<void>
  initialize(): Promise<void>
  /** Serializes content mutations across processes that share this adapter's backing store. */
  withSharedContentLock?<T>(mutation: () => Promise<T>): Promise<T>
  /** Set to false when the backing store cannot provide a shared lock in this deployment. */
  supportsCrossProcessMutationLock?: boolean
}

export interface StorageAdapter {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>
  /** Returns true only for URLs created by this adapter; required for safe automatic cleanup. */
  owns?(url: string): boolean
  /** Checks whether an owned upload still exists; required for safe automatic cleanup. */
  exists?(url: string): Promise<boolean>
  delete(url: string): Promise<void>
}

export interface EditableConfig {
  isAdmin: boolean
}

export interface EditableContextValue {
  isAdmin: boolean
  content: ContentRecord
  setContent(key: string, value: string, type: ContentType, collectionSchema?: CollectionField[]): Promise<void>
  uploadImage(file: File): Promise<string>
  deleteImage(url: string): Promise<void>
}
