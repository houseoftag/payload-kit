import type { Condition, FieldAccess, FieldHook, TextField } from 'payload'
import { isAdminFieldLevel, isAdminUser } from '../access'

/** Lowercase, hyphenated, URL-safe slug from arbitrary text. Drops slashes. */
export const formatSlug = (val: string): string =>
  val
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // drop punctuation (incl. slashes)
    .replace(/[\s_]+/g, '-') // spaces / underscores -> hyphen
    .replace(/-+/g, '-') // collapse repeats
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens

/**
 * Derives the slug from `sourceField` ONLY when no slug is set. An already-set value
 * passes through untouched, so admin-entered values — including multi-segment Page
 * paths that contain "/" — are never reformatted.
 */
export const deriveSlug =
  (sourceField: string): FieldHook =>
  ({ value, data }) => {
    if (typeof value === 'string' && value.trim() !== '') return value
    const source = data?.[sourceField]
    return typeof source === 'string' && source.trim() !== '' ? formatSlug(source) : value
  }

export interface SlugFieldOptions {
  /** Sibling field the slug derives from when left blank (default `title`). */
  sourceField?: string
  /**
   * Field-level write guard (default: admins only, from the package access kit).
   * Read is intentionally left OPEN — the public frontend reads with no user, so
   * locking read would strip the slug from the live site and break routing.
   */
  access?: FieldAccess
  /** Admin-UI condition for who SEES the field (default: hidden from non-admins). */
  hideFromUser?: Condition
  /** Extra field config merged on top (e.g. a custom `validate` or `admin`). */
  overrides?: Partial<TextField>
}

/**
 * Shared slug field: required + unique, AUTO-DERIVED from `sourceField` when blank,
 * generated server-side via a `beforeValidate` hook so the required field validates
 * even though editors never supply it. Editors are kept out via `admin.condition`
 * (UI-only) plus an admin-only write guard (the actual enforcement).
 */
export const slugField = ({
  sourceField = 'title',
  access: writeAccess = isAdminFieldLevel,
  hideFromUser = (_data, _siblingData, { user }) => isAdminUser(user),
  overrides = {},
}: SlugFieldOptions = {}): TextField => {
  const { access, hooks, admin, ...rest } = overrides
  // `as TextField`: TextField is a discriminated union (hasMany true/false), and
  // spreading a Partial of it defeats TS's narrowing — so we assert the merged shape.
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    index: true,
    ...rest,
    admin: {
      condition: hideFromUser,
      ...admin,
    },
    access: {
      create: writeAccess,
      update: writeAccess,
      ...access,
    },
    hooks: {
      beforeValidate: [deriveSlug(sourceField)],
      ...hooks,
    },
  } as TextField
}
