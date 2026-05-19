import fs from 'fs'
import path from 'path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { execa } from 'execa'
import type { InitOptions, DbAdapter, StorageAdapter, AuthProvider, Router } from './types'
import { detectPackageManager, detectRouter, detectNextJs, isTypeScript } from './detect'
import { resolvePackages } from './packages'
import { generateConfig } from './generators/config'
import { generatePagesContentRoute, generatePagesUploadRoute } from './generators/api-pages'
import { generateAppContentRoute, generateAppUploadRoute } from './generators/api-app'
import { generateEnvExample } from './generators/env'

async function main() {
  console.log('')
  p.intro(pc.bgCyan(pc.black(' editable-ui init ')))

  if (!detectNextJs()) {
    p.log.warn('No Next.js detected in package.json. editable-ui works best with Next.js.')
    const proceed = await p.confirm({ message: 'Continue anyway?' })
    if (p.isCancel(proceed) || !proceed) {
      p.outro('Cancelled.')
      process.exit(0)
    }
  }

  const detectedRouter = detectRouter()
  const detectedPm = detectPackageManager()
  const useTs = isTypeScript()
  const ext = useTs ? 'ts' : 'js'

  const db = await p.select<{ value: DbAdapter; label: string; hint: string }[], DbAdapter>({
    message: 'Which database adapter?',
    options: [
      { value: 'json', label: 'JSON file', hint: 'zero config — self-hosted only' },
      { value: 'pg', label: 'PostgreSQL', hint: 'pg / Supabase / Neon / PlanetScale' },
      { value: 'mysql', label: 'MySQL', hint: 'mysql2' },
      { value: 'sqlite', label: 'SQLite', hint: 'better-sqlite3 — local/embedded' },
      { value: 'mongo', label: 'MongoDB', hint: 'official mongodb driver' },
    ],
  })
  if (p.isCancel(db)) cancel()

  const storage = await p.select<{ value: StorageAdapter; label: string; hint: string }[], StorageAdapter>({
    message: 'Which image storage?',
    options: [
      { value: 'local', label: 'Local filesystem', hint: '/public/uploads — self-hosted only' },
      { value: 's3', label: 'AWS S3', hint: '@aws-sdk/client-s3' },
      { value: 'r2', label: 'Cloudflare R2', hint: 'S3-compatible, no egress fees' },
      { value: 'minio', label: 'MinIO', hint: 'self-hosted S3-compatible' },
    ],
  })
  if (p.isCancel(storage)) cancel()

  const auth = await p.select<{ value: AuthProvider; label: string; hint: string }[], AuthProvider>({
    message: 'Which auth provider?',
    options: [
      { value: 'next-auth', label: 'NextAuth.js', hint: 'most popular, flexible' },
      { value: 'clerk', label: 'Clerk', hint: 'hosted auth, zero config' },
      { value: 'custom', label: 'Custom', hint: "I'll wire it myself" },
    ],
  })
  if (p.isCancel(auth)) cancel()

  let router: Router
  if (detectedRouter) {
    router = detectedRouter
    p.log.info(`Detected ${router === 'app' ? 'App Router (app/)' : 'Pages Router (pages/)'}`)
  } else {
    const selected = await p.select<{ value: Router; label: string }[], Router>({
      message: 'Which Next.js router?',
      options: [
        { value: 'app', label: 'App Router (app/)' },
        { value: 'pages', label: 'Pages Router (pages/)' },
      ],
    })
    if (p.isCancel(selected)) cancel()
    router = selected as Router
  }

  const pm = await p.select<{ value: InitOptions['packageManager']; label: string }[], InitOptions['packageManager']>({
    message: 'Package manager?',
    initialValue: detectedPm,
    options: [
      { value: 'pnpm', label: 'pnpm' },
      { value: 'npm', label: 'npm' },
      { value: 'yarn', label: 'yarn' },
      { value: 'bun', label: 'bun' },
    ],
  })
  if (p.isCancel(pm)) cancel()

  const opts: InitOptions = {
    db: db as DbAdapter,
    storage: storage as StorageAdapter,
    auth: auth as AuthProvider,
    router,
    packageManager: pm as InitOptions['packageManager'],
  }

  const packages = resolvePackages(opts)

  p.log.step('Installing packages...')
  p.log.info(packages.join(', '))

  const installArgs = pm === 'npm'
    ? ['install', ...packages]
    : ['add', ...packages]

  const s = p.spinner()
  s.start('Installing...')
  try {
    await execa(pm, installArgs, { cwd: process.cwd() })
    s.stop('Packages installed.')
  } catch (err: any) {
    s.stop('Install failed.')
    p.log.error(err.message)
    process.exit(1)
  }

  // write editable.config.ts
  s.start('Generating files...')

  writeFile(`editable.config.${ext}`, generateConfig(opts))

  // write API routes
  if (router === 'pages') {
    const apiDir = path.resolve('pages', 'api', 'editable')
    fs.mkdirSync(apiDir, { recursive: true })
    writeFile(path.join('pages', 'api', 'editable', `content.${ext}`), generatePagesContentRoute())
    writeFile(path.join('pages', 'api', 'editable', `upload.${ext}`), generatePagesUploadRoute())
  } else {
    const apiDir = path.resolve('app', 'api', 'editable')
    fs.mkdirSync(path.join(apiDir, 'content'), { recursive: true })
    fs.mkdirSync(path.join(apiDir, 'upload'), { recursive: true })
    writeFile(path.join('app', 'api', 'editable', 'content', `route.${ext}`), generateAppContentRoute())
    writeFile(path.join('app', 'api', 'editable', 'upload', `route.${ext}`), generateAppUploadRoute())
  }

  // append .env.example
  const envContent = generateEnvExample(opts)
  if (envContent.trim()) {
    const envPath = path.resolve('.env.example')
    if (fs.existsSync(envPath)) {
      fs.appendFileSync(envPath, '\n' + envContent)
    } else {
      fs.writeFileSync(envPath, envContent)
    }
  }

  s.stop('Files generated.')

  p.log.success('Done!')
  console.log('')
  p.log.info('Files created:')
  p.log.info(`  editable.config.${ext}`)
  if (router === 'pages') {
    p.log.info(`  pages/api/editable/content.${ext}`)
    p.log.info(`  pages/api/editable/upload.${ext}`)
  } else {
    p.log.info(`  app/api/editable/content/route.${ext}`)
    p.log.info(`  app/api/editable/upload/route.${ext}`)
  }
  if (envContent.trim()) p.log.info('  .env.example (updated)')

  console.log('')
  p.log.info('Next steps:')
  p.log.info('  1. Copy .env.example to .env.local and fill in your values')
  p.log.info('  2. Wrap your app with <EditableProvider> from @editable-ui/core')
  p.log.info('  3. Use <EditableText>, <EditableRichText>, <EditableImage> in your pages')
  if (opts.auth === 'custom') {
    p.log.warn('  4. Implement isAdmin() in editable.config.' + ext)
  }
  console.log('')

  p.outro(pc.green('editable-ui ready. Start editing inline!'))
}

function writeFile(relPath: string, content: string) {
  const abs = path.resolve(relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf-8')
}

function cancel(): never {
  p.cancel('Cancelled.')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
