# `@houseoftag/payload-kit`

Mechanical editor-UX helpers for **Payload CMS 3 + Next.js 15** sites — the *code* half
of the `payload` skill's playbook. Stop re-implementing `linkField`, link resolution,
slug/SEO fields, live-preview wiring, the Media collection, and block row labels in every
project: install once, bump once, every site updates.

> **Package = code, skill = knowledge.** This package ships only the *mechanical* parts
> (stable signature, a wrong call is a type error). The judgment — *when / why / what not
> to do* — stays in the `payload` skill. See [`DESIGN.md`](./DESIGN.md) for the full
> rationale, export inventory, and adoption plan.

ESM-only · `payload >=3 <4` · `next >=15 <16` · `react >=19 <20`.

## Install

```bash
pnpm add @houseoftag/payload-kit
# peers (you almost certainly already have these):
pnpm add payload next react react-dom @payloadcms/ui @payloadcms/live-preview-react
```

## Subpath exports — one runtime context each

| Import | Use in | Contents |
|---|---|---|
| `@houseoftag/payload-kit` | `payload.config`, server utils | `defineRoutes`, `linkField`, `resolveLinks`, `slugField`, `seoField`, `createPreview`, `mediaCollection`, `withRowLabels`, `payloadKit` |
| `@houseoftag/payload-kit/fields` | configs wanting only fields | `linkField`, `resolveLinks`, `slugField`, `seoField`, … |
| `@houseoftag/payload-kit/client` | admin React (`'use client'`) | `BlockRowLabel`, `LivePreviewListener` |
| `@houseoftag/payload-kit/next` | `app/.../next/*` route files | `previewRouteHandler`, `exitPreviewRouteHandler` |
| `@houseoftag/payload-kit/access` | access control | `isAdmin`, `isAdminOrEditor`, `hasRole`, `anyone`, … |

> **Never** re-export across the server/client line: the root entry must stay free of
> `'use client'` and of `next/*`. That's why client components and route handlers have
> their own subpaths.

## 1. Declare your routes once

The same per-collection route knowledge used to be hardcoded in three places (the link
field's `relationTo`, `resolveLinks`' href, the preview path) and could drift. One map
feeds all three, so a doc's link href and its preview URL can't disagree.

```ts
// src/routes.ts
import { defineRoutes } from '@houseoftag/payload-kit'

export const routes = defineRoutes({
  trailingSlash: true,
  routes: {
    pages:     { prefix: '',           rootSlug: 'home', rootPath: '/' },
    news:      { prefix: '/news',      label: 'News post' },
    events:    { prefix: '/events',    label: 'Event' },
    programs:  { prefix: '/program',   label: 'Program' },   // singular — declared once
    locations: { prefix: '/locations', label: 'Location' },
    galleries: { prefix: '/photos',    label: 'Gallery' },   // renamed — declared once
  },
})
```

## 2. Fields

```ts
import { linkField, slugField, seoField } from '@houseoftag/payload-kit'
import { routes } from './routes'

// In a block / group:
fields: [ /* … */ ...linkField({ routes }) ]

// In a collection:
fields: [
  { name: 'title', type: 'text', required: true },
  slugField(),                  // required + unique, auto-derived from title when blank
  seoField(),                   // admin-only meta + OG image group
]
```

Then resolve picked internal links to plain `href` strings before render (needs the
relationship populated — fetch with `depth >= 1`):

```ts
import { resolveLinks } from '@houseoftag/payload-kit'
import { routes } from './routes'

const page = await payload.find({ collection: 'pages', depth: 2, /* … */ })
const layout = resolveLinks(structuredClone(page.layout), routes)
```

Access guards default to admin-only (from `/access`) but are injectable:
`slugField({ access: myGuard, hideFromUser: myCondition })`.

## 3. Live preview + drafts

```ts
import { createPreview } from '@houseoftag/payload-kit'
import { routes } from './routes'

export const preview = createPreview({ routes }) // serverURL/secret default to env

// In a collection:
admin: { useAsTitle: 'name', ...preview.collectionLivePreview('programs') },
versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true } },
```

Route files become one-liners:

```ts
// src/app/(frontend)/next/preview/route.ts
import config from '@payload-config'
import { previewRouteHandler } from '@houseoftag/payload-kit/next'
export const { GET } = previewRouteHandler({ config })

// src/app/(frontend)/next/exit-preview/route.ts
import { exitPreviewRouteHandler } from '@houseoftag/payload-kit/next'
export const { GET } = exitPreviewRouteHandler()
```

And mount the listener in the frontend (only when draft mode is on):

```tsx
import { LivePreviewListener } from '@houseoftag/payload-kit/client'
```

## 4. Media collection

```ts
import { mediaCollection } from '@houseoftag/payload-kit'
import path from 'path'

export const Media = mediaCollection({
  staticDir: process.env.MEDIA_DIR || path.resolve(dirname, '../../media'),
  // imageSizes / categories / sourcePathField / extraFields all optional
})
```

It deliberately keeps Payload's **default table list view** — a custom grid would also
hijack the "Choose from existing" picker drawer and break selection. (See the skill.)

## 5. Block row labels

```ts
import { withRowLabels } from '@houseoftag/payload-kit'

blocks: withRowLabels([HeroBlock, ProseBlock /* … */], {
  clientProps: {
    typeLabels: { hero: 'Hero', prose: 'Prose' },
    snippetFields: ['heading', 'title', 'body'],
  },
})
```

This injects the package's client `BlockRowLabel` **by string** onto each block's
`admin.components.Label`. After referencing it, run:

```bash
payload generate:importmap
```

Payload resolves `@houseoftag/payload-kit/client#BlockRowLabel` via the `exports` map.

## 6. Or use the plugin

The thin convenience layer wires preview + drafts + Media in one call (helpers stay
usable à la carte):

```ts
import { payloadKit } from '@houseoftag/payload-kit'
import { routes } from './routes'

plugins: [
  payloadKit({
    routes,
    previewCollections: ['pages', 'programs', 'news'],
    media: { staticDir: process.env.MEDIA_DIR! },
  }),
]
```

## Build

```bash
pnpm install
pnpm build      # tsup → dist (ESM + .d.ts)
pnpm typecheck
```

The client entry is built separately so its `'use client'` directive is guaranteed at
the top of `dist/client/index.js`.

---

MIT © House of Tag. Design rationale and the twincedars adoption path live in
[`DESIGN.md`](./DESIGN.md).
