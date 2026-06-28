'use client'

import * as React from 'react'
import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'

export interface LivePreviewListenerProps {
  /** Public origin. Defaults to `process.env.NEXT_PUBLIC_SERVER_URL`. */
  serverURL?: string
}

/**
 * Thin wrapper around `RefreshRouteOnSave` that refreshes the route on save. Mount it
 * in the frontend ONLY when draft mode is enabled (the consumer gates this).
 */
export const LivePreviewListener: React.FC<LivePreviewListenerProps> = ({ serverURL }) => {
  const router = useRouter()

  return (
    <RefreshRouteOnSave
      refresh={() => router.refresh()}
      serverURL={serverURL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? ''}
    />
  )
}

export default LivePreviewListener
