import type { InitOptions } from '../types'

const DB_IMPORT: Record<string, string> = {
  json: `import { JsonAdapter } from '@editable-ui/adapter-json'`,
  pg: `import { PostgresAdapter } from '@editable-ui/adapter-pg'`,
  mysql: `import { MySQLAdapter } from '@editable-ui/adapter-mysql'`,
  sqlite: `import { SQLiteAdapter } from '@editable-ui/adapter-sqlite'`,
  mongo: `import { MongoAdapter } from '@editable-ui/adapter-mongo'`,
}

const DB_INIT: Record<string, string> = {
  json: `new JsonAdapter('./data/content.json')`,
  pg: `new PostgresAdapter(process.env.DATABASE_URL!)`,
  mysql: `new MySQLAdapter(process.env.DATABASE_URL!)`,
  sqlite: `new SQLiteAdapter('./data/content.db')`,
  mongo: `new MongoAdapter(process.env.MONGODB_URI!)`,
}

const STORAGE_IMPORT: Record<string, string> = {
  local: `import { LocalStorageAdapter } from '@editable-ui/storage-local'`,
  s3: `import { S3StorageAdapter } from '@editable-ui/storage-s3'`,
  r2: `import { S3StorageAdapter } from '@editable-ui/storage-s3'`,
  minio: `import { S3StorageAdapter } from '@editable-ui/storage-s3'`,
}

const STORAGE_INIT: Record<string, string> = {
  local: `new LocalStorageAdapter({ dir: './public/uploads', publicPath: '/uploads' })`,
  s3: `new S3StorageAdapter({
  bucket: process.env.S3_BUCKET!,
  region: process.env.S3_REGION!,
  accessKeyId: process.env.S3_ACCESS_KEY!,
  secretAccessKey: process.env.S3_SECRET_KEY!,
})`,
  r2: `new S3StorageAdapter({
  bucket: process.env.R2_BUCKET!,
  region: 'auto',
  accessKeyId: process.env.R2_ACCESS_KEY!,
  secretAccessKey: process.env.R2_SECRET_KEY!,
  endpoint: process.env.R2_ENDPOINT!,
})`,
  minio: `new S3StorageAdapter({
  bucket: process.env.MINIO_BUCKET!,
  region: 'us-east-1',
  accessKeyId: process.env.MINIO_ACCESS_KEY!,
  secretAccessKey: process.env.MINIO_SECRET_KEY!,
  endpoint: process.env.MINIO_ENDPOINT!,
})`,
}

const AUTH_IMPORT: Record<string, string> = {
  'next-auth': `import { getServerSession } from 'next-auth'
import { authOptions } from './pages/api/auth/[...nextauth]'`,
  clerk: `import { getAuth } from '@clerk/nextjs/server'`,
  custom: `// TODO: import your auth helper`,
}

const IS_ADMIN_FN: Record<string, string> = {
  'next-auth': `async (req: any, res: any) => {
  const session = await getServerSession(req, res, authOptions)
  return session?.user?.role === 'admin'
}`,
  clerk: `(req: any) => {
  const { userId, orgRole } = getAuth(req)
  return !!userId && orgRole === 'org:admin'
}`,
  custom: `(req: any) => {
  // TODO: implement your admin check
  // e.g. verify JWT, check session, etc.
  return false
}`,
}

export function generateConfig(opts: InitOptions): string {
  return `${DB_IMPORT[opts.db]}
${STORAGE_IMPORT[opts.storage]}
${AUTH_IMPORT[opts.auth]}

export const adapter = ${DB_INIT[opts.db]}
export const storage = ${STORAGE_INIT[opts.storage]}

export const isAdmin = ${IS_ADMIN_FN[opts.auth]}
`
}
