// Extracts a minimal, JSON-serializable form of TRIPS from src/data/trips.ts
// so the anchor-notify lambda can render tomorrow's schedule without
// bundling the entire frontend module.
//
// Output: api/_trips-data.json — read at runtime via fs.readFileSync.

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// esbuild-bundle trips.ts to a temp ESM file so plain Node can import it.
const tmp = mkdtempSync(resolve(tmpdir(), 'trips-'))
const bundled = resolve(tmp, 'trips.mjs')

execFileSync('npx', [
  '--no-install',
  'esbuild',
  resolve(repoRoot, 'src/data/trips.ts'),
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--target=node18',
  `--outfile=${bundled}`,
  // Loader for image asset imports (if any) — return an empty stub.
  '--loader:.jpg=empty',
  '--loader:.png=empty',
  '--loader:.svg=empty',
], { stdio: 'inherit', cwd: repoRoot })

const mod = await import(pathToFileURL(bundled).href)
const TRIPS = mod.TRIPS

if (!Array.isArray(TRIPS)) {
  console.error('TRIPS export not found or not an array')
  process.exit(1)
}

const slim = TRIPS.map(t => ({
  id: t.id,
  name: t.name,
  days: (t.days || []).map(d => ({
    isoDate: d.isoDate,
    date: d.date,
    title: d.title,
    subtitle: d.subtitle || '',
    events: (d.events || []).map(e => ({
      time: e.time || '',
      title: e.title || '',
    })),
  })),
}))

const outPath = resolve(repoRoot, 'api/_trips-data.json')
writeFileSync(outPath, JSON.stringify(slim), 'utf8')

try { rmSync(tmp, { recursive: true, force: true }) } catch {}

const totalDays = slim.reduce((n, t) => n + t.days.length, 0)
console.log(`Wrote ${slim.length} trips (${totalDays} days) to ${outPath}`)
