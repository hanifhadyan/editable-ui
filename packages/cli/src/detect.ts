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

export function detectAuthOptionsPath(router: Router, root = process.cwd()): string | undefined {
  const base = router === 'pages'
    ? ['pages/api/auth/[...nextauth]', 'src/pages/api/auth/[...nextauth]', 'src/lib/auth', 'lib/auth', 'src/auth', 'auth']
    : ['src/auth', 'auth', 'src/lib/auth', 'lib/auth', 'app/api/auth/[...nextauth]/route', 'src/app/api/auth/[...nextauth]/route']
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']

  for (const candidate of base) {
    for (const extension of extensions) {
      const file = path.resolve(root, `${candidate}${extension}`)
      if (!fs.existsSync(file)) continue
      const source = fs.readFileSync(file, 'utf-8')
      if (/\bexport\s+(?:const|let|var|function)\s+authOptions\b|\bexport\s*\{[^}]*\bauthOptions\b/s.test(source)) {
        return `./${candidate}`
      }
    }
  }
  return undefined
}
