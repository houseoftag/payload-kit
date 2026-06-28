import type { CollectionConfig, Field, ImageSize } from 'payload'

export interface MediaCategory {
  label: string
  value: string
}

export interface MediaCollectionOptions {
  /** Collection slug (default `media`). */
  slug?: string
  /**
   * REQUIRED. Absolute upload dir — pass it in so the package never reads `MEDIA_DIR`
   * itself. The host owns volume layout, e.g.
   *   `process.env.MEDIA_DIR || path.resolve(dirname, '../../media')`.
   */
  staticDir: string
  /** Generated image sizes (default: a square `thumbnail` + `card` + `feature`). */
  imageSizes?: ImageSize[]
  /** Category taxonomy for the sidebar filter; pass `false` to omit the field entirely. */
  categories?: MediaCategory[] | false
  /** Add the readonly `sourcePath` provenance field (import idempotency). Default `false`. */
  sourcePathField?: boolean
  /** Accepted mime types (default `['image/*', 'application/pdf']`). */
  mimeTypes?: string[]
  /** `admin.useAsTitle` (default `alt` — human-readable in the picker drawer). */
  useAsTitle?: string
  /** `admin.defaultColumns` (default `alt`, `category`?, `filename`, `updatedAt`). */
  defaultColumns?: string[]
  /** `admin.listSearchableFields` (default `['alt', 'filename']`). */
  listSearchableFields?: string[]
  /** Library/drawer page size (default `{ defaultLimit: 24 }`). */
  pagination?: NonNullable<CollectionConfig['admin']>['pagination']
  /** Extra fields appended after the built-ins. */
  extraFields?: Field[]
  /** Collection access (default `{ read: () => true }`). */
  access?: CollectionConfig['access']
  /** Extra `admin` config merged on top. */
  admin?: CollectionConfig['admin']
  /** Extra `upload` config merged on top. */
  upload?: Record<string, unknown>
}

const DEFAULT_IMAGE_SIZES: ImageSize[] = [
  { name: 'thumbnail', width: 300, height: 300, position: 'centre' },
  { name: 'card', width: 768 },
  { name: 'feature', width: 1600 },
]

const DEFAULT_CATEGORIES: MediaCategory[] = [
  { label: 'Brand', value: 'brand' },
  { label: 'Photos', value: 'photos' },
  { label: 'Team', value: 'team' },
  { label: 'Documents', value: 'documents' },
  { label: 'Other', value: 'other' },
]

/**
 * The spreadable `admin` + `upload` halves of a Media collection — compose with your
 * own fields when the full factory is too turnkey. Deliberately keeps Payload's DEFAULT
 * table list view (no custom grid): a custom list component ALSO replaces the list
 * inside the "Choose from existing" picker drawer, where the stock table's row-click →
 * select is exactly what makes it a working picker.
 */
export const mediaCollectionDefaults = (
  opts: MediaCollectionOptions,
): Pick<CollectionConfig, 'admin' | 'upload'> => {
  const hasCategories = opts.categories !== false
  return {
    admin: {
      useAsTitle: opts.useAsTitle ?? 'alt',
      defaultColumns:
        opts.defaultColumns ??
        ['alt', ...(hasCategories ? ['category'] : []), 'filename', 'updatedAt'],
      listSearchableFields: opts.listSearchableFields ?? ['alt', 'filename'],
      pagination: opts.pagination ?? { defaultLimit: 24 },
      ...opts.admin,
    },
    upload: {
      staticDir: opts.staticDir,
      mimeTypes: opts.mimeTypes ?? ['image/*', 'application/pdf'],
      // Square crop used as the thumbnail everywhere in the admin (grid + picker drawer).
      adminThumbnail: 'thumbnail',
      // Let editors set the visual focus so auto-crops keep the subject in frame.
      focalPoint: true,
      imageSizes: opts.imageSizes ?? DEFAULT_IMAGE_SIZES,
      ...opts.upload,
    },
  }
}

/**
 * Full Media collection factory: alt text (required, used as the title), an optional
 * category select in the sidebar, a caption, an optional provenance `sourcePath`, plus
 * any `extraFields`. Tuned for non-technical editors scanning the picker drawer.
 */
export const mediaCollection = (opts: MediaCollectionOptions): CollectionConfig => {
  const categories = opts.categories === false ? false : opts.categories ?? DEFAULT_CATEGORIES
  const { admin, upload } = mediaCollectionDefaults(opts)

  const fields: Field[] = [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt text',
      required: true,
      admin: { description: 'Describe the image for screen readers and SEO.' },
    },
    ...(categories
      ? ([
          {
            name: 'category',
            type: 'select',
            label: 'Category',
            admin: {
              description:
                'Groups the media library so it is easy to filter. Optional but recommended.',
              position: 'sidebar',
            },
            options: categories,
          },
        ] as Field[])
      : []),
    {
      name: 'caption',
      type: 'text',
      label: 'Caption',
      admin: { description: 'Optional caption shown beneath the image where supported.' },
    },
    ...(opts.sourcePathField
      ? ([
          {
            name: 'sourcePath',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              readOnly: true,
              description:
                'Provenance: the import-relative path this asset was imported from. ' +
                'Used to make the media import idempotent. Empty for hand-uploaded assets.',
            },
          },
        ] as Field[])
      : []),
    ...(opts.extraFields ?? []),
  ]

  return {
    slug: opts.slug ?? 'media',
    access: opts.access ?? { read: () => true },
    admin,
    upload,
    fields,
  }
}
