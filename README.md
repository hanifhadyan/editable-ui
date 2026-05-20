# editable-ui

Inline visual editing plugin for React/Next.js. Edit text, rich text, images, and collections directly on the page — no admin panel needed.

📖 **[Full Implementation Guide →](./docs/guide.md)** — step-by-step setup, all components, real-world wine catalog example.

## How it works

Wrap any element with an `Editable` component. When logged in as admin, hover shows an edit icon. Click to edit in place. Changes save to your chosen storage.

```tsx
<EditableText contentKey="hero.title" as="h1" className="text-4xl font-bold">
  Welcome to our site
</EditableText>

<EditableRichText contentKey="about.body" as="div" className="prose" />

<EditableImage contentKey="hero.image" src="/default.jpg" alt="Hero" className="w-full" />
```

---

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

## EditableCollection

Schema-driven editable table/list with full CRUD for admins. Supports hover panel, click modal, and detail pages — all with your own markup and styles.

### Schema

Define fields with `visible` controlling table column visibility. Hidden fields are still editable by admin in the modal form.

```tsx
import { EditableCollection } from '@editable-ui/core'

const schema = [
  { field: 'name',        label: 'Wine',        visible: true },
  { field: 'producer',    label: 'Producer',    visible: true },
  { field: 'country',     label: 'Country',     visible: true },
  { field: 'style',       label: 'Style',       type: 'select',
    options: ['Red', 'White', 'Rosé', 'Sparkling'], visible: true },
  { field: 'image',       label: 'Image',       type: 'image',    visible: false },
  { field: 'description', label: 'Description', type: 'richtext', visible: false },
  { field: 'price',       label: 'Price',                         visible: false },
]
```

### Recommended pattern — full control via callbacks

Use `onRowClick` and `onRowHover` to manage your own state. You own all markup and styles for the panel and modal.

```tsx
'use client'

import { useState } from 'react'
import { EditableCollection } from '@editable-ui/core'

export default function WinesPage() {
  const [modalItem, setModalItem] = useState(null)
  const [hoveredItem, setHoveredItem] = useState(null)

  return (
    <div className="flex min-h-screen">

      {/* left — table */}
      <div className="w-1/2">
        <EditableCollection
          contentKey="wines"
          schema={schema}
          onRowClick={(item) => setModalItem(item)}
          onRowHover={(item) => setHoveredItem(item)}
        />
      </div>

      {/* right — image panel, your markup, your styles */}
      <div className="w-1/2 sticky top-0 h-screen flex items-center justify-center bg-stone-50">
        {hoveredItem
          ? <img src={hoveredItem.image} className="h-full object-contain p-16 transition-all" />
          : <p className="text-gray-400">Hover a wine</p>
        }
      </div>

      {/* modal — your markup, your styles */}
      {modalItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setModalItem(null)}
        >
          <div
            className="bg-white rounded-xl p-8 max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            <img src={modalItem.image} className="w-full rounded-lg mb-4" />
            <h2 className="text-2xl font-bold">{modalItem.name}</h2>
            <p className="text-sm text-gray-500">{modalItem.producer} · {modalItem.country}</p>
            <p className="font-semibold mt-1">{modalItem.price}</p>
            <div
              className="prose prose-sm mt-4"
              dangerouslySetInnerHTML={{ __html: modalItem.description }}
            />
            <button
              onClick={() => setModalItem(null)}
              className="mt-6 px-4 py-2 bg-black text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
```

### One data source, three render contexts

The same item data flows to all three contexts — you decide what to show where:

| Context | Trigger | How |
|---------|---------|-----|
| Table row | always visible | `visible: true` fields in schema |
| Hover panel | `onRowHover` | `hoveredItem.fieldName` in your panel JSX |
| Click modal | `onRowClick` | `modalItem.fieldName` in your modal JSX |
| Detail page | URL param | `useCollectionItem('wines', id)` |

### Detail page

```tsx
// app/wines/[id]/page.tsx
import { useCollectionItem } from '@editable-ui/core'

export default function WineDetailPage({ params }) {
  const item = useCollectionItem('wines', params.id)

  if (!item) return <div>Not found</div>

  return (
    <div className="max-w-2xl mx-auto p-8">
      <img src={item.image} className="w-full rounded-xl mb-6" />
      <h1 className="text-4xl font-bold">{item.name}</h1>
      <p className="text-gray-500 mt-1">{item.producer} · {item.country}</p>
      <div
        className="prose mt-6"
        dangerouslySetInnerHTML={{ __html: item.description }}
      />
    </div>
  )
}
```

Navigate to detail page from table:

```tsx
import { useRouter } from 'next/navigation'

const router = useRouter()

<EditableCollection
  contentKey="wines"
  schema={schema}
  onRowClick={(item) => router.push(`/wines/${item.id}`)}
  onRowHover={(item) => setHoveredItem(item)}
/>
```

### Admin behavior

| Interaction | Admin | Non-admin |
|-------------|-------|-----------|
| View table | ✅ | ✅ |
| Double-click cell | inline edit | — |
| Click row | fires `onRowClick` | fires `onRowClick` |
| Hover row | fires `onRowHover` | fires `onRowHover` |
| Click column header | rename label | — |
| Add row | ✅ "+ Add row" button | — |
| Delete row | ✅ 🗑 on row hover | — |

When `onRowClick` is not provided and `modal` prop is used, clicking opens the built-in modal with an auto-generated edit form for all fields.

### Field types

| Type | Edit UI |
|------|---------|
| `text` (default) | inline input |
| `richtext` | textarea (Tiptap for inline cell edit) |
| `image` | file upload or URL paste |
| `select` | dropdown with `options` array |

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
| `@editable-ui/cli` | Interactive CLI initializer |

---

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

---

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

---

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

---

## Requirements

- React 17+
- Node 18+
- pnpm 8+ (for monorepo development)
