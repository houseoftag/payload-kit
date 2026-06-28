/**
 * Search-param contract for the `/next/preview` route handler. Owned by the package
 * (the app's preview route imports it back from here — inverting the old dependency
 * where this type lived in the app and the preview util reached into the app route).
 */
export interface PreviewSearchParams {
  slug: string
  collection: string
  path: string
  previewSecret: string
}

export interface LivePreviewBreakpoint {
  label: string
  name: string
  width: number
  height: number
}

export const DEFAULT_LIVE_PREVIEW_BREAKPOINTS: LivePreviewBreakpoint[] = [
  { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
  { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
  { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
]
