/**
 * Serializable props for the `BlockRowLabel` client component. Lives in its own
 * import-free module so both the server-side `withRowLabels` helper (which forwards
 * them as Payload `clientProps`) and the `'use client'` component can share the type
 * without dragging one runtime graph into the other.
 */
export interface BlockRowLabelClientProps {
  /** `blockType` → human label, e.g. `{ hero: 'Hero', textAside: 'Text + Aside' }`. */
  typeLabels?: Record<string, string>
  /** Field names, in priority order, to pull the row's content snippet from. */
  snippetFields?: string[]
}
