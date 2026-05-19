import type { InitOptions } from '../types'

const DB_ENV: Record<string, string[]> = {
  json: [],
  pg: ['DATABASE_URL=postgresql://user:password@localhost:5432/mydb'],
  mysql: ['DATABASE_URL=mysql://user:password@localhost:3306/mydb'],
  sqlite: [],
  mongo: ['MONGODB_URI=mongodb://localhost:27017/mydb'],
}

const STORAGE_ENV: Record<string, string[]> = {
  local: [],
  s3: [
    'S3_BUCKET=your-bucket-name',
    'S3_REGION=us-east-1',
    'S3_ACCESS_KEY=your-access-key',
    'S3_SECRET_KEY=your-secret-key',
  ],
  r2: [
    'R2_BUCKET=your-bucket-name',
    'R2_ACCESS_KEY=your-access-key',
    'R2_SECRET_KEY=your-secret-key',
    'R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com',
  ],
  minio: [
    'MINIO_BUCKET=your-bucket-name',
    'MINIO_ACCESS_KEY=your-access-key',
    'MINIO_SECRET_KEY=your-secret-key',
    'MINIO_ENDPOINT=http://localhost:9000',
  ],
}

const AUTH_ENV: Record<string, string[]> = {
  'next-auth': [
    'NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32',
    'NEXTAUTH_URL=http://localhost:3000',
  ],
  clerk: [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...',
    'CLERK_SECRET_KEY=sk_test_...',
  ],
  custom: [],
}

export function generateEnvExample(opts: InitOptions): string {
  const lines = [
    '# editable-ui',
    ...DB_ENV[opts.db],
    ...STORAGE_ENV[opts.storage],
    ...AUTH_ENV[opts.auth],
  ]
  return lines.join('\n') + '\n'
}
