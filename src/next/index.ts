import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

export type { PreviewSearchParams } from '../preview/types'

/** The `config` shape `getPayload` accepts (a config or a promise of one). */
type PayloadConfigArg = NonNullable<Parameters<typeof getPayload>[0]>['config']

export interface PreviewRouteOptions {
  /** Your Payload config — `import config from '@payload-config'`. */
  config: PayloadConfigArg
  /** Shared secret. Defaults to `process.env.PREVIEW_SECRET`. */
  previewSecret?: string
}

/**
 * Collection-agnostic `/next/preview` GET handler. The consumer's route file becomes:
 *
 *   import config from '@payload-config'
 *   import { previewRouteHandler } from '@houseoftag/payload-kit/next'
 *   export const { GET } = previewRouteHandler({ config })
 *
 * Verifies the secret + the user's auth token, enables draft mode, redirects to `path`.
 */
export const previewRouteHandler = ({
  config,
  previewSecret,
}: PreviewRouteOptions): { GET: (req: NextRequest) => Promise<Response> } => {
  const GET = async (req: NextRequest): Promise<Response> => {
    const payload = await getPayload({ config })

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    const secret = previewSecret ?? process.env.PREVIEW_SECRET

    if (searchParams.get('previewSecret') !== secret) {
      return new Response('You are not allowed to preview this page', { status: 403 })
    }
    if (!path) {
      return new Response('Insufficient search params', { status: 404 })
    }
    if (!path.startsWith('/')) {
      return new Response('This endpoint can only be used for relative previews', { status: 500 })
    }

    let user
    try {
      const authResult = await payload.auth({ headers: req.headers })
      user = authResult.user
    } catch (error) {
      payload.logger.error({ err: error }, 'Error verifying token for live preview')
      return new Response('You are not allowed to preview this page', { status: 403 })
    }

    const draft = await draftMode()

    if (!user) {
      draft.disable()
      return new Response('You are not allowed to preview this page', { status: 403 })
    }

    draft.enable()
    redirect(path)
  }

  return { GET }
}

/**
 * Collection-agnostic `/next/exit-preview` GET handler. The consumer's route file:
 *
 *   import { exitPreviewRouteHandler } from '@houseoftag/payload-kit/next'
 *   export const { GET } = exitPreviewRouteHandler()
 */
export const exitPreviewRouteHandler = (): { GET: () => Promise<Response> } => {
  const GET = async (): Promise<Response> => {
    const draft = await draftMode()
    draft.disable()
    return new Response('Draft mode is disabled')
  }

  return { GET }
}
