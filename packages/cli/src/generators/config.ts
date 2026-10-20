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
  'next-auth': `import { getServerSession } from 'next-auth'`,
  clerk: `import { getAuth } from '@clerk/nextjs/server'`,
  custom: `// TODO: import your auth helper`,
}

function adminFunction(auth: InitOptions['auth'], useTypeScript: boolean): string {
  const requestType = useTypeScript ? ': any' : ''
  const responseParam = useTypeScript ? 'res?: any' : 'res'
  if (auth === 'next-auth') return `async (req${requestType}, ${responseParam}) => {
  const session = res
    ? await getServerSession(req, res, authOptions)
    : await getServerSession(authOptions)
  return session?.user?.role === 'admin'
}`
  if (auth === 'clerk') return `(req${requestType}) => {
  const { userId, orgRole } = getAuth(req)
  return !!userId && orgRole === 'org:admin'
}`
  return `(req${requestType}) => {
  // TODO: implement your admin check
  // e.g. verify JWT, check session, etc.
  return false
}`
}

export function generateConfig(opts: InitOptions, useTypeScript = true): string {
  const authImport = opts.auth === 'next-auth'
    ? `${AUTH_IMPORT[opts.auth]}\nimport { authOptions } from '${opts.authOptionsPath ?? (opts.router === 'pages' ? './pages/api/auth/[...nextauth]' : './auth')}'`
    : AUTH_IMPORT[opts.auth]
  const dbInit = useTypeScript ? DB_INIT[opts.db] : DB_INIT[opts.db].replace(/!/g, '')
  const storageInit = useTypeScript ? STORAGE_INIT[opts.storage] : STORAGE_INIT[opts.storage].replace(/!/g, '')
  return `${DB_IMPORT[opts.db]}
${STORAGE_IMPORT[opts.storage]}
${authImport}

export const adapter = ${dbInit}
export const storage = ${storageInit}

export const isAdmin = ${adminFunction(opts.auth, useTypeScript)}
`
}
