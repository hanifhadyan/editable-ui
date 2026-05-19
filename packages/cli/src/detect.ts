import fs from 'fs'
import path from 'path'
import type { PackageManager, Router } from './types'

export function detectPackageManager(): PackageManager {
  if (fs.existsSync(path.resolve('bun.lockb'))) return 'bun'
  if (fs.existsSync(path.resolve('pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.resolve('yarn.lock'))) return 'yarn'
  return 'npm'
}

export function detectRouter(): Router | null {
  if (fs.existsSync(path.resolve('app'))) return 'app'
  if (fs.existsSync(path.resolve('pages'))) return 'pages'
  return null
}

export function detectNextJs(): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
    return !!(pkg.dependencies?.next || pkg.devDependencies?.next)
  } catch {
    return false
  }
}

export function isTypeScript(): boolean {
  return fs.existsSync(path.resolve('tsconfig.json'))
}
