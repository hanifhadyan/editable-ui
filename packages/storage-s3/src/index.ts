import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
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

  async delete(url: string): Promise<void> {
    const key = url.replace(`${this.publicUrl}/`, '')
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }
}
