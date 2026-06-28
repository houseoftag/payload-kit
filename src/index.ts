/**
 * `@houseoftag/payload-kit` — root entry ("." export).
 *
 * Server / Payload-config surface ONLY. This graph must never reach a `'use client'`
 * module (that would drag @payloadcms/ui / React-DOM into `payload.config`'s server
 * graph and break the RSC build) and never `import` from `next/*` at runtime (so a
 * pure-Payload consumer — e.g. a migrations worker — never has to resolve `next`).
 *
 *   • client components → `@houseoftag/payload-kit/client`
 *   • Next route handlers → `@houseoftag/payload-kit/next`
 *   • access kit → `@houseoftag/payload-kit/access`
 */

// The single anti-drift route map.
export { defineRoutes } from './routes'
export type { RouteEntry, RoutesConfig, SiteRoutes } from './routes'

// Field factories.
export { linkField, resolveLinks, slugField, formatSlug, deriveSlug, seoField } from './fields'
export type { LinkFieldOptions, SlugFieldOptions, SeoFieldOptions } from './fields'

// Preview wiring (env-bound once via createPreview).
export { createPreview } from './preview/createPreview'
export type { PreviewOptions, PreviewHelpers } from './preview/createPreview'
export { DEFAULT_LIVE_PREVIEW_BREAKPOINTS } from './preview/types'
export type { PreviewSearchParams, LivePreviewBreakpoint } from './preview/types'

// Media collection factory.
export { mediaCollection, mediaCollectionDefaults } from './collections/media'
export type { MediaCollectionOptions, MediaCategory } from './collections/media'

// Layout-builder helpers (emit component STRINGS — safe in the server graph).
export { withRowLabel, withRowLabels } from './layout/rowLabel'
export type { RowLabelOptions, BlockRowLabelClientProps } from './layout/rowLabel'

// The thin convenience plugin built on the helpers above.
export { payloadKit } from './plugin'
export type { PayloadKitPluginOptions } from './plugin'
