# editable-ui

Inline visual editing plugin for React/Next.js. Edit text, rich text, and images directly on the page — no admin panel needed.

## How it works

Wrap any element with an `Editable` component. When logged in as admin, hover shows an edit icon. Click to edit in place. Changes save to your chosen storage.

```tsx
<EditableText contentKey="hero.title" as="h1" className="text-4xl font-bold">
  Welcome to our site
</EditableText>

<EditableRichText contentKey="about.body" as="div" className="prose" />

<EditableImage contentKey="hero.image" src="/default.jpg" alt="Hero" className="w-full" />
```

## Installation

### CLI (recommended)

Run in your existing Next.js project:

```bash
npx @editable-ui/cli init
```

Interactive prompts will ask:
- Which database adapter (JSON / PostgreSQL / MySQL / SQLite / MongoDB)
- Which image storage (local filesystem / AWS S3 / Cloudflare R2 / MinIO)
- Which auth provider (NextAuth.js / Clerk / Custom)
- Which Next.js router (auto-detected)

Then automatically installs required packages, generates `editable.config.ts`, API routes, and `.env.example`.

After init, wrap your app and start using components — see [Usage](#usage) below.

### Manual install

<details>
<summary>Expand for manual steps</summary>

Install only the packages you need:

```bash
# core (required)
npm install @editable-ui/core @editable-ui/next

# pick one DB adapter
npm install @editable-ui/adapter-json    # JSON file (zero config)
npm install @editable-ui/adapter-pg      # PostgreSQL
npm install @editable-ui/adapter-mysql   # MySQL
npm install @editable-ui/adapter-sqlite  # SQLite
npm install @editable-ui/adapter-mongo   # MongoDB

# pick one image storage
npm install @editable-ui/storage-local   # local filesystem
npm install @editable-ui/storage-s3      # S3 / R2 / MinIO
```

</details>

---

## Usage

### 1. Wrap your app

```tsx
// pages/_app.tsx  (or app/layout.tsx for App Router)
import { EditableProvider } from '@editable-ui/core'
import { adapter, storage } from '../editable.config'
import { useSession } from 'next-auth/react'

export default function App({ Component, pageProps }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  return (
    <EditableProvider isAdmin={isAdmin} adapter={adapter} storage={storage}>
      <Component {...pageProps} />
    </EditableProvider>
  )
}
```

### 2. Use in your pages

```tsx
import { EditableText, EditableRichText, EditableImage } from '@editable-ui/core'

export default function AboutPage() {
  return (
    <main>
      <EditableText
        contentKey="about.title"
        as="h1"
        className="text-5xl font-bold"
        defaultValue="About Us"
      />
      <EditableRichText
        contentKey="about.body"
        as="div"
        className="prose mt-4"
        defaultValue="<p>Tell your story here.</p>"
      />
      <EditableImage
        contentKey="about.photo"
        defaultSrc="/placeholder.jpg"
        alt="About photo"
        className="rounded-xl mt-8"
      />
    </main>
  )
}
```

---

## Packages

| Package | Description |
|---------|-------------|
| `@editable-ui/core` | React components, context, hooks |
| `@editable-ui/adapter-json` | JSON file storage (default, zero config) |
| `@editable-ui/adapter-pg` | PostgreSQL |
| `@editable-ui/adapter-mysql` | MySQL |
| `@editable-ui/adapter-sqlite` | SQLite |
| `@editable-ui/adapter-mongo` | MongoDB |
| `@editable-ui/storage-local` | Local filesystem image storage |
| `@editable-ui/storage-s3` | S3-compatible image storage (AWS S3, Cloudflare R2, MinIO) |
| `@editable-ui/next` | Next.js API route helpers |

## Storage options

### JSON file (default)
Works on self-hosted servers. Not suitable for Vercel/serverless.
```ts
import { JsonAdapter } from '@editable-ui/adapter-json'
const adapter = new JsonAdapter('./data/content.json')
```

### PostgreSQL
```ts
import { PostgresAdapter } from '@editable-ui/adapter-pg'
const adapter = new PostgresAdapter(process.env.DATABASE_URL)
```

### MySQL
```ts
import { MySQLAdapter } from '@editable-ui/adapter-mysql'
const adapter = new MySQLAdapter(process.env.DATABASE_URL)
```

### SQLite
```ts
import { SQLiteAdapter } from '@editable-ui/adapter-sqlite'
const adapter = new SQLiteAdapter('./data/content.db')
```

### MongoDB
```ts
import { MongoAdapter } from '@editable-ui/adapter-mongo'
const adapter = new MongoAdapter(process.env.MONGODB_URI)
```

## Image storage options

### Local filesystem (default fallback)
```ts
import { LocalStorageAdapter } from '@editable-ui/storage-local'
const storage = new LocalStorageAdapter({ dir: './public/uploads', publicPath: '/uploads' })
```

### S3 / Cloudflare R2 / MinIO
```ts
import { S3StorageAdapter } from '@editable-ui/storage-s3'
const storage = new S3StorageAdapter({
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  endpoint: process.env.S3_ENDPOINT, // for R2/MinIO
})
```

## Admin access

`isAdmin` is a boolean prop on `EditableProvider`. Source it from your auth system:

```ts
// NextAuth example
const isAdmin = session?.user?.role === 'admin'

// Clerk example
const { has } = useAuth()
const isAdmin = has({ role: 'org:admin' })

// Simple email whitelist
const isAdmin = ADMIN_EMAILS.includes(session?.user?.email)
```

Always verify admin on the server side in your API routes — never trust the client-side flag alone for writes.

## Requirements

- React 17+
- Node 18+
- pnpm 8+ (for monorepo development)
