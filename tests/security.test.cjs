const assert = require('node:assert/strict')
const fs = require('node:fs')
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
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
