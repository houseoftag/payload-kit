/**
 * The single source of truth for per-collection routing.
 *
 * The same per-collection route knowledge used to live in three places — the link
 * field's `relationTo`, `resolveLinks`' href, and the preview path — and could (and
 * did) drift. `defineRoutes` collapses all three onto ONE `SiteRoutes` object so a
 * doc's in-content link href and its preview URL are physically incapable of
 * disagreeing. Declare routes once, as data; everything else consumes this.
 */

export interface RouteEntry {
  /** URL prefix for this collection. `''` = served at the site root (e.g. Pages). */
  prefix: string
  /** Slug served at the section root (e.g. Pages' `'home'`); that doc maps to `rootPath`. */
  rootSlug?: string
  /** Path the root doc resolves to (default `'/'`). */
  rootPath?: string
  /** Editor-facing label for the link picker (e.g. `'News post'`). */
  label?: string
  /**
   * Doc field holding the routable slug (default `'slug'`). For collections keyed by
   * an external system's handle (e.g. a BigCommerce product slug stored as `bcSlug`).
   */
  slugField?: string
}

export interface RoutesConfig {
  /** Keyed by collection slug, in the order they should appear in the link picker. */
  routes: Record<string, RouteEntry>
  /**
   * One switch so a doc's link href and its preview path can never disagree
   * (default `true` — matches the `/section/slug/` convention).
   */
  trailingSlash?: boolean
}

export interface SiteRoutes {
  /** Collection slugs, in declared order — feed straight into the link field's `relationTo`. */
  readonly collections: readonly string[]
  /**
   * Site path for a populated doc, or `undefined` when the collection is non-routable
   * or the slug is empty. Used by `resolveLinks` to turn a picked doc into an href.
   */
  href(collection: string, slug?: string | null): string | undefined
  /** Bare site path for a routable collection + slug — used to build preview URLs. */
  path(collection: string, slug: string): string
  isRoutable(collection: string): boolean
  entry(collection: string): RouteEntry | undefined
  /** Name of the doc field holding the collection's routable slug (default `'slug'`). */
  slugFieldOf(collection: string): string
}

export function defineRoutes(config: RoutesConfig): SiteRoutes {
  const { routes, trailingSlash = true } = config
  const collections = Object.freeze([...Object.keys(routes)])
  const tail = trailingSlash ? '/' : ''

  const entry = (collection: string): RouteEntry | undefined => routes[collection]

  const isRoutable = (collection: string): boolean =>
    Object.prototype.hasOwnProperty.call(routes, collection)

  const path = (collection: string, slug: string): string => {
    const e = routes[collection]
    if (!e) return ''
    // The section-root doc (e.g. Pages' "home") is served at the site root, not at /home.
    if (e.rootSlug !== undefined && slug === e.rootSlug) return e.rootPath ?? '/'
    // NB: the slug is NOT percent-encoded — Pages support multi-segment paths
    // ("about/history") whose "/" must survive. Slugs are URL-safe by construction
    // (see formatSlug + the Pages slug validate).
    return `${e.prefix}/${slug}${tail}`
  }

  const href = (collection: string, slug?: string | null): string | undefined => {
    if (!routes[collection]) return undefined
    if (typeof slug !== 'string' || slug === '') return undefined
    return path(collection, slug)
  }

  const slugFieldOf = (collection: string): string => routes[collection]?.slugField ?? 'slug'

  return Object.freeze({ collections, href, path, isRoutable, entry, slugFieldOf })
}
