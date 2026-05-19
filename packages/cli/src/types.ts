export type DbAdapter = 'json' | 'pg' | 'mysql' | 'sqlite' | 'mongo'
export type StorageAdapter = 'local' | 's3' | 'r2' | 'minio'
export type AuthProvider = 'next-auth' | 'clerk' | 'custom'
export type Router = 'pages' | 'app'
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

export interface InitOptions {
  db: DbAdapter
  storage: StorageAdapter
  auth: AuthProvider
  router: Router
  packageManager: PackageManager
}
