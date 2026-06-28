import { promises as fs } from 'node:fs'
import { defineConfig } from 'tsup'

// Everything host-owned + singleton stays external: bundling React / Payload / Next
// in would create duplicate-singleton bugs (invalid hook calls, two `payload`
// instances, a duplicate `@payloadcms/ui` admin context that returns `undefined`).
const external = [
  'payload',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/headers',
  'next/navigation',
  'next/server',
  '@payloadcms/ui',
  '@payloadcms/live-preview-react',
]

const CLIENT_ENTRY = 'dist/client/index.js'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'fields/index': 'src/fields/index.ts',
    'next/index': 'src/next/index.ts',
    'access/index': 'src/access/index.ts',
    'client/index': 'src/client/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external,
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
  // esbuild strips a leading `"use client"` directive when bundling (it parses it as a
  // module directive and drops it — even from a banner). The directive is a hard
  // requirement for the client subpath, so re-assert it at the very top of the emitted
  // client entry after the build. Verified by `scripts/verify-dist.mjs`.
  async onSuccess() {
    const src = await fs.readFile(CLIENT_ENTRY, 'utf8')
    if (!/^['"]use client['"]/.test(src)) {
      await fs.writeFile(CLIENT_ENTRY, `"use client";\n${src}`)
    }
  },
})
