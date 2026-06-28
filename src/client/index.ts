'use client'

/**
 * `@houseoftag/payload-kit/client` — the `'use client'` barrel.
 *
 * `'use client'` is a module-graph BOUNDARY, not a per-export flag: these must live on
 * a client-only subpath so re-exporting them from root never drags @payloadcms/ui /
 * React-DOM into the server config graph. The named exports here are a public API
 * contract — Payload's importMap references them by name (`…/client#BlockRowLabel`).
 */

export { BlockRowLabel } from './BlockRowLabel'
export { LivePreviewListener } from './LivePreviewListener'
export type { LivePreviewListenerProps } from './LivePreviewListener'
export type { BlockRowLabelClientProps } from '../layout/types'
