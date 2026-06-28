import type { Access, FieldAccess } from 'payload'

/**
 * Generic role-based access kit. The `'admin' | 'editor'` role names are the common
 * House-of-Tag default; `hasRole` takes any role string, so a project with a different
 * role set composes its own guards from it rather than being locked to these names.
 *
 * `slugField`/`seoField` accept these as *injected options* (defaulting to the
 * admin-only guards here) rather than hard-importing them — keep policy overridable.
 */

export type Role = string

export const hasRole = (user: unknown, role: string): boolean => {
  if (!user || typeof user !== 'object') return false
  const roles = (user as { roles?: unknown }).roles
  return Array.isArray(roles) && roles.includes(role)
}

/** Any signed-in user. */
export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

/** Admins only. */
export const isAdmin: Access = ({ req: { user } }) => hasRole(user, 'admin')

/** Admins or editors (the content team). */
export const isAdminOrEditor: Access = ({ req: { user } }) =>
  hasRole(user, 'admin') || hasRole(user, 'editor')

/** Field-level: only admins may set/change a value. */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => hasRole(user, 'admin')

/**
 * Plain boolean admin check — for `admin.condition`, which is handed `{ user }`
 * directly (not the full access args). Hides admin-only fields from editors in the
 * admin UI WITHOUT touching field read access (public reads must still work).
 */
export const isAdminUser = (user: unknown): boolean => hasRole(user, 'admin')

/** Public read. */
export const anyone: Access = () => true
