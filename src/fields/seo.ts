import type { CollectionSlug, Condition, FieldAccess, GroupField } from 'payload'
import { isAdminFieldLevel, isAdminUser } from '../access'

export interface SeoFieldOptions {
  /** Field name (default `seo`). Use a distinct name for a site-wide default group. */
  name?: string
  /** Group label shown in the admin UI (default `SEO`). */
  label?: string
  /** Label for the Open Graph image upload (default `Open Graph image`). */
  ogImageLabel?: string
  /** Upload collection the OG image relates to (default `media`). */
  uploadCollection?: string
  /** Field-level write guard (default: admins only). Read stays open (public <head>). */
  access?: FieldAccess
  /** Admin-UI condition for who SEES the group (default: hidden from non-admins). */
  hideFromUser?: Condition
}

/**
 * Shared SEO group — meta title/description + Open Graph image. Editors never see or
 * edit SEO (hidden via `admin.condition`); admins do. Write is admin-only; read is left
 * OPEN so the public frontend (no user) keeps SEO in the live site's <head>.
 */
export const seoField = ({
  name = 'seo',
  label = 'SEO',
  ogImageLabel = 'Open Graph image',
  uploadCollection = 'media',
  access = isAdminFieldLevel,
  hideFromUser = (_data, _siblingData, { user }) => isAdminUser(user),
}: SeoFieldOptions = {}): GroupField => ({
  name,
  type: 'group',
  label,
  access: {
    create: access,
    update: access,
  },
  admin: {
    condition: hideFromUser,
  },
  fields: [
    { name: 'metaTitle', type: 'text' },
    { name: 'metaDescription', type: 'textarea' },
    {
      name: 'ogImage',
      type: 'upload',
      relationTo: uploadCollection as CollectionSlug,
      label: ogImageLabel,
    },
  ],
})
