import type { CollectionConfig, GlobalConfig } from 'payload'
import type { SiteRoutes } from '../routes'
import type { LivePreviewBreakpoint, PreviewSearchParams } from './types'
import { DEFAULT_LIVE_PREVIEW_BREAKPOINTS } from './types'

export interface PreviewOptions {
  /** The shared route map — supplies the bare path per collection. */
  routes: SiteRoutes
  /** Public origin. Defaults to `process.env.NEXT_PUBLIC_SERVER_URL` at call time. */
  serverURL?: string
  /** Shared secret guarding the preview route. Defaults to `process.env.PREVIEW_SECRET`. */
  previewSecret?: string
  /** Path of the preview route handler (default `/next/preview`). */
  previewRoute?: string
  /** Live-preview device breakpoints (defaults to Mobile / Tablet / Desktop). */
  breakpoints?: LivePreviewBreakpoint[]
}

export interface PreviewHelpers {
  /** Build the `/next/preview?…` path for a doc, or `null` when it has no slug yet. */
  generatePreviewPath(args: { collection: string; slug?: string | null }): string | null
  /** Spreadable `admin.livePreview` + `admin.preview` for a slug-routed collection. */
  collectionLivePreview(
    collection: string,
  ): Pick<NonNullable<CollectionConfig['admin']>, 'livePreview' | 'preview'>
  /**
   * Spreadable `admin.livePreview` + `admin.preview` for a GLOBAL that renders a fixed
   * page (e.g. a HomePage global at `'/'`). Pass the site path the global renders at.
   */
  globalLivePreview(path: string): Pick<NonNullable<GlobalConfig['admin']>, 'livePreview' | 'preview'>
}

/**
 * Bind the preview helpers to a route map + options ONCE, then call per collection.
 * Env vars are read lazily (at call time) so they stay defaults, not hidden couplings,
 * and a late-loaded env still works.
 */
export function createPreview(opts: PreviewOptions): PreviewHelpers {
  const {
    routes,
    previewRoute = '/next/preview',
    breakpoints = DEFAULT_LIVE_PREVIEW_BREAKPOINTS,
  } = opts
  const serverURL = (): string => opts.serverURL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? ''
  const previewSecret = (): string => opts.previewSecret ?? process.env.PREVIEW_SECRET ?? ''

  const generatePreviewPath: PreviewHelpers['generatePreviewPath'] = ({ collection, slug }) => {
    if (slug === undefined || slug === null) return null

    // Trailing-slash convention comes from `routes` — a doc's preview URL is therefore
    // byte-identical to its in-content link href (same `SiteRoutes`, same setting).
    const path = routes.path(collection, slug)

    const params = new URLSearchParams({
      slug,
      collection,
      path,
      previewSecret: previewSecret(),
    } satisfies PreviewSearchParams)

    return `${previewRoute}?${params.toString()}`
  }

  // Honors the route's `slugField` (default `'slug'`) — see `RouteEntry.slugField`.
  const slugOf = (collection: string, data: unknown): string => {
    const s = (data as Record<string, unknown> | null | undefined)?.[routes.slugFieldOf(collection)]
    return typeof s === 'string' ? s : ''
  }

  const collectionLivePreview: PreviewHelpers['collectionLivePreview'] = (collection) => ({
    livePreview: {
      url: ({ data }) =>
        `${serverURL()}${generatePreviewPath({ collection, slug: slugOf(collection, data) }) ?? ''}`,
      breakpoints,
    },
    preview: (data) => generatePreviewPath({ collection, slug: slugOf(collection, data) }),
  })

  // Globals have no slug/collection — the preview handler only needs `path` + secret.
  const globalLivePreview: PreviewHelpers['globalLivePreview'] = (path) => {
    const previewPath = (): string => {
      const params = new URLSearchParams({ path, previewSecret: previewSecret() })
      return `${previewRoute}?${params.toString()}`
    }
    return {
      livePreview: {
        url: () => `${serverURL()}${previewPath()}`,
        breakpoints,
      },
      preview: () => previewPath(),
    }
  }

  return { generatePreviewPath, collectionLivePreview, globalLivePreview }
}
