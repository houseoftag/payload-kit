/**
 * Post-build gate for the runtime-context boundaries that this package's whole
 * architecture depends on (see DESIGN.md §5). Fails the build loudly if violated.
 *
 *   1. The client entry MUST start with a `"use client"` directive (esbuild strips it
 *      when bundling, so tsup's onSuccess re-asserts it — verify it stuck).
 *   2. The server graph (root, fields, access) MUST NOT carry `"use client"` and MUST
 *      NOT import a client-only / React-DOM / Next runtime — re-exporting across the
 *      boundary would drag @payloadcms/ui into payload.config and break the RSC build.
 *   3. The pure-Payload entries (root, fields, access) MUST NOT import `next/*`, so a
 *      migrations worker never has to resolve `next`.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve('dist')
const read = (p) => fs.readFile(path.join(DIST, p), 'utf8')

const errors = []
const ok = []

const exists = async (p) => {
  try {
    await fs.access(path.join(DIST, p))
    return true
  } catch {
    return false
  }
}

// Every subpath must ship both JS and types.
const EXPECTED = [
  'index.js',
  'index.d.ts',
  'fields/index.js',
  'fields/index.d.ts',
  'client/index.js',
  'client/index.d.ts',
  'next/index.js',
  'next/index.d.ts',
  'access/index.js',
  'access/index.d.ts',
]
for (const f of EXPECTED) {
  if (await exists(f)) ok.push(`exists: ${f}`)
  else errors.push(`MISSING build output: ${f}`)
}

// 1. Client entry must start with the directive.
{
  const src = await read('client/index.js')
  if (/^['"]use client['"]\s*;?/.test(src)) ok.push('client/index.js starts with "use client"')
  else errors.push('client/index.js does NOT start with a "use client" directive')
}

// import specifiers from an ESM file (handles `from '...'` and bare `import '...'`).
const importsOf = (src) => {
  const specs = new Set()
  const re = /(?:from|import)\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) specs.add(m[1])
  return specs
}

const CLIENT_ONLY = ['@payloadcms/ui', '@payloadcms/live-preview-react', 'react', 'react-dom']
const NEXT = (s) => s === 'next' || s.startsWith('next/')

// 2 + 3. Server / pure-Payload entries must stay clean.
for (const entry of ['index.js', 'fields/index.js', 'access/index.js']) {
  const src = await read(entry)
  if (src.includes('use client')) errors.push(`${entry} contains a "use client" directive`)
  else ok.push(`${entry} has no "use client"`)

  const imports = importsOf(src)
  const leakedClient = CLIENT_ONLY.filter((d) => imports.has(d))
  const leakedNext = [...imports].filter(NEXT)
  if (leakedClient.length) errors.push(`${entry} imports client-only deps: ${leakedClient.join(', ')}`)
  else ok.push(`${entry} imports no client-only deps`)
  if (leakedNext.length) errors.push(`${entry} imports next/*: ${leakedNext.join(', ')}`)
  else ok.push(`${entry} imports no next/*`)
}

// The next entry is allowed (and expected) to import next/* + payload.
{
  const imports = importsOf(await read('next/index.js'))
  if ([...imports].some(NEXT)) ok.push('next/index.js imports next/* (expected)')
  if (imports.has('payload')) ok.push('next/index.js imports payload (expected)')
}

for (const line of ok) console.log(`  ✓ ${line}`)
if (errors.length) {
  console.error('\nDIST VERIFICATION FAILED:')
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log('\n✓ dist verification passed — runtime-context boundaries intact.')
