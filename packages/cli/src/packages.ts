import type { InitOptions } from './types'

const DB_PACKAGES: Record<string, string[]> = {
  json: ['@editable-ui/adapter-json'],
  pg: ['@editable-ui/adapter-pg'],
  mysql: ['@editable-ui/adapter-mysql'],
  sqlite: ['@editable-ui/adapter-sqlite'],
  mongo: ['@editable-ui/adapter-mongo'],
}

const STORAGE_PACKAGES: Record<string, string[]> = {
  local: ['@editable-ui/storage-local'],
  s3: ['@editable-ui/storage-s3'],
  r2: ['@editable-ui/storage-s3'],
  minio: ['@editable-ui/storage-s3'],
}

const AUTH_PACKAGES: Record<string, string[]> = {
  'next-auth': ['next-auth'],
  clerk: ['@clerk/nextjs'],
  custom: [],
}

export function resolvePackages(opts: InitOptions): string[] {
  return [
    '@editable-ui/core',
    '@editable-ui/next',
    ...DB_PACKAGES[opts.db],
    ...STORAGE_PACKAGES[opts.storage],
    ...AUTH_PACKAGES[opts.auth],
  ]
}

export function installCommand(pm: InitOptions['packageManager'], packages: string[]): string {
  const pkg = packages.join(' ')
  switch (pm) {
    case 'yarn': return `yarn add ${pkg}`
    case 'pnpm': return `pnpm add ${pkg}`
    case 'bun': return `bun add ${pkg}`
    default: return `npm install ${pkg}`
  }
}
