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
}

export interface StorageAdapter {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>
  delete(url: string): Promise<void>
}

export interface EditableConfig {
  isAdmin: boolean
  adapter?: ContentAdapter
  storage?: StorageAdapter
}

export interface EditableContextValue {
  isAdmin: boolean
  content: ContentRecord
  setContent(key: string, value: string, type: ContentType): Promise<void>
  uploadImage(file: File): Promise<string>
}
