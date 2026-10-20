const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const core = require('../packages/core/dist/index.js')
const next = require('../packages/next/dist/index.js')
const React = require('../packages/core/node_modules/react')
const { renderToStaticMarkup } = require('../packages/core/node_modules/react-dom/server')

function loadTypeScriptModule(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(require, module, module.exports)
  return module.exports
}

test('rich text output keeps editor markup and removes executable HTML', () => {
  assert.equal(typeof core.sanitizeRichText, 'function')

  const html = core.sanitizeRichText(
    '<p style="text-align: center" onclick="alert(1)">Safe <strong>text</strong><script>alert(1)</script><a href="javascript:alert(1)">link</a></p>'
  )

  assert.match(html, /<p[^>]*text-align:\s*center/i)
  assert.match(html, /<strong>text<\/strong>/)
  assert.doesNotMatch(html, /script|onclick|javascript:/i)

  const unsafeStyle = core.sanitizeRichText('<p style="background-image:url(https://attacker.example/track);text-align:center">x</p>')
  assert.doesNotMatch(unsafeStyle, /background-image|attacker\.example/i)
})

test('JSON adapter creates missing storage but preserves malformed existing data', async () => {
  const { JsonAdapter } = require('../packages/adapter-json/dist/index.js')
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'editable-ui-json-'))
  const missingPath = path.join(directory, 'new', 'content.json')
  const missing = new JsonAdapter(missingPath)
  await missing.initialize()
  assert.deepEqual(await missing.getAll(), {})
  assert.equal(await fsp.readFile(missingPath, 'utf8'), '{}')

  const brokenPath = path.join(directory, 'broken.json')
  await fsp.writeFile(brokenPath, '{ invalid json')
  const broken = new JsonAdapter(brokenPath)
  await assert.rejects(broken.initialize(), SyntaxError)
  assert.equal(await fsp.readFile(brokenPath, 'utf8'), '{ invalid json')
})

test('legacy rich text is sanitized before rendering', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      core.EditableProvider,
      {
        isAdmin: false,
        initialContent: {
          body: {
            value: '<p onclick="alert(1)">Safe<img src=x onerror="alert(2)"><a href="javascript:alert(3)">link</a></p>',
            type: 'richtext',
            updatedAt: '',
          },
        },
      },
      React.createElement(core.EditableRichText, { contentKey: 'body' })
    )
  )

  assert.match(html, /<p>Safe/)
  assert.doesNotMatch(html, /onclick|onerror|javascript:|<img/i)
})

test('content writes reject cross-origin and non-JSON requests', async () => {
  const writes = []
  const handler = next.createContentHandler({
    adapter: {
      get: async () => null,
      set: async (...args) => writes.push(args),
      getAll: async () => ({}),
      delete: async () => {},
      initialize: async () => {},
    },
    isAdmin: () => true,
  })

  const invoke = async (headers) => {
    const response = {
      statusCode: 0,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
    }
    await handler({
      method: 'POST',
      headers: { host: 'example.com', 'x-forwarded-proto': 'https', ...headers },
      body: { key: 'body', value: '<p>safe</p>', type: 'richtext' },
    }, response)
    return response
  }

  assert.equal((await invoke({
    origin: 'https://attacker.example',
    'sec-fetch-site': 'cross-site',
    'content-type': 'application/json',
  })).statusCode, 403)
  assert.equal((await invoke({
    origin: 'https://example.com/path',
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json',
  })).statusCode, 403)
  assert.equal((await invoke({
    origin: 'https://example.com',
    'sec-fetch-site': 'same-origin',
    'content-type': 'text/plain',
  })).statusCode, 415)
  assert.equal(writes.length, 0)
})

test('same-origin checks normalize the first forwarded host and protocol', () => {
  assert.equal(next.isSameOriginRequest({
    url: '/api/editable/content',
    headers: {
      origin: 'https://example.com',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-host': 'example.com, internal.example',
      'x-forwarded-proto': 'https, http',
    },
  }), true)
})

test('rich text is sanitized before saving and content reads remain admin-only', async () => {
  const writes = []
  let reads = 0
  const adapter = {
    get: async () => null,
    set: async (...args) => writes.push(args),
    getAll: async () => { reads++; return {} },
    delete: async () => {},
    initialize: async () => {},
  }
  const headers = {
    host: 'example.com',
    'x-forwarded-proto': 'https',
    origin: 'https://example.com',
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json',
  }
  const response = {
    statusCode: 0,
    headers: {},
    status(code) { this.statusCode = code; return this },
    setHeader(name, value) { this.headers[name] = value },
    json(body) { this.body = body; return this },
  }
  const handler = next.createContentHandler({ adapter, isAdmin: () => true })

  await handler({
    method: 'POST',
    headers,
    body: { key: 'body', value: '<p onclick="alert(1)">safe<script>bad</script></p>', type: 'richtext' },
  }, response)
  assert.equal(response.statusCode, 200)
  assert.equal(writes[0][1], '<p>safe</p>')

  const adminResponse = { ...response, statusCode: 0, headers: {} }
  await handler({ method: 'GET', headers }, adminResponse)
  assert.equal(adminResponse.headers['Cache-Control'], 'private, no-store')
  assert.equal(reads, 1)

  const publicHandler = next.createContentHandler({ adapter, isAdmin: () => false })
  const publicResponse = { ...response, statusCode: 0 }
  await publicHandler({ method: 'GET', headers }, publicResponse)
  assert.equal(publicResponse.statusCode, 403)
  assert.equal(reads, 1)
})

test('collection rich text fields are sanitized before persistence', async () => {
  const { sanitizeCollectionValue } = core
  assert.equal(typeof sanitizeCollectionValue, 'function')

  const records = new Map()
  const adapter = {
    get: async key => records.get(key) ?? null,
    set: async (key, value, type) => records.set(key, { value, type, updatedAt: '' }),
    getAll: async () => Object.fromEntries(records),
    delete: async key => records.delete(key),
    initialize: async () => {},
  }
  const handler = next.createContentHandler({ adapter, isAdmin: () => true })
  const response = {
    statusCode: 0,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }

  await handler({
    method: 'POST',
    headers: {
      host: 'example.com',
      'x-forwarded-proto': 'https',
      origin: 'https://example.com',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: {
      key: 'articles',
      type: 'collection',
      schema: [{ field: 'description', label: 'Description', type: 'richtext' }],
      value: JSON.stringify([{ id: '1', description: '<p onclick="alert(1)">Safe<script>bad</script></p>' }]),
    },
  }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(records.get('articles').value)[0].description, '<p>Safe</p>')
  assert.equal(records.get('articles.__schema').type, 'collection-schema')
})

test('replaced and deleted content removes only owned uploads with no remaining references', async () => {
  const records = new Map([
    ['hero', { value: '/uploads/0123456789abcdef.png', type: 'image', updatedAt: '' }],
    ['gallery', { value: JSON.stringify([{ id: '1', src: '/uploads/0123456789abcdef.png' }]), type: 'collection', updatedAt: '' }],
  ])
  const deleted = []
  const adapter = {
    withSharedContentLock: async mutation => mutation(),
    get: async key => records.get(key) ?? null,
    set: async (key, value, type) => records.set(key, { value, type, updatedAt: '' }),
    getAll: async () => Object.fromEntries(records),
    delete: async key => records.delete(key),
    initialize: async () => {},
  }
  const storage = {
    owns: url => /^\/uploads\/[a-f0-9]{16}\.png$/.test(url),
    exists: async () => true,
    upload: async () => '/uploads/fedcba9876543210.png',
    delete: async url => deleted.push(url),
  }
  const handler = next.createContentHandler({ adapter, storage, isAdmin: () => true })
  const invoke = async (method, body) => {
    const response = {
      statusCode: 0,
      status(code) { this.statusCode = code; return this },
      json(result) { this.body = result; return this },
    }
    await handler({
      method,
      headers: {
        host: 'example.com',
        'x-forwarded-proto': 'https',
        origin: 'https://example.com',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      },
      body,
    }, response)
    return response
  }

  await invoke('POST', { key: 'hero', type: 'image', value: 'https://external.example/new.png' })
  assert.deepEqual(deleted, [])
  await invoke('DELETE', { key: 'gallery' })
  assert.deepEqual(deleted, ['/uploads/0123456789abcdef.png'])
})

test('upload cleanup cannot race a write from another adapter instance', async () => {
  const records = new Map([
    ['hero', { value: '/uploads/0123456789abcdef.png', type: 'image', updatedAt: '' }],
  ])
  let lockTail = Promise.resolve()
  let lockCalls = 0
  let markSecondLockAttempted
  const secondLockAttempted = new Promise(resolve => { markSecondLockAttempted = resolve })
  const createAdapter = () => ({
    withSharedContentLock: async mutation => {
      if (++lockCalls === 3) markSecondLockAttempted()
      const previous = lockTail
      let release
      lockTail = new Promise(resolve => { release = resolve })
      await previous
      try { return await mutation() } finally { release() }
    },
    get: async key => records.get(key) ?? null,
    set: async (key, value, type) => records.set(key, { value, type, updatedAt: '' }),
    getAll: async () => Object.fromEntries(records),
    delete: async key => records.delete(key),
    initialize: async () => {},
  })
  const adapterA = createAdapter()
  const adapterB = createAdapter()
  let uploadExists = true
  let markDeleteStarted
  let finishDelete
  const deleteStarted = new Promise(resolve => { markDeleteStarted = resolve })
  const deleteGate = new Promise(resolve => { finishDelete = resolve })
  const storage = {
    owns: url => url.startsWith('/uploads/'),
    exists: async () => uploadExists,
    upload: async () => '/uploads/fedcba9876543210.png',
    delete: async () => {
      markDeleteStarted()
      await deleteGate
      uploadExists = false
    },
  }

  const deleting = next.deleteContent(adapterA, storage, 'hero')
  await deleteStarted
  let writerFinished = false
  const writing = next.writeContent(adapterB, storage, 'gallery', '/uploads/0123456789abcdef.png', 'image')
    .finally(() => { writerFinished = true })
  await secondLockAttempted
  assert.equal(writerFinished, false)
  finishDelete()
  await deleting

  await assert.rejects(writing, /upload no longer exists/i)
  assert.equal(records.has('gallery'), false)
  assert.equal(uploadExists, false)
})

test('upload cleanup is skipped without shared locking or an existence check', async () => {
  const deleted = []
  const adapter = {
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
    delete: async () => {},
    initialize: async () => {},
  }
  const storage = {
    owns: () => true,
    exists: async () => true,
    upload: async () => '/uploads/0123456789abcdef.png',
    delete: async url => deleted.push(url),
  }
  assert.equal(await next.deleteUnreferencedUpload(adapter, storage, '/uploads/0123456789abcdef.png'), false)

  const lockedAdapter = { ...adapter, withSharedContentLock: async mutation => mutation() }
  const uncheckedStorage = { ...storage, exists: undefined }
  assert.equal(await next.deleteUnreferencedUpload(lockedAdapter, uncheckedStorage, '/uploads/0123456789abcdef.png'), false)
  assert.deepEqual(deleted, [])
})

test('upload cleanup can run inside an existing content lock', async () => {
  let locked = false
  let lockCount = 0
  const deleted = []
  const adapter = {
    withSharedContentLock: async mutation => {
      if (locked) throw new Error('nested content lock')
      locked = true
      lockCount++
      try { return await mutation() } finally { locked = false }
    },
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
    delete: async () => {},
    initialize: async () => {},
  }
  const storage = {
    owns: () => true,
    exists: async () => true,
    upload: async () => '/uploads/0123456789abcdef.png',
    delete: async url => deleted.push(url),
  }

  const result = await next.withContentMutationLock(adapter, () =>
    next.deleteUnreferencedUpload(adapter, storage, '/uploads/0123456789abcdef.png')
  )
  assert.equal(result, true)
  assert.equal(lockCount, 1)
  assert.deepEqual(deleted, ['/uploads/0123456789abcdef.png'])
})

test('SQLite shared content locks serialize separate adapter instances', async () => {
  const { SQLiteAdapter } = require('../packages/adapter-sqlite/dist/index.js')
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'editable-ui-lock-'))
  const databasePath = path.join(directory, 'content.db')
  const firstAdapter = new SQLiteAdapter(databasePath)
  const secondAdapter = new SQLiteAdapter(databasePath)
  await firstAdapter.initialize()
  await secondAdapter.initialize()

  const entered = []
  let startFirst
  let finishFirst
  const firstStarted = new Promise(resolve => { startFirst = resolve })
  const firstGate = new Promise(resolve => { finishFirst = resolve })
  const first = firstAdapter.withSharedContentLock(async () => {
    entered.push('first')
    startFirst()
    await firstGate
  })
  await firstStarted
  const second = secondAdapter.withSharedContentLock(async () => entered.push('second'))
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.deepEqual(entered, ['first'])

  finishFirst()
  await Promise.all([first, second])
  assert.deepEqual(entered, ['first', 'second'])
  firstAdapter.db.close()
  secondAdapter.db.close()
  await fsp.rm(directory, { recursive: true, force: true })
})

test('storage adapters reject deletion URLs outside their generated upload namespace', async () => {
  const { LocalStorageAdapter } = require('../packages/storage-local/dist/index.js')
  const { S3StorageAdapter } = require('../packages/storage-s3/dist/index.js')
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'editable-ui-uploads-'))
  const local = new LocalStorageAdapter({ dir: directory, publicPath: '/uploads' })
  const ownedUrl = await local.upload(Buffer.from('image'), 'source.png', 'image/png')
  const ownedPath = path.join(directory, path.basename(ownedUrl))
  const protectedPath = path.join(directory, 'keep.png')
  await fsp.writeFile(protectedPath, 'keep')

  assert.equal(local.owns(ownedUrl), true)
  assert.equal(await local.exists(ownedUrl), true)
  assert.equal(local.owns(`https://external.example${ownedUrl}`), false)
  assert.equal(await local.exists('/uploads/keep.png'), false)
  assert.equal(local.owns('/uploads/keep.png'), false)
  await local.delete(`https://external.example${ownedUrl}`)
  await local.delete('/uploads/keep.png')
  assert.equal(await fsp.readFile(ownedPath, 'utf8'), 'image')
  assert.equal(await fsp.readFile(protectedPath, 'utf8'), 'keep')
  await local.delete(ownedUrl)
  await assert.rejects(fsp.readFile(ownedPath), { code: 'ENOENT' })

  const s3 = new S3StorageAdapter({ bucket: 'assets', region: 'us-east-1' })
  assert.equal(s3.owns('https://assets.s3.us-east-1.amazonaws.com/uploads/0123456789abcdef.png'), true)
  assert.equal(s3.owns('https://external.example/uploads/0123456789abcdef.png'), false)
  await s3.delete('https://external.example/uploads/0123456789abcdef.png')
})

test('Pages Router auth receives both request and response objects', async () => {
  let authResponse
  const handler = next.createContentHandler({
    adapter: {
      get: async () => null,
      set: async () => {},
      getAll: async () => ({}),
      delete: async () => {},
      initialize: async () => {},
    },
    isAdmin: (_req, res) => { authResponse = res; return true },
  })
  const response = {
    statusCode: 0,
    headers: {},
    status(code) { this.statusCode = code; return this },
    setHeader(name, value) { this.headers[name] = value },
    json(body) { this.body = body; return this },
  }

  await handler({ method: 'GET', headers: { host: 'example.com' } }, response)
  assert.equal(authResponse, response)
})

test('adapter initialization is shared across concurrent calls and retries after failure', async () => {
  let calls = 0
  let finishInitialization
  const initialize = next.createInitializer(() => {
    calls++
    return new Promise(resolve => { finishInitialization = resolve })
  })

  const first = initialize()
  const second = initialize()
  assert.equal(calls, 1)
  assert.equal(first, second)
  finishInitialization()
  await Promise.all([first, second])
  assert.equal(initialize(), first)

  let attempts = 0
  const retry = next.createInitializer(async () => {
    if (++attempts === 1) throw new Error('temporary initialization failure')
  })
  await assert.rejects(retry(), /temporary initialization failure/)
  await retry()
  assert.equal(attempts, 2)
})

test('image uploads use detected raster type and reject active or oversized files', async () => {
  const uploads = []
  const handler = next.createUploadHandler({
    storage: {
      upload: async (...args) => {
        uploads.push(args)
        return '/uploads/image.png'
      },
      delete: async () => {},
    },
    isAdmin: () => true,
  })
  const invoke = async (file, overrideHeaders = {}) => {
    const response = {
      statusCode: 0,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this },
    }
    await handler({
      method: 'POST',
      headers: {
        host: 'example.com',
        'x-forwarded-proto': 'https',
        origin: 'https://example.com',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
        ...overrideHeaders,
      },
      body: { file, filename: '../../page.html', mimeType: 'text/html' },
    }, response)
    return response
  }

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')
  assert.equal((await invoke(png)).statusCode, 200)
  assert.equal(uploads[0][1].endsWith('.png'), true)
  assert.equal(uploads[0][2], 'image/png')
  assert.equal((await invoke(png, { origin: 'https://attacker.example' })).statusCode, 403)

  const svg = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')
  assert.equal((await invoke(svg)).statusCode, 415)
  assert.equal((await invoke('A'.repeat(14 * 1024 * 1024))).statusCode, 413)
  assert.equal(uploads.length, 1)
})

test('App Router JSON parsing enforces the actual streamed byte limit', async () => {
  const request = new Request('https://example.com/api/editable/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file: '12345678' }),
  })
  assert.equal(request.headers.has('content-length'), false)
  await assert.rejects(next.readJsonBody(request, 8), error => error.statusCode === 413)
})

test('App Router JSON parsing requires an object body', async () => {
  for (const body of ['null', '[]', 'false', '"text"']) {
    const request = new Request('https://example.com/api/editable/content', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
    await assert.rejects(next.readJsonBody(request, 64), error => error.statusCode === 400)
  }
})

test('generated App Router routes use shared origin and body validation', () => {
  const { generateAppContentRoute, generateAppUploadRoute } = loadTypeScriptModule(
    'packages/cli/src/generators/api-app.ts'
  )
  const contentRoute = generateAppContentRoute()
  const uploadRoute = generateAppUploadRoute()

  assert.match(contentRoute, /isSameOriginRequest/)
  assert.match(contentRoute, /readJsonBody/)
  assert.match(contentRoute, /createInitializer/)
  assert.match(contentRoute, /dynamic = 'force-dynamic'/)
  assert.match(contentRoute, /Cache-Control.*private, no-store/)
  assert.match(uploadRoute, /MAX_UPLOAD_REQUEST_SIZE/)
  assert.match(uploadRoute, /storeUploadedImage/)
  assert.doesNotMatch(contentRoute + uploadRoute, /isAdmin\(req as any, \{\} as any\)/)
})

test('JavaScript CLI templates contain no TypeScript syntax and use the selected auth module', () => {
  const { generateAppContentRoute, generateAppUploadRoute } = loadTypeScriptModule(
    'packages/cli/src/generators/api-app.ts'
  )
  const { generateConfig } = loadTypeScriptModule('packages/cli/src/generators/config.ts')
  const options = {
    db: 'json', storage: 'local', auth: 'next-auth', router: 'app',
    packageManager: 'pnpm', authOptionsPath: './src/auth-options',
  }
  const generated = [
    generateConfig(options, false),
    generateAppContentRoute(false),
    generateAppUploadRoute(false),
  ]

  for (const source of generated) {
    const parsed = ts.createSourceFile('generated.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    assert.deepEqual(parsed.parseDiagnostics, [])
  }
  assert.match(generated[0], /from ['"]\.\/src\/auth-options['"]/)
  assert.doesNotMatch(generated.join('\n'), /\bas any\b|:\s*(?:any|Promise<)|process\.env\.[A-Z_]+!/)
})

test('CLI detects the authOptions export in the selected router project', async () => {
  const { detectAuthOptionsPath } = loadTypeScriptModule('packages/cli/src/detect.ts')
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'editable-ui-auth-'))
  await fsp.mkdir(path.join(directory, 'src', 'app'), { recursive: true })
  await fsp.writeFile(path.join(directory, 'src', 'auth.ts'), 'export const authOptions = {}')
  assert.equal(detectAuthOptionsPath('app', directory), './src/auth')

  await fsp.mkdir(path.join(directory, 'pages', 'api', 'auth'), { recursive: true })
  await fsp.writeFile(path.join(directory, 'pages', 'api', 'auth', '[...nextauth].js'), 'export { authOptions } from "../../auth-options"')
  assert.equal(detectAuthOptionsPath('pages', directory), './pages/api/auth/[...nextauth]')
})

test('CLI preflight refuses generated-file conflicts and environment updates are idempotent', () => {
  const { findConflictingFiles, generatedFilePaths, mergeEnvExample, normalizeAuthOptionsPath } = loadTypeScriptModule(
    'packages/cli/src/files.ts'
  )
  const paths = generatedFilePaths('app', 'js')
  assert.deepEqual(paths, [
    'editable.config.js',
    'app/api/editable/content/route.js',
    'app/api/editable/upload/route.js',
  ])
  assert.deepEqual(findConflictingFiles(paths, file => file === paths[1]), [paths[1]])
  assert.equal(normalizeAuthOptionsPath('src/auth-options.ts'), './src/auth-options')
  assert.equal(normalizeAuthOptionsPath('../outside/auth'), undefined)

  const first = mergeEnvExample('', '# editable-ui\nS3_BUCKET=example\nS3_REGION=us-east-1\n')
  const second = mergeEnvExample(first, '# editable-ui\nS3_BUCKET=example\nS3_SECRET_KEY=secret\n')
  assert.equal(second, '# editable-ui\nS3_BUCKET=example\nS3_REGION=us-east-1\nS3_SECRET_KEY=secret\n')
  assert.equal(mergeEnvExample(second, '# editable-ui\nS3_SECRET_KEY=secret\n'), second)
})

test('generated Pages upload route allows base64 overhead for 10 MiB files', () => {
  const { generatePagesContentRoute, generatePagesUploadRoute } = loadTypeScriptModule(
    'packages/cli/src/generators/api-pages.ts'
  )

  assert.match(generatePagesUploadRoute(), /sizeLimit: '14mb'/)
  assert.doesNotMatch(generatePagesContentRoute(), /adapter\.initialize\(\)/)
})

test('generated NextAuth config supports App Router session lookup', () => {
  const { generateConfig } = loadTypeScriptModule('packages/cli/src/generators/config.ts')
  const config = generateConfig({ db: 'json', storage: 'local', auth: 'next-auth', router: 'app', packageManager: 'pnpm' })

  assert.match(config, /res\s*\?\s*await getServerSession\(req, res, authOptions\)\s*:\s*await getServerSession\(authOptions\)/)
})

test('SQL adapters reject injectable table names before opening a connection', () => {
  const { PostgresAdapter } = require('../packages/adapter-pg/dist/index.js')
  const { MySQLAdapter } = require('../packages/adapter-mysql/dist/index.js')
  const { SQLiteAdapter } = require('../packages/adapter-sqlite/dist/index.js')
  const maliciousName = 'content; DROP TABLE editable_content;--'

  assert.doesNotThrow(() => new PostgresAdapter('postgres://invalid', 'public.editable_content'))
  assert.doesNotThrow(() => new MySQLAdapter('mysql://invalid', 'db.editable_content'))
  for (const createAdapter of [
    () => new PostgresAdapter('postgres://invalid', maliciousName),
    () => new MySQLAdapter('mysql://invalid', maliciousName),
    () => new SQLiteAdapter(':memory:', maliciousName),
  ]) {
    assert.throws(createAdapter, /Invalid SQL table name/)
  }
})
