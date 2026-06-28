# `@houseoftag/payload-kit` — design spec

> **Status: design spec, not yet implemented.** This document describes what the package
> *should be*, grounded in the real editor-UX helpers built for `twincedars.org` and the
> `payload` skill's playbook. A fresh session should build the package from this brief.
> Created 2026-06-28.

A small, ESM-only **library of the mechanical editor-UX helpers** for Payload CMS 3 +
Next.js 15 sites — the code half of the `payload` skill's playbook. Today every Payload
project re-implements the same `linkField`, `resolveLinks`, live-preview wiring, media
config, and block-row labels (and the per-project version-pin we added is a band-aid for
exactly that duplication). This package turns that copy-paste into a versioned dependency:
**one `npm install` + one version bump updates every site**.

---

## 1. The governing idea: package = code, skill = knowledge

Draw the line at **judgment**:

- **If using a thing correctly requires *zero decisions*** (same every project, stable
  input/output contract, a wrong call is a *type error* not a misjudgment) → it's **code**
  → the package.
- **If using it correctly requires knowing *when / why / whether / what-not-to-do*** →
  it's **knowledge** → it stays in the `payload` skill, forever.

> The package is the answer; the skill is the question and the warning label.

`linkField()` is mechanical → package. The facts that you must *also* wire it into the
Header/Footer nav globals, that `resolveLinks` needs `depth >= 1`, and that **a custom
media-list grid silently hijacks the "Choose from existing" picker drawer** → judgment →
skill. No amount of packaging removes those decisions. They **compose**: once the package
exists, the skill's Quick-Reference rows change from *"copy `src/fields/link.ts`"* to
*"install `payload-kit`, call `linkField()` — and here's the non-obvious part."*

**Litmus test for any future addition:** package it if it has a stable signature, varies
only by parameters, and a wrong use is a compile error. Keep it in the skill if the answer
is "it depends," there's a "don't do X," it's a one-time procedure, or it's a diagnosis.
*If you're tempted to write a paragraph of caveats in a package JSDoc, the caveats belong
in the skill and only the function belongs in the package.*

---

## 2. What to extract (export inventory)

Grounded in the actual twincedars files. Each item lists what's **project-specific** and
must become a parameter (not a baked-in constant).

### Field factories — Payload server config (Node, no `'use client'`)
| Export | From | Parameterize |
|---|---|---|
| `linkField(opts)` | `src/fields/link.ts` | `LINKABLE_COLLECTIONS`, the route prefix map, admin copy strings |
| `slugField(opts)` | `src/fields/slug.ts` | the hard-imported access guards (`isAdminFieldLevel`/`isAdminUser`) → **inject** as options |
| `seoField(opts)` | `src/fields/seo.ts` | access guards (same), `ogImage` upload collection slug (default `media`) |
| `formatSlug`, `deriveSlug` | `src/fields/slug.ts` | none — ship verbatim |

### Server utils — Node / isomorphic
| Export | From | Parameterize |
|---|---|---|
| `resolveLinks(node, routes)` | `src/fields/link.ts` | the prefix map + `home→/` rule (currently module-private `COLLECTION_PREFIX`/`docHref`) |
| `generatePreviewPath(args, opts)` | `src/utilities/generatePreviewPath.ts` | prefix map, `home` special-case, `/next/preview` path, `PREVIEW_SECRET` env name |
| `collectionLivePreview(slug, opts)` | same | breakpoints, `NEXT_PUBLIC_SERVER_URL` env name (delegates to `generatePreviewPath`) |
| `PreviewSearchParams` (type) | currently in the app's preview route | **move into the package** (see blocker #1) |
| `buildDocHref({ prefixMap, rootDoc })` | new — the shared href core | the one primitive `resolveLinks` + `generatePreviewPath` both consume |

### Collection factory
| Export | From | Parameterize |
|---|---|---|
| `mediaCollection(opts)` / `mediaCollectionDefaults(opts)` | `src/collections/Media.ts` | `staticDir` (required, passed in), `imageSizes`, `categories` taxonomy, `useAsTitle`, `listSearchableFields`, `pagination`, optional `sourcePath` provenance field |

### Layout-builder helpers
| Export | From | Parameterize |
|---|---|---|
| `withRowLabel(block)` / `withRowLabels(blocks)` | `src/collections/Pages.ts` (`withRowLabel`) | the component string path |
| `BlockRowLabel` *(client)* | `src/components/admin/BlockRowLabel.tsx` | `TYPE_LABELS`, snippet field-priority → via `clientProps` (see §4) |

### Client components — React `'use client'`
| Export | From | Notes |
|---|---|---|
| `BlockRowLabel` | `src/components/admin/BlockRowLabel.tsx` | uses `@payloadcms/ui` `useRowLabel()` |
| `LivePreviewListener` | `src/components/LivePreviewListener.tsx` | thin `RefreshRouteOnSave` wrapper; only `NEXT_PUBLIC_SERVER_URL` varies |

### Next route handlers
| Export | From | Notes |
|---|---|---|
| `/next/preview` + `/next/exit-preview` handlers | the app routes | collection-agnostic, "write once" — re-export; the consumer's route file becomes a one-line re-export |

### NOT package exports (patterns, not code)
- **`RenderBlocks.tsx`** — app glue (its `blockType→Component` map is project blocks). At
  most a `makeRenderBlocks(componentMap, { resolveLinks })` factory; the map stays in the app.
- **`MediaGridView.tsx`** — the parked picker-hijack anti-pattern. **Do not ship as a
  list-view drop-in.** (Ship only as a future client/`ListDrawer`-aware rewrite, or not at
  all. twincedars should *delete* it — that's the skill's instruction, not the package's.)

### Sibling subpath: access kit
`src/access/index.ts` (`hasRole`, `isAdmin`, `isAdminOrEditor`, `isAdminFieldLevel`,
`isAdminUser`, `anyone`) is generic except the `'admin' | 'editor'` role-name set. Ship as
`@houseoftag/payload-kit/access` with the role set as a type parameter, and have
`slugField`/`seoField` accept guards as options (policy-agnostic defaults) **rather than
hard-importing** — this is the single most important decoupling.

---

## 3. The core design: ONE shared route map (anti-drift)

The central tension: the **same per-collection route knowledge** is hardcoded in three
places today — `linkField` (`relationTo`), `resolveLinks` (`href`), and
`generatePreviewPath`/`collectionLivePreview` (preview path). They have **already drifted**:
`link.ts` emits `/${slug}/` (trailing slash) while `generatePreviewPath.ts` emits
`/${slug}` (no trailing slash) — a doc's link href and its preview URL currently differ.
> ⚠️ This is a real latent inconsistency in twincedars right now; the package's single
> route map fixes the whole class by construction. (Minor today because of Next's
> trailing-slash redirects — worth a separate small fix, noted in the adoption section.)

**Solution — `defineRoutes()` produces one `SiteRoutes` object all three consume:**

```ts
export interface RouteEntry {
  prefix: string          // '' = site root (Pages); '/program', '/photos', …
  rootSlug?: string       // slug served at the section root (Pages: 'home')
  rootPath?: string       // default '/'
  label?: string          // editor-facing label for the link picker
}
export interface RoutesConfig {
  routes: Record<string, RouteEntry>
  trailingSlash?: boolean // ONE setting → link href & preview path can't disagree (default true)
}
export interface SiteRoutes {
  readonly collections: readonly string[]                        // for relationTo
  href(collection: string, slug?: string | null): string | undefined
  path(collection: string, slug: string): string                // bare path for preview
  isRoutable(collection: string): boolean
  entry(collection: string): RouteEntry | undefined
}
export function defineRoutes(config: RoutesConfig): SiteRoutes
```

A project declares its routes **once**, as data:

```ts
export const routes = defineRoutes({
  trailingSlash: true,
  routes: {
    pages:     { prefix: '',          rootSlug: 'home', rootPath: '/' },
    news:      { prefix: '/news',     label: 'News post' },
    events:    { prefix: '/events',   label: 'Event' },
    programs:  { prefix: '/program',  label: 'Program' },   // SINGULAR — declared once
    locations: { prefix: '/locations', label: 'Location' },
    galleries: { prefix: '/photos',   label: 'Gallery' },   // RENAMED — declared once
  },
})
```

`programs→/program` and `galleries→/photos` are now physically impossible to define
inconsistently. Apply the **same one-source-of-truth** idea to block types (a single
`blockType→label` registry feeds `BlockRowLabel`, the renderer map, and any block UI).

---

## 4. Config API sketch (key signatures)

```ts
// fields
linkField(opts: { routes: SiteRoutes; overrides?: {linkType?;linkTo?;href?;newTab?: string}; extraLinkTypes?: RadioFieldOption[] }): Field[]
resolveLinks<T>(node: T, routes: SiteRoutes): T            // pure; caller still does structuredClone()
slugField(opts?: { sourceField?: string; access?: FieldAccess; hideFromUser?: Condition; overrides?: Partial<TextField> }): TextField
seoField(opts?: { name?: string; uploadCollection?: string; access?: FieldAccess }): GroupField

// preview (bind once to avoid repeating opts per collection)
createPreview(opts: { routes: SiteRoutes; serverURL?: string; previewSecret?: string; previewRoute?: string; breakpoints?: LivePreviewConfig['breakpoints'] }): {
  generatePreviewPath(args: { collection: string; slug?: string | null }): string | null
  collectionLivePreview(collection: string): Pick<NonNullable<CollectionConfig['admin']>, 'livePreview' | 'preview'>
}

// media
mediaCollection(opts: { slug?: string; staticDir: string; imageSizes?: ImageSize[]; categories?: {label;value:string}[] | false; sourcePathField?: boolean; extraFields?: Field[]; admin?: {...}; access?: CollectionConfig['access'] }): CollectionConfig

// layout builder
withRowLabels(blocks: Block[], labelComponent?: string): Block[]   // injects admin.components.Label per block
```

**`BlockRowLabel` is `'use client'`**, so it can't take a closure — pass its config as
serializable **`clientProps`** (Payload's intended channel) from the server config:

```ts
admin: { components: { RowLabel: {
  path: '@houseoftag/payload-kit/client#BlockRowLabel',
  clientProps: { typeLabels: BLOCK_TYPE_LABELS, snippetFields: ['heading','title','body'] },
} } }
```
(Fallback for older Payload without `clientProps`: ship a codegen helper that emits a tiny
project-local module re-exporting `BlockRowLabel` pre-bound to the maps.)

---

## 5. Packaging architecture (the part most likely to bite)

The package mixes **three runtime contexts** that must never share a barrel:
Payload server config · Next server utils · React `'use client'` components.

### Four subpath exports — one runtime context each
| Subpath | Contents | Why separate |
|---|---|---|
| `.` (root) | `linkField`, `resolveLinks`, `defineRoutes`, `createPreview`, `mediaCollection`, `withRowLabels`, the `payloadKit` plugin, `PreviewSearchParams` | server/Payload config — **type-only** `import type { Field } from 'payload'`, no `'use client'` anywhere in this graph |
| `./client` | `BlockRowLabel`, `LivePreviewListener` (a `'use client'` barrel of client-only files) | the `'use client'` directive is a **module-graph boundary, not a per-export flag** — re-exporting it from root would drag `@payloadcms/ui`/React-DOM into `payload.config`'s server graph and break the RSC build |
| `./next` | draft-mode + preview/exit-preview route handlers (import `next/headers`) | so a pure-Payload consumer (migrations worker) never resolves `next` |
| `./fields` | just the field factories | ergonomic; configs that want fields without the preview/plugin surface |

> **Rule: one runtime context per entry file; no barrel ever re-exports across the
> server/client line.** Verify post-build that `dist/client/*.js` still starts with
> `'use client'` (tsup can strip it — if so, build the client entry `--no-bundle` or add a
> per-entry banner).

### peerDependencies (everything host-owned + singleton; ship ~nothing as a dep)
```jsonc
"peerDependencies": {
  "payload": ">=3 <4", "next": ">=15 <16", "react": ">=19 <20", "react-dom": ">=19 <20",
  "@payloadcms/ui": ">=3 <4", "@payloadcms/richtext-lexical": ">=3 <4", "@payloadcms/live-preview-react": ">=3 <4"
},
"peerDependenciesMeta": {  // mark context-specific peers optional so root-entry users get no noise
  "next": {"optional": true}, "@payloadcms/ui": {"optional": true},
  "@payloadcms/richtext-lexical": {"optional": true}, "@payloadcms/live-preview-react": {"optional": true}
},
"dependencies": {}
```
`@payloadcms/ui` **must** be a peer (it carries the `useRowLabel` admin React context — a
duplicate copy returns `undefined`). Use major-bounded ranges (`>=3 <4`), not caret-minor,
or every Payload patch triggers peer warnings. Keep `payload`/`react`/`react-dom` peers to
avoid duplicate-singleton bugs (invalid-hook-call, two `payload` instances).

### The importMap mechanism (the real gotcha — and it works)
Payload references admin components by **string** `"specifier#Export"` and
`payload generate:importmap` resolves the left side via normal Node resolution — **bare
package specifiers work and honor the `exports` map** (the repo already registers
`@payloadcms/next/rsc#CollectionCards` and lexical `client#*` this way). So a consumer writes:
```ts
admin: { components: { RowLabel: '@houseoftag/payload-kit/client#BlockRowLabel' } }
```
then runs `payload generate:importmap`. Pitfalls: the string is `subpath#NamedExport` (give
them one canonical `/client` subpath + the **named** export, treat client export names as a
public API contract); the component must be `'use client'` on a client-only subpath; the
generator runs against the consumer's installed `node_modules`, so `exports`/`types`/`files`
must be correct or it silently omits the entry (default "Block" label).

### Build / tooling
ESM-only (`"type": "module"`), **tsup** (esbuild) with `format: ['esm']`, `dts: true`,
`splitting: false`, `external: [all peers + next/navigation + next/headers]`. Types-first
`exports` conditions, `import` only (no `require` — avoid the dual-package hazard).
`"files": ["dist"]`, `"engines": {"node": ">=20"}`, `"publishConfig": {"access": "public"}`.

### Plugin AND helpers (layered, ship both)
- **Helpers** are the base layer (`linkField`, `resolveLinks`, `createPreview`, …) and must
  work with no plugin — that's what `payload.config` and `RenderBlocks` import directly.
- **A thin `payloadKit(options) => (config) => config` plugin** built on top: injects a
  Media collection (opt-in), merges `collectionLivePreview` + flips `versions.drafts` on
  named collections, and registers the admin component **by string only**. The plugin lives
  in `.` (server) and must **never `import` the client component value** (that would pull a
  `'use client'` boundary into `payload.config` — the whole reason the string-based
  importMap exists). Helpers stay usable à la carte; the plugin removes the boilerplate +
  the easy-to-forget `generate:importmap` step.

### Proposed layout
```
src/
  index.ts            # "."     server: re-exports fields + preview + plugin + PreviewSearchParams (NO client imports)
  fields/index.ts     # "./fields"
  fields/link.ts      # linkField, resolveLinks (import type Field)
  preview/{types.ts, generatePreviewPath.ts, collectionLivePreview.ts, createPreview.ts}
  plugin/index.ts     # payloadKit(opts) — emits component STRING only
  next/index.ts       # "./next" — preview route handlers (next/headers)
  client/
    index.ts          # "./client" — 'use client' barrel
    BlockRowLabel.tsx  # 'use client'
    LivePreviewListener.tsx  # 'use client'
  access/index.ts     # "./access" — generic role kit
```

---

## 6. Required refactors before extraction (ranked blockers)
1. **`generatePreviewPath.ts` imports `PreviewSearchParams` from the app route** — inline
   that type into the package and have the app route import it back from the package
   (invert the dependency). This is the #1 portability blocker.
2. **Parameterize the route maps** (`LINKABLE_COLLECTIONS`, `COLLECTION_PREFIX`,
   `collectionPrefixMap`) → the single `SiteRoutes`. Fixes the trailing-slash drift.
3. **`BlockRowLabel.TYPE_LABELS`** → `clientProps`-driven (else it's a sample, not a library
   component).
4. **`process.env` reads** (`NEXT_PUBLIC_SERVER_URL`, `PREVIEW_SECRET`, `MEDIA_DIR`) →
   options that *default* to those env vars, so env names aren't a hidden coupling.
5. **Access guards** in `slugField`/`seoField` → injected options.

---

## 7. Adoption path for twincedars (incremental, migration-free)

The lever: **none of these helpers are schema** — link fields, RowLabels, live-preview
config, importMap entries are all admin/wiring. So the whole swap is migration-free **if
field names/shapes are preserved.** Order by blast radius, smallest first:

- **Step 0** — publish v0.1 by *lifting the current twincedars files verbatim*,
  parameterizing only the two maps. v0.1 behavior must be byte-identical to today (makes
  each swap below a no-op diff). Add as a `file:`/workspace dep first, npm later.
- **Step 1** — `resolveLinks`: swap the body for the package import in `RenderBlocks.tsx`.
  Pure, lowest risk, proof-of-concept.
- **Step 2** — `linkField()`: keep `src/fields/link.ts` as a **thin re-export shim** so the
  8 CTA-block imports don't churn; package must emit the **same field names**
  (`linkType/linkTo/href/newTab`) → no migration.
- **Step 3** — `collectionLivePreview` + preview routes: point the local util at the
  package (keep a shim); replace the two route files with one-line re-exports.
- **Step 4** *(only fiddly bit)* — `BlockRowLabel` + importMap: keep the local component as
  a re-export of the package's (zero importMap churn) **or** reference the package path and
  re-run `generate:importmap`. Never hand-edit `importMap.js`.
- **Step 5** — adopt `mediaCollectionDefaults` (keep `imageSizes` identical to avoid
  variant regeneration) and **delete `MediaGridView.tsx`** (dead picker-hijack code).

**Safety gate:** after each step, run `payload migrate:create __adoption_check` against a
throwaway DB (`DATABASE_URI=file:/tmp/t.db`) and assert it produces an **empty** migration.
Non-empty = a field shape drifted; fix the *package contract*, not the DB. **Stays local
permanently:** the route *files* (one-line re-exports — Next needs the physical file),
`payload.config.ts`, all `fields` arrays, the project's route map + breakpoints, the
`(frontend)` server components (their `depth`/`draft` choices), seed scripts.
*(Separately: also do the known follow-up of wiring `linkField` into the Header/Footer nav
globals — that's a feature, not part of the swap.)*

---

## 8. Versioning — three clocks, three jobs

- **Package → SemVer** (`@houseoftag/payload-kit@MAJOR.MINOR.PATCH`). It's code with a
  contract: **MAJOR** = breaking signature/behavior change (would force a consumer migration
  or code change), **MINOR** = additive helper/optional param, **PATCH** = bugfix same
  contract. Pinned in `package.json`/lockfile (loud failure = build/type error).
- **Skill → CalVer** (`payload@YYYY.M.D`, auto-bumped by the marketplace hook). Answers
  *"is the project's understanding stale?"* — knowledge has no "breaking."
- **Per-project pin** (`.claude/payload-skill-version`) pins the **skill CalVer** (the
  package is already pinned by the lockfile). Quiet failure = a re-introduced footgun, which
  is why it needs an explicit ritual check on the next QoL request.

**Connecting rule:** each skill best-practice row names the package version that delivers it
— *"use `payload-kit` `linkField()` (≥ 2.1.0) — also wire it into nav globals (judgment)."*
The CalVer dates the advice, the SemVer floor says which release implements it, the pin
triggers re-reading it. **Extend `.claude/payload-skill-version` to record both** the skill
CalVer *and* the adopted `payload-kit` SemVer, so a future agent can detect either axis of
staleness.

---

## 9. Open questions for the build session
- **Monorepo or standalone repo?** Standalone `houseoftag/payload-kit` (npm-published) vs a
  workspace package. Standalone matches the "install across projects" goal; start `file:` then publish.
- **`mediaCollection` full factory vs `mediaCollectionDefaults` spreadable partial?** The
  partial composes better with project-specific fields; the full factory is more turnkey. (Lean partial + a thin factory on top.)
- **Ship `MediaGridView` at all?** Recommend: no, until it's rewritten as a client
  `ListDrawer`-aware picker. Keep the prohibition in the skill.
- **`BlockRowLabel` config:** rely on `clientProps` (needs current Payload) vs the codegen
  fallback — decide the minimum supported Payload version.
- **License / scope:** `@houseoftag/payload-kit`, MIT, public (no client secrets in it).

## 10. Out of scope
The *knowledge* (gotchas, the picker-drawer prohibition, the drizzle recreate
`INSERT…SELECT` fix, PTY `migrate:create`, drafts-on-existing-data backfill, the
contribution workflow) stays in the `payload` skill. This package is **only the mechanical
code**; the skill is updated to point at it.
