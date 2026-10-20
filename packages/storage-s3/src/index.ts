import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import crypto from 'crypto'
import path from 'path'
import type { StorageAdapter } from '@editable-ui/core'

interface S3StorageOptions {
  bucket: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  endpoint?: string
  publicUrl?: string
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client
  private bucket: string
  private publicUrl: string

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket
    this.client = new S3Client({
      region: options.region ?? 'auto',
      endpoint: options.endpoint,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    })
    this.publicUrl =
      options.publicUrl ??
      (options.endpoint
        ? `${options.endpoint}/${options.bucket}`
        : `https://${options.bucket}.s3.${options.region ?? 'us-east-1'}.amazonaws.com`)
    this.publicUrl = this.publicUrl.replace(/\/+$/, '')
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    const ext = path.extname(filename)
    const key = `uploads/${crypto.randomBytes(8).toString('hex')}${ext}`
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType,
      })
    )
    return `${this.publicUrl}/${key}`
  }

  owns(url: string): boolean {
    const prefix = `${this.publicUrl}/uploads/`
    return url.startsWith(prefix) && /^[a-f0-9]{16}\.(?:png|jpg|gif|webp)$/.test(url.slice(prefix.length))
  }

  async exists(url: string): Promise<boolean> {
    if (!this.owns(url)) return false
    const key = url.slice(`${this.publicUrl}/`.length)
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch (error) {
      if (error && typeof error === 'object') {
        const response = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } }
        if (response.name === 'NotFound' || response.$metadata?.httpStatusCode === 404) return false
      }
      throw error
    }
  }

  async delete(url: string): Promise<void> {
    if (!this.owns(url)) return
    const key = url.slice(`${this.publicUrl}/`.length)
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }
}
