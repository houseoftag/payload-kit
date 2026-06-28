// Runtime smoke test against the BUILT dist — asserts the refactored single route map
// reproduces the original twincedars behavior (link href, preview path, relationTo).
import assert from 'node:assert/strict'
import {
  defineRoutes,
  linkField,
  resolveLinks,
  createPreview,
  mediaCollection,
  withRowLabels,
} from '../dist/index.js'

const routes = defineRoutes({
  trailingSlash: true,
  routes: {
    pages: { prefix: '', rootSlug: 'home', rootPath: '/' },
    news: { prefix: '/news', label: 'News post' },
    events: { prefix: '/events', label: 'Event' },
    programs: { prefix: '/program', label: 'Program' },
    locations: { prefix: '/locations', label: 'Location' },
    galleries: { prefix: '/photos', label: 'Gallery' },
  },
})

// --- href: matches twincedars docHref exactly ---
assert.equal(routes.href('pages', 'home'), '/', 'pages/home → /')
assert.equal(routes.href('pages', 'about'), '/about/', 'pages/about → /about/')
assert.equal(routes.href('pages', 'about/history'), '/about/history/', 'nested page slug survives')
assert.equal(routes.href('programs', 'camp'), '/program/camp/', 'programs → singular /program/')
assert.equal(routes.href('galleries', 'spring'), '/photos/spring/', 'galleries → /photos/')
assert.equal(routes.href('news', ''), undefined, 'empty slug → undefined (leaves custom href)')
assert.equal(routes.href('unknown', 'x'), undefined, 'non-routable → undefined')
assert.deepEqual([...routes.collections], ['pages', 'news', 'events', 'programs', 'locations', 'galleries'])

// --- linkField: relationTo derived from routes ---
const lf = linkField({ routes })
const rel = lf.find((f) => f.name === 'linkTo')
assert.deepEqual(rel.relationTo, ['pages', 'news', 'events', 'programs', 'locations', 'galleries'])
assert.equal(lf[0].name, 'linkType')
assert.equal(lf.find((f) => f.name === 'newTab').type, 'checkbox')

// extraLinkTypes + overrides
const lf2 = linkField({
  routes,
  extraLinkTypes: [{ label: 'Anchor', value: 'anchor' }],
  overrides: { href: { label: 'URL or anchor' } },
})
assert.equal(lf2[0].options.length, 3, 'extra link type appended')
assert.equal(lf2.find((f) => f.name === 'href').label, 'URL or anchor', 'override applied')

// --- resolveLinks: polymorphic + legacy shapes, mutates in place ---
const node = {
  cta: { linkTo: { relationTo: 'programs', value: { slug: 'camp' } }, href: '', newTab: true },
  nested: [{ linkTo: { relationTo: 'pages', value: { slug: 'home' } }, href: '' }],
  legacy: { linkTo: { slug: 'about' }, href: '' }, // legacy single-collection (root) shape
  custom: { href: 'https://example.com' }, // no linkTo → left untouched
}
resolveLinks(node, routes)
assert.equal(node.cta.href, '/program/camp/', 'polymorphic resolved')
assert.equal(node.cta.newTab, true, 'newTab untouched')
assert.equal(node.nested[0].href, '/', 'home resolved through array')
assert.equal(node.legacy.href, '/about/', 'legacy root-collection shape resolved')
assert.equal(node.custom.href, 'https://example.com', 'custom href left as-is')

// --- createPreview: path identical to href (single source of truth) ---
process.env.PREVIEW_SECRET = 's3cret'
const preview = createPreview({ routes })
assert.equal(
  preview.generatePreviewPath({ collection: 'programs', slug: 'camp' }),
  '/next/preview?slug=camp&collection=programs&path=%2Fprogram%2Fcamp%2F&previewSecret=s3cret',
)
assert.equal(preview.generatePreviewPath({ collection: 'pages', slug: 'home' }).includes('path=%2F&'), true, 'home preview path = /')
assert.equal(preview.generatePreviewPath({ collection: 'pages', slug: null }), null, 'null slug → null')
const lp = preview.collectionLivePreview('programs')
assert.ok(lp.livePreview && typeof lp.preview === 'function')
assert.equal(lp.livePreview.breakpoints.length, 3)

// --- mediaCollection ---
const media = mediaCollection({ staticDir: '/data/media', sourcePathField: true })
assert.equal(media.slug, 'media')
assert.equal(media.admin.useAsTitle, 'alt')
assert.equal(media.upload.staticDir, '/data/media')
assert.ok(media.fields.some((f) => f.name === 'sourcePath'))
assert.ok(media.fields.some((f) => f.name === 'category'))
const mediaNoCat = mediaCollection({ staticDir: '/x', categories: false })
assert.ok(!mediaNoCat.fields.some((f) => f.name === 'category'), 'categories:false drops the field')
assert.ok(!mediaNoCat.admin.defaultColumns.includes('category'))

// --- withRowLabels: string by default, object with clientProps when provided ---
const blocks = [{ slug: 'hero', fields: [] }, { slug: 'prose', fields: [] }]
const labelledStr = withRowLabels(blocks)
assert.equal(labelledStr[0].admin.components.Label, '@houseoftag/payload-kit/client#BlockRowLabel')
const labelled = withRowLabels(blocks, { clientProps: { typeLabels: { hero: 'Hero' } } })
assert.equal(labelled[0].admin.components.Label.path, '@houseoftag/payload-kit/client')
assert.equal(labelled[0].admin.components.Label.exportName, 'BlockRowLabel')
assert.deepEqual(labelled[0].admin.components.Label.clientProps, { typeLabels: { hero: 'Hero' } })

// trailingSlash:false variant
const noSlash = defineRoutes({ trailingSlash: false, routes: { pages: { prefix: '', rootSlug: 'home' } } })
assert.equal(noSlash.href('pages', 'about'), '/about', 'trailingSlash:false honored')
assert.equal(noSlash.href('pages', 'home'), '/', 'root still /')

console.log('✓ smoke: all assertions passed')
