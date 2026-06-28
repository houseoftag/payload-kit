import type { Block, PayloadComponent } from 'payload'
import type { BlockRowLabelClientProps } from './types'

export type { BlockRowLabelClientProps } from './types'

/**
 * Default importMap specifier for the package's client `BlockRowLabel`. Payload
 * resolves this bare-package `subpath#NamedExport` string via normal Node resolution
 * (honoring the `exports` map) when you run `payload generate:importmap`.
 */
const DEFAULT_ROW_LABEL = '@houseoftag/payload-kit/client#BlockRowLabel'

export interface RowLabelOptions {
  /** importMap specifier `subpath#Export` (default the package's `BlockRowLabel`). */
  component?: string
  /** Serializable props forwarded to the client component (`typeLabels`, `snippetFields`). */
  clientProps?: BlockRowLabelClientProps
}

/** `'a/b#Export'` → a Payload component reference, carrying `clientProps` when present. */
const toComponent = (spec: string, clientProps?: BlockRowLabelClientProps): PayloadComponent => {
  if (!clientProps) return spec as PayloadComponent
  const hash = spec.indexOf('#')
  const path = hash === -1 ? spec : spec.slice(0, hash)
  const exportName = hash === -1 ? undefined : spec.slice(hash + 1)
  return { path, exportName, clientProps } as unknown as PayloadComponent
}

/**
 * Attach the shared row label to a single block. Payload reads a collapsed-row label
 * for a `blocks` field from each BLOCK's `admin.components.Label` (the field-level
 * `RowLabel` slot only applies to `array` fields and is silently ignored for `blocks`).
 */
export const withRowLabel = (block: Block, opts: RowLabelOptions = {}): Block => ({
  ...block,
  admin: {
    ...block.admin,
    components: {
      ...block.admin?.components,
      Label: toComponent(opts.component ?? DEFAULT_ROW_LABEL, opts.clientProps),
    },
  },
})

/** Map `withRowLabel` across a block list. */
export const withRowLabels = (blocks: Block[], opts: RowLabelOptions = {}): Block[] =>
  blocks.map((block) => withRowLabel(block, opts))
