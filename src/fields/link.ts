import type { CollectionSlug, Field, RadioField } from 'payload'
import type { SiteRoutes } from '../routes'

/**
 * Reusable link field — the "internal page vs custom URL" toggle editors asked for:
 *   • linkType — radio: "Page on this site" (internal) vs "Custom URL".
 *   • linkTo   — internal: a polymorphic relationship to every routable collection
 *                (derived from `routes`), rendered as a type-to-complete search box.
 *   • href     — custom: a free-text URL/path.
 *   • newTab   — open the link in a new browser tab.
 *
 * Spread into any block group/array:  fields: [ ...other, ...linkField({ routes }) ]
 *
 * Presentational components keep reading a plain string `href` (+ optional `newTab`):
 * `resolveLinks()` turns whichever internal doc was picked into the correct site path
 * BEFORE render (it needs the relationship populated — fetch with `depth >= 1`), so
 * components stay route-unaware.
 */

type LinkSubfield = 'linkType' | 'linkTo' | 'href' | 'newTab'

export interface LinkFieldOptions {
  /** The shared route map — supplies `relationTo` (its routable collections). */
  routes: SiteRoutes
  /** Per-subfield overrides shallow-merged onto the generated field (labels, admin, …). */
  overrides?: Partial<Record<LinkSubfield, Partial<Field>>>
  /** Extra options appended to the `linkType` radio (e.g. an `'archive'` choice). */
  extraLinkTypes?: NonNullable<RadioField['options']>
}

export const linkField = ({ routes, overrides = {}, extraLinkTypes = [] }: LinkFieldOptions): Field[] => {
  const o = (name: LinkSubfield): Partial<Field> => overrides[name] ?? {}

  return [
    {
      name: 'linkType',
      type: 'radio',
      label: 'Link to',
      defaultValue: 'internal',
      options: [
        { label: 'Page on this site', value: 'internal' },
        { label: 'Custom URL', value: 'custom' },
        ...extraLinkTypes,
      ],
      admin: {
        layout: 'horizontal',
        description: 'Point this link at a page on this site, or type a custom URL.',
      },
      ...o('linkType'),
    },
    {
      name: 'linkTo',
      type: 'relationship',
      relationTo: [...routes.collections] as unknown as CollectionSlug[],
      label: 'Search for a page',
      admin: {
        description: 'Start typing to find a page on this site.',
        // Show for internal links. Tolerate legacy rows (no linkType) that already
        // picked a doc, so existing internal links stay visible/editable.
        condition: (_data, siblingData) =>
          siblingData?.linkType !== 'custom' &&
          (siblingData?.linkType === 'internal' || !siblingData?.linkType || !!siblingData?.linkTo),
      },
      ...o('linkTo'),
    },
    {
      name: 'href',
      type: 'text',
      label: 'Custom URL',
      admin: {
        description: 'An external link (https://…) or a path (/give).',
        // Show for custom links, and for legacy rows (no linkType) that typed a URL.
        condition: (_data, siblingData) =>
          siblingData?.linkType === 'custom' || (!siblingData?.linkType && !!siblingData?.href),
      },
      ...o('href'),
    },
    {
      name: 'newTab',
      type: 'checkbox',
      label: 'Open in a new tab',
      defaultValue: false,
      ...o('newTab'),
    },
  ] as Field[]
}

/**
 * Walk a (cloned) block tree and, for any object produced by `linkField`, set `href`
 * to the picked internal doc's site path (via `routes.href`). Leaves the editor-typed
 * custom `href` in place when no internal doc is picked; leaves `newTab` untouched.
 * Mutates in place — pass a `structuredClone()`. Requires the relationship populated
 * (fetch the doc with `depth >= 1`).
 */
export const resolveLinks = <T>(node: T, routes: SiteRoutes): T => {
  // The collection served at the site root (prefix ''), used for the legacy
  // single-collection relationship shape where `linkTo` is the doc itself.
  const rootCollection = routes.collections.find((c) => routes.entry(c)?.prefix === '')

  const docHref = (collection: string | undefined, doc: unknown): string | undefined => {
    if (!collection || !doc || typeof doc !== 'object') return undefined
    const slug = (doc as { slug?: unknown }).slug
    if (typeof slug !== 'string' || !slug) return undefined
    return routes.href(collection, slug)
  }

  const linkToHref = (linkTo: unknown): string | undefined => {
    if (linkTo && typeof linkTo === 'object' && 'relationTo' in linkTo) {
      const { relationTo, value } = linkTo as { relationTo: string; value: unknown }
      return docHref(relationTo, value)
    }
    // Legacy shape: a single-collection relationship — value is the doc itself.
    return docHref(rootCollection, linkTo)
  }

  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    if (n && typeof n === 'object') {
      const obj = n as Record<string, unknown>
      if ('linkTo' in obj) {
        const fromDoc = linkToHref(obj.linkTo)
        if (fromDoc) obj.href = fromDoc
      }
      for (const key of Object.keys(obj)) {
        // Don't recurse into the populated relationship value (avoids deep doc chains).
        if (key === 'linkTo') continue
        walk(obj[key])
      }
    }
  }

  walk(node)
  return node
}
