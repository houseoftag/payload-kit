import type { Config } from 'payload'
import type { SiteRoutes } from '../routes'
import type { PreviewOptions } from '../preview/createPreview'
import { createPreview } from '../preview/createPreview'
import type { MediaCollectionOptions } from '../collections/media'
import { mediaCollection } from '../collections/media'

export interface PayloadKitPluginOptions {
  /** The shared route map. */
  routes: SiteRoutes
  /** Preview binding (serverURL / secret / route / breakpoints). Defaults to env. */
  preview?: Omit<PreviewOptions, 'routes'>
  /** Slugs to wire side-by-side live preview + a Preview button onto. */
  previewCollections?: string[]
  /** Slugs to enable drafts on (defaults to `previewCollections`). */
  draftsCollections?: string[]
  /** Autosave interval in ms (default `100`); `false` disables autosave. */
  autosave?: number | false
  /** Enable schedule-publish on drafted collections (default `true`). */
  schedulePublish?: boolean
  /** Inject a Media collection (skipped if one with that slug already exists). */
  media?: MediaCollectionOptions
}

/**
 * The thin, opt-in convenience layer over the helpers: merges `collectionLivePreview`
 * + flips `versions.drafts` on named collections and injects a Media collection.
 * Registers admin components by STRING only (via `withRowLabels`) — it never imports a
 * `'use client'` value, which is the whole reason the importMap is string-based. Every
 * helper stays usable à la carte without the plugin.
 */
export const payloadKit =
  (options: PayloadKitPluginOptions) =>
  (config: Config): Config => {
    const {
      routes,
      preview,
      previewCollections = [],
      draftsCollections = previewCollections,
      autosave = 100,
      schedulePublish = true,
      media,
    } = options

    const { collectionLivePreview } = createPreview({ routes, ...preview })
    const previewSet = new Set(previewCollections)
    const draftsSet = new Set(draftsCollections)

    const collections = (config.collections ?? []).map((collection) => {
      let next = collection

      if (previewSet.has(collection.slug)) {
        next = { ...next, admin: { ...next.admin, ...collectionLivePreview(collection.slug) } }
      }

      if (draftsSet.has(collection.slug)) {
        const versions = (typeof next.versions === 'object' ? next.versions : {}) as Record<
          string,
          unknown
        >
        const prevDrafts = (typeof versions.drafts === 'object' ? versions.drafts : {}) as Record<
          string,
          unknown
        >
        next = {
          ...next,
          versions: {
            ...versions,
            drafts: {
              ...prevDrafts,
              ...(autosave === false ? {} : { autosave: { interval: autosave } }),
              schedulePublish,
            },
          },
        } as typeof next
      }

      return next
    })

    if (media) {
      const mediaConfig = mediaCollection(media)
      if (!collections.some((c) => c.slug === mediaConfig.slug)) {
        collections.push(mediaConfig)
      }
    }

    return { ...config, collections }
  }
