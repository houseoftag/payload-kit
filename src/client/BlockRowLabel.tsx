'use client'

import * as React from 'react'
import { useRowLabel } from '@payloadcms/ui'
import type { BlockRowLabelClientProps } from '../layout/types'

/**
 * Row label for a layout-builder `blocks` field. Instead of every collapsed row reading
 * "Block", it shows the section type + a content snippet — e.g.
 * "01. Hero — Empowering children, youth & families" — so the layout reads as a
 * scannable list of named sections.
 *
 * Library-grade: the `typeLabels` map and `snippetFields` priority come in as Payload
 * `clientProps` (a serializable channel — this is a `'use client'` component and can't
 * take a closure). Register it by string on each block via `withRowLabels`.
 */

const DEFAULT_SNIPPET_FIELDS = [
  'heading',
  'title',
  'headline',
  'eyebrow',
  'label',
  'intro',
  'body',
  'footerText',
]

export function BlockRowLabel(props: BlockRowLabelClientProps = {}): React.ReactElement {
  const { data, rowNumber } = useRowLabel<Record<string, unknown>>()

  const typeLabels = props.typeLabels ?? {}
  const snippetFields = props.snippetFields ?? DEFAULT_SNIPPET_FIELDS

  const blockType = typeof data?.blockType === 'string' ? data.blockType : ''
  const typeLabel = typeLabels[blockType] || blockType || 'Section'

  // First meaningful text on the block, in priority order.
  let snippet = ''
  for (const field of snippetFields) {
    const value = data?.[field]
    if (typeof value === 'string' && value.trim()) {
      snippet = value.trim()
      break
    }
  }
  if (snippet.length > 60) snippet = `${snippet.slice(0, 57)}…`

  const n = typeof rowNumber === 'number' ? String(rowNumber + 1).padStart(2, '0') : ''

  return (
    <span>
      {n ? <span style={{ opacity: 0.5 }}>{n}. </span> : null}
      <strong>{typeLabel}</strong>
      {snippet ? <span style={{ opacity: 0.75 }}>{` — ${snippet}`}</span> : null}
    </span>
  )
}

export default BlockRowLabel
