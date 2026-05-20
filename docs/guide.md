# editable-ui — Implementation Guide

Complete walkthrough: setup, all components, real-world patterns.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Wrapping Your App](#2-wrapping-your-app)
3. [EditableText](#3-editabletext)
4. [EditableRichText](#4-editablerichtext)
5. [EditableImage](#5-editableimage)
6. [EditableCollection](#6-editablecollection)
   - [Basic table](#61-basic-table)
   - [Hover image panel](#62-hover-image-panel-toto-wines-style)
   - [Click modal](#63-click-modal)
   - [Detail page](#64-detail-page)
   - [Combined: panel + modal + detail](#65-combined-panel--modal--detail-page)
7. [Admin Access](#7-admin-access)
8. [Storage Adapters](#8-storage-adapters)
9. [Image Storage](#9-image-storage)
10. [Real-World Example: Wine Catalog](#10-real-world-example-wine-catalog)

---

## 1. Project Setup

Run the CLI in your Next.js project root:

```bash
npx @editable-ui/cli init
```

Answer the prompts:

```
◆  Which database adapter?
│  ● JSON file (zero config — self-hosted only)
│  ○ PostgreSQL
│  ○ MySQL
│  ○ SQLite
│  ○ MongoDB

◆  Which image storage?
│  ● Local filesystem
│  ○ AWS S3
│  ○ Cloudflare R2
│  ○ MinIO

◆  Which auth provider?
│  ● NextAuth.js
│  ○ Clerk
│  ○ Custom

◆  Package manager?  (auto-detected)
```

The CLI generates these files automatically:

```
editable.config.ts              ← adapter + storage + isAdmin
pages/api/editable/content.ts   ← content CRUD API route
pages/api/editable/upload.ts    ← image upload API route
.env.example                    ← env vars to fill in
```

Copy `.env.example` to `.env.local` and fill in values before running.

---

## 2. Wrapping Your App

Wrap your entire app with `EditableProvider`. It holds the admin state and makes all `Editable*` components work.

### Pages Router (`pages/_app.tsx`)

```tsx
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

### App Router (`app/layout.tsx`)

```tsx
'use client'

import { EditableProvider } from '@editable-ui/core'
import { adapter, storage } from '../editable.config'
import { useSession } from 'next-auth/react'

export default function RootLayout({ children }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  return (
    <html>
      <body>
        <EditableProvider isAdmin={isAdmin} adapter={adapter} storage={storage}>
          {children}
        </EditableProvider>
      </body>
    </html>
  )
}
```

> **Important:** `isAdmin` is client-side only — used to show/hide the edit UI.
> Always verify admin on the server in your API routes too. Never trust client state for writes.

---

## 3. EditableText

Editable inline text. Works on any HTML text element.

### Basic usage

```tsx
import { EditableText } from '@editable-ui/core'

<EditableText
  contentKey="hero.title"
  as="h1"
  defaultValue="Welcome"
/>
```

- `contentKey` — unique key to store this value. Use dot notation to group by page/section.
- `as` — any HTML element: `h1`, `h2`, `p`, `span`, `li`, `td`, `button`, `label`, etc.
- `defaultValue` — shown when no saved value exists yet.

### With styles

All className and style props pass through to the element. In non-edit mode it renders as a plain element — zero visual difference.

```tsx
<EditableText
  contentKey="about.subtitle"
  as="p"
  defaultValue="Our story"
  className="text-lg text-gray-600 leading-relaxed"
  style={{ maxWidth: 600 }}
/>
```

### Edit behavior

- **Non-admin:** renders as plain element, no interaction.
- **Admin hover:** pencil icon appears top-right.
- **Admin click icon:** element becomes `contenteditable`.
- **Enter or blur:** saves. **Escape:** cancels.

### Naming convention for contentKey

```
page.section.element

hero.title
hero.subtitle
about.body
contact.email
nav.cta
footer.copyright
```

---

## 4. EditableRichText

Editable rich text with formatting toolbar. Uses Tiptap under the hood.

### Basic usage

```tsx
import { EditableRichText } from '@editable-ui/core'

<EditableRichText
  contentKey="about.body"
  as="div"
  defaultValue="<p>Tell your story here.</p>"
  className="prose prose-lg"
/>
```

### What the toolbar supports

When admin clicks edit:

```
B  I  U  S  |  H1  H2  H3  |  •≡  1≡  "  </>  |  ←  ↔  →  |  Save  Cancel
```

- Bold, italic, underline, strikethrough
- Headings H1–H3
- Bullet list, ordered list, blockquote, code block
- Text alignment: left, center, right
- Undo/redo (keyboard: Ctrl+Z / Ctrl+Shift+Z)

### Rendering saved HTML

The saved value is an HTML string. Render it with `dangerouslySetInnerHTML` when using `useCollectionItem` or building custom detail pages:

```tsx
<div
  className="prose"
  dangerouslySetInnerHTML={{ __html: item.description }}
/>
```

---

## 5. EditableImage

Editable image. Admin can upload a file or paste a URL.

### Basic usage

```tsx
import { EditableImage } from '@editable-ui/core'

<EditableImage
  contentKey="hero.photo"
  defaultSrc="/images/placeholder.jpg"
  alt="Hero photo"
  className="w-full h-64 object-cover rounded-xl"
/>
```

### Edit behavior

- **Admin hover:** pencil icon appears.
- **Admin click icon:** modal opens with two options:
  - Upload file (sent to your configured image storage)
  - Paste image URL

### Image storage

Images upload to whatever storage you configured:
- **Local storage** → saves to `/public/uploads/`, returns `/uploads/filename.jpg`
- **S3 / R2 / MinIO** → uploads to bucket, returns full CDN URL

See [Image Storage](#9-image-storage) for setup.

---

## 6. EditableCollection

Schema-driven editable table. Admin can add, edit, and delete rows. Supports hover image panel, click modal, and dedicated detail pages.

### 6.1 Basic table

Simplest setup — just a table with inline editable cells.

```tsx
import { EditableCollection } from '@editable-ui/core'

<EditableCollection
  contentKey="team"
  schema={[
    { field: 'name',  label: 'Name',  visible: true },
    { field: 'role',  label: 'Role',  visible: true },
    { field: 'email', label: 'Email', visible: true },
  ]}
/>
```

**What admin sees:**
- Table with editable cells (double-click to edit)
- `+ Add row` button at bottom
- 🗑 delete button on row hover
- Click column header to rename it

**What non-admin sees:**
- Normal read-only table

### Field types

```tsx
// text (default) — plain input
{ field: 'name', label: 'Name', type: 'text', visible: true }

// richtext — textarea, stores HTML
{ field: 'bio', label: 'Bio', type: 'richtext', visible: false }

// image — file upload or URL
{ field: 'photo', label: 'Photo', type: 'image', visible: false }

// select — dropdown with fixed options
{ field: 'status', label: 'Status', type: 'select',
  options: ['Active', 'Inactive', 'Pending'], visible: true }
```

**`visible: false`** hides the field from the table column — but admin can still edit it via the modal form when clicking a row.

### 6.2 Hover image panel (toto-wines style)

Split layout: left table, right sticky image panel. Image swaps on row hover.

```tsx
'use client'

import { useState } from 'react'
import { EditableCollection } from '@editable-ui/core'

export default function WinesPage() {
  const [hoveredItem, setHoveredItem] = useState(null)

  return (
    <div className="flex min-h-screen">

      {/* left — table */}
      <div className="w-1/2 border-r border-gray-100">
        <EditableCollection
          contentKey="wines"
          schema={[
            { field: 'name',     label: 'Wine',     visible: true },
            { field: 'producer', label: 'Producer', visible: true },
            { field: 'vintage',  label: 'Vintage',  visible: true },
            { field: 'style',    label: 'Style',    type: 'select',
              options: ['Red', 'White', 'Rosé', 'Sparkling'], visible: true },
            { field: 'image',    label: 'Image',    type: 'image', visible: false },
          ]}
          onRowHover={(item) => setHoveredItem(item)}
        />
      </div>

      {/* right — image panel */}
      <div className="w-1/2 sticky top-0 h-screen flex items-center justify-center bg-stone-50">
        {hoveredItem?.image
          ? (
            <img
              key={hoveredItem.id}
              src={hoveredItem.image}
              alt={hoveredItem.name}
              className="h-[80vh] w-auto object-contain transition-opacity duration-300"
            />
          )
          : <p className="text-gray-300 text-sm tracking-widest uppercase">Hover a wine</p>
        }
      </div>

    </div>
  )
}
```

> `key={hoveredItem.id}` on the img forces React to remount on item change, triggering CSS transition if you add one.

### 6.3 Click modal

Open your own modal with the clicked row's data. You control all markup and styles.

```tsx
'use client'

import { useState } from 'react'
import { EditableCollection } from '@editable-ui/core'

export default function WinesPage() {
  const [modalItem, setModalItem] = useState(null)

  return (
    <>
      <EditableCollection
        contentKey="wines"
        schema={schema}
        onRowClick={(item) => setModalItem(item)}
      />

      {/* your modal — any markup, any style */}
      {modalItem && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setModalItem(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* image */}
            {modalItem.image && (
              <img
                src={modalItem.image}
                alt={modalItem.name}
                className="w-full h-64 object-cover"
              />
            )}

            {/* content */}
            <div className="p-8">
              <h2 className="text-2xl font-bold">{modalItem.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {modalItem.producer} · {modalItem.country}
              </p>
              <p className="text-emerald-600 font-semibold mt-2">{modalItem.price}</p>
              <div
                className="prose prose-sm mt-4"
                dangerouslySetInnerHTML={{ __html: modalItem.description }}
              />
              <button
                onClick={() => setModalItem(null)}
                className="mt-6 w-full py-3 bg-black text-white rounded-xl font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

Access any field via `modalItem.fieldName` — including fields with `visible: false` in the schema.

### 6.4 Detail page

Navigate to a dedicated page per row. Each row has an auto-generated `id` used in the URL.

**Step 1 — navigate on click:**

```tsx
import { useRouter } from 'next/navigation'

const router = useRouter()

<EditableCollection
  contentKey="wines"
  schema={schema}
  onRowClick={(item) => router.push(`/wines/${item.id}`)}
/>
```

**Step 2 — detail page reads that item:**

```tsx
// app/wines/[id]/page.tsx
'use client'

import { useCollectionItem } from '@editable-ui/core'

export default function WineDetailPage({ params }) {
  const item = useCollectionItem('wines', params.id)

  if (!item) return <div className="p-8 text-gray-400">Wine not found.</div>

  return (
    <div className="max-w-3xl mx-auto px-8 py-16">

      {/* hero image */}
      <div className="w-full h-96 rounded-2xl overflow-hidden mb-10">
        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
      </div>

      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">{item.name}</h1>
          <p className="text-gray-500 mt-1">{item.producer} · {item.country}</p>
        </div>
        <span className="text-2xl font-semibold text-emerald-600">{item.price}</span>
      </div>

      {/* rich text content */}
      <div
        className="prose prose-lg mt-8"
        dangerouslySetInnerHTML={{ __html: item.description }}
      />

      {/* any other field */}
      <p className="text-sm text-gray-400 mt-8">Vintage: {item.vintage}</p>
    </div>
  )
}
```

`useCollectionItem('wines', id)` pulls that specific row from the stored collection. Returns `null` if not found.

### 6.5 Combined: panel + modal + detail page

All three contexts from one collection. Most powerful setup.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditableCollection } from '@editable-ui/core'

const schema = [
  { field: 'name',        label: 'Wine',        visible: true },
  { field: 'producer',    label: 'Producer',    visible: true },
  { field: 'vintage',     label: 'Vintage',     visible: true },
  { field: 'style',       label: 'Style',       type: 'select',
    options: ['Red', 'White', 'Rosé', 'Sparkling'], visible: true },
  { field: 'image',       label: 'Image',       type: 'image',    visible: false },
  { field: 'description', label: 'Description', type: 'richtext', visible: false },
  { field: 'price',       label: 'Price',                         visible: false },
  { field: 'country',     label: 'Country',                       visible: false },
]

export default function WinesPage() {
  const [hoveredItem, setHoveredItem] = useState(null)
  const [modalItem, setModalItem]     = useState(null)
  const router = useRouter()

  return (
    <div className="flex min-h-screen">

      {/* ── Left: table ─────────────────────────────── */}
      <div className="w-1/2 border-r border-gray-100">
        <EditableCollection
          contentKey="wines"
          schema={schema}
          onRowHover={(item) => setHoveredItem(item)}
          onRowClick={(item) => setModalItem(item)}
          // swap onRowClick to navigate instead:
          // onRowClick={(item) => router.push(`/wines/${item.id}`)}
        />
      </div>

      {/* ── Right: hover panel ──────────────────────── */}
      <div className="w-1/2 sticky top-0 h-screen flex items-center justify-center bg-stone-50">
        {hoveredItem?.image
          ? <img key={hoveredItem.id} src={hoveredItem.image}
              className="h-[80vh] object-contain transition-all duration-300" />
          : <p className="text-gray-300 text-sm uppercase tracking-widest">Hover a wine</p>
        }
      </div>

      {/* ── Modal ───────────────────────────────────── */}
      {modalItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
             onClick={() => setModalItem(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
               onClick={e => e.stopPropagation()}>
            {modalItem.image && (
              <img src={modalItem.image} className="w-full h-56 object-cover" />
            )}
            <div className="p-8">
              <h2 className="text-2xl font-bold">{modalItem.name}</h2>
              <p className="text-gray-500 text-sm mt-1">
                {modalItem.producer} · {modalItem.country} · {modalItem.vintage}
              </p>
              <p className="text-emerald-600 font-semibold mt-2">{modalItem.price}</p>
              <div className="prose prose-sm mt-4"
                   dangerouslySetInnerHTML={{ __html: modalItem.description }} />
              <div className="flex gap-3 mt-6">
                <button onClick={() => router.push(`/wines/${modalItem.id}`)}
                        className="flex-1 py-3 border border-black text-black rounded-xl font-medium">
                  Full page →
                </button>
                <button onClick={() => setModalItem(null)}
                        className="flex-1 py-3 bg-black text-white rounded-xl font-medium">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
```

---

## 7. Admin Access

### NextAuth.js

**Setup role on user:**

```ts
// pages/api/auth/[...nextauth].ts
export const authOptions = {
  callbacks: {
    session({ session, token }) {
      session.user.role = token.role
      return session
    },
    jwt({ token, user }) {
      if (user) token.role = user.role // from your DB
      return token
    },
  },
}
```

**Use in provider:**

```tsx
const { data: session } = useSession()
const isAdmin = session?.user?.role === 'admin'
```

**Protect API routes:**

```ts
// pages/api/editable/content.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'

const session = await getServerSession(req, res, authOptions)
if (!session || session.user.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden' })
}
```

### Clerk

```tsx
import { useAuth } from '@clerk/nextjs'

const { has } = useAuth()
const isAdmin = has({ role: 'org:admin' })
```

### Simple email whitelist (no auth library)

```ts
// editable.config.ts
const ADMIN_EMAILS = ['you@example.com', 'partner@example.com']

export const isAdmin = (req) => {
  const email = req.headers['x-user-email'] // from your session cookie
  return ADMIN_EMAILS.includes(email)
}
```

---

## 8. Storage Adapters

### JSON file

Zero config. Best for local dev or self-hosted servers with persistent disk.

> ⚠️ Not suitable for Vercel, Netlify, or any serverless platform — filesystem resets on deploy.

```ts
import { JsonAdapter } from '@editable-ui/adapter-json'

const adapter = new JsonAdapter('./data/content.json')
// auto-creates the file if it doesn't exist
```

### PostgreSQL (Supabase / Neon / PlanetScale)

```ts
import { PostgresAdapter } from '@editable-ui/adapter-pg'

const adapter = new PostgresAdapter(process.env.DATABASE_URL)
// auto-creates table on first run
```

Table created automatically:

```sql
CREATE TABLE IF NOT EXISTS editable_content (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  type       TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### MySQL

```ts
import { MySQLAdapter } from '@editable-ui/adapter-mysql'

const adapter = new MySQLAdapter(process.env.DATABASE_URL)
```

### SQLite (local / embedded)

```ts
import { SQLiteAdapter } from '@editable-ui/adapter-sqlite'

const adapter = new SQLiteAdapter('./data/content.db')
```

### MongoDB

```ts
import { MongoAdapter } from '@editable-ui/adapter-mongo'

const adapter = new MongoAdapter(process.env.MONGODB_URI)
// auto-creates collection + index on first run
```

---

## 9. Image Storage

### Local filesystem

Images saved to `/public/uploads/`. Served at `/uploads/filename.jpg`.

```ts
import { LocalStorageAdapter } from '@editable-ui/storage-local'

const storage = new LocalStorageAdapter({
  dir: './public/uploads',  // where files are saved
  publicPath: '/uploads',   // URL prefix returned
})
```

> ⚠️ Same limitation as JSON — not suitable for Vercel/serverless.

### AWS S3

```ts
import { S3StorageAdapter } from '@editable-ui/storage-s3'

const storage = new S3StorageAdapter({
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
})
```

### Cloudflare R2 (recommended — no egress fees)

```ts
const storage = new S3StorageAdapter({
  bucket: process.env.R2_BUCKET,
  region: 'auto',
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  endpoint: process.env.R2_ENDPOINT, // https://<account-id>.r2.cloudflarestorage.com
})
```

### MinIO (self-hosted)

```ts
const storage = new S3StorageAdapter({
  bucket: process.env.MINIO_BUCKET,
  region: 'us-east-1',
  accessKeyId: process.env.MINIO_ACCESS_KEY,
  secretAccessKey: process.env.MINIO_SECRET_KEY,
  endpoint: process.env.MINIO_ENDPOINT, // http://localhost:9000
})
```

---

## 10. Real-World Example: Wine Catalog

Full implementation of a wine catalog site similar to toto-wines — list page with hover panel and modal, plus detail pages. Uses PostgreSQL + Cloudflare R2 + NextAuth.

### File structure

```
app/
  layout.tsx                  ← EditableProvider
  wines/
    page.tsx                  ← list + hover panel + modal
    [id]/
      page.tsx                ← detail page
  api/
    auth/[...nextauth]/
      route.ts                ← NextAuth
    editable/
      content/route.ts        ← generated by CLI
      upload/route.ts         ← generated by CLI
editable.config.ts            ← generated by CLI
```

### `app/layout.tsx`

```tsx
'use client'

import { EditableProvider } from '@editable-ui/core'
import { adapter, storage } from '../editable.config'
import { useSession } from 'next-auth/react'

export default function RootLayout({ children }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  return (
    <html lang="en">
      <body>
        <EditableProvider isAdmin={isAdmin} adapter={adapter} storage={storage}>
          {children}
        </EditableProvider>
      </body>
    </html>
  )
}
```

### `app/wines/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditableCollection } from '@editable-ui/core'

const schema = [
  { field: 'name',        label: 'Wine',        visible: true },
  { field: 'producer',    label: 'Producer',    visible: true },
  { field: 'country',     label: 'Country',     visible: true },
  { field: 'region',      label: 'Region',      visible: true },
  { field: 'grape',       label: 'Grape',       visible: true },
  { field: 'style',       label: 'Style',       type: 'select',
    options: ['Red', 'White', 'Rosé', 'Sparkling', 'Orange'], visible: true },
  { field: 'vintage',     label: 'Vintage',                   visible: false },
  { field: 'price',       label: 'Price',                     visible: false },
  { field: 'image',       label: 'Bottle Image', type: 'image',    visible: false },
  { field: 'description', label: 'Description',  type: 'richtext', visible: false },
  { field: 'tasting',     label: 'Tasting Notes', type: 'richtext', visible: false },
]

export default function WinesPage() {
  const [hoveredItem, setHoveredItem] = useState(null)
  const [modalItem, setModalItem]     = useState(null)
  const router = useRouter()

  return (
    <div className="flex min-h-screen font-sans">

      {/* table — left 55% */}
      <div className="w-[55%] px-12 py-16">
        <h1 className="text-xs uppercase tracking-widest text-gray-400 mb-8">
          Wine List
        </h1>
        <EditableCollection
          contentKey="wines"
          schema={schema}
          onRowHover={(item) => setHoveredItem(item)}
          onRowClick={(item) => setModalItem(item)}
        />
      </div>

      {/* panel — right 45%, sticky */}
      <div className="w-[45%] sticky top-0 h-screen bg-[#f5f0eb] flex items-center justify-center">
        {hoveredItem?.image ? (
          <img
            key={hoveredItem.id}
            src={hoveredItem.image}
            alt={hoveredItem.name}
            className="h-[75vh] w-auto object-contain drop-shadow-xl"
            style={{ transition: 'opacity 0.2s ease' }}
          />
        ) : (
          <span className="text-[#ccc] text-xs tracking-[0.3em] uppercase">
            Hover to preview
          </span>
        )}
      </div>

      {/* modal */}
      {modalItem && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setModalItem(null)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex"
            onClick={e => e.stopPropagation()}
          >
            {/* image side */}
            {modalItem.image && (
              <div className="w-2/5 bg-[#f5f0eb] flex items-center justify-center p-8">
                <img src={modalItem.image} className="h-64 object-contain" />
              </div>
            )}

            {/* content side */}
            <div className="flex-1 p-8 flex flex-col">
              <button
                onClick={() => setModalItem(null)}
                className="self-end text-gray-300 hover:text-gray-600 text-xl mb-4"
              >
                ✕
              </button>
              <p className="text-xs uppercase tracking-widest text-gray-400">
                {modalItem.style}
              </p>
              <h2 className="text-2xl font-bold mt-1">{modalItem.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {modalItem.producer} · {modalItem.region}, {modalItem.country}
              </p>
              <p className="text-gray-400 text-sm">{modalItem.grape} · {modalItem.vintage}</p>
              <p className="text-lg font-semibold mt-3">{modalItem.price}</p>
              <div
                className="prose prose-sm mt-4 flex-1 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: modalItem.description }}
              />
              <button
                onClick={() => router.push(`/wines/${modalItem.id}`)}
                className="mt-6 py-3 text-sm border border-gray-900 rounded-xl hover:bg-gray-900 hover:text-white transition-colors"
              >
                View full page →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

### `app/wines/[id]/page.tsx`

```tsx
'use client'

import { useCollectionItem } from '@editable-ui/core'
import { useRouter } from 'next/navigation'

export default function WineDetailPage({ params }) {
  const item = useCollectionItem('wines', params.id)
  const router = useRouter()

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Wine not found.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">

      {/* back */}
      <button
        onClick={() => router.back()}
        className="fixed top-6 left-6 text-sm text-gray-400 hover:text-gray-800"
      >
        ← Back
      </button>

      {/* hero */}
      <div className="flex min-h-screen">

        {/* image — left */}
        <div className="w-1/2 bg-[#f5f0eb] flex items-center justify-center sticky top-0 h-screen">
          {item.image
            ? <img src={item.image} className="h-[80vh] object-contain drop-shadow-2xl" />
            : <div className="w-48 h-64 bg-gray-200 rounded-lg" />
          }
        </div>

        {/* content — right */}
        <div className="w-1/2 px-16 py-24 flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            {item.style}
          </p>
          <h1 className="text-5xl font-bold leading-tight">{item.name}</h1>
          <p className="text-xl text-gray-500 mt-3">
            {item.producer}
          </p>
          <p className="text-gray-400 mt-1">
            {item.region}, {item.country} · {item.grape} · {item.vintage}
          </p>
          <p className="text-2xl font-semibold mt-6">{item.price}</p>

          {item.description && (
            <div
              className="prose prose-lg mt-8 text-gray-700"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}

          {item.tasting && (
            <>
              <h3 className="text-sm uppercase tracking-widest text-gray-400 mt-10 mb-3">
                Tasting Notes
              </h3>
              <div
                className="prose prose-sm text-gray-600"
                dangerouslySetInnerHTML={{ __html: item.tasting }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## Summary

| Component | Use for |
|-----------|---------|
| `EditableText` | Any inline text — headings, paragraphs, labels, buttons |
| `EditableRichText` | Long-form content with formatting |
| `EditableImage` | Any image that needs to be replaceable |
| `EditableCollection` | Lists, tables, catalogs with multiple items |
| `useCollectionItem` | Detail page for a single collection item |

**Plugin provides:** data storage, admin edit UI, CRUD operations.

**You provide:** all markup, all styles, all layout decisions.
