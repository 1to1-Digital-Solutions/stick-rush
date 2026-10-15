// @vitest-environment node

/**
 * That the published package carries inside what is needed to mount it.
 *
 * `files` decides what goes up to npm, and whatever is left out does not fail
 * on packing or on building: it fails in the application that installs the
 * game, which imports a module that is not there or serves files that never
 * arrived.
 *
 * The rest of the `package.json` —`exports`, `peerDependencies`, `sideEffects`—
 * is validated by `npm run catalog:validate` from xrcade when registering the
 * game (see `docs/xrcade.md`). Here what that one cannot know is checked: that
 * the paths it declares really exist inside the package, and that the entry
 * arrives with everything it imports behind it — which is what really decides
 * whether the host can mount it.
 */

import { execFile } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

interface PackageManifest {
  exports: Record<string, string>
  bin: Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  sideEffects?: string[]
}

/** The files that would go up to npm, according to what `files` declares. */
function packedFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(
      'npm',
      ['pack', '--dry-run', '--json'],
      { cwd: projectRoot, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout) => {
        if (error != null) {
          reject(error)
          return
        }
        const [tarball] = JSON.parse(stdout) as { files: { path: string }[] }[]
        resolve(tarball.files.map((file) => file.path))
      },
    )
  })
}

/**
 * Modules a source file asks for by name: `from '…'`, a bare import for its
 * side effects, a deferred `import('…')` or a `require('…')`.
 */
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])([^'"]+)\1/g

/** Suffixes a bundler tries when resolving a relative path. */
const RESOLUTION_ORDER = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

function existsAsFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

function resolveRelative(from: string, specifier: string): string | null {
  const base = join(dirname(from), specifier)
  for (const suffix of RESOLUTION_ORDER) {
    const candidate = `${base}${suffix}`
    if (existsAsFile(candidate)) return candidate
  }
  return null
}

/**
 * All the files of the project itself that are reached from some entries,
 * following their relative imports.
 *
 * Those that go by their bare name (`three`, `react`) are the ones in
 * `peerDependencies` and the host provides them, so they do not count here. A
 * relative specifier that does not resolve is ignored instead of failing: the
 * typecheck already catches that, and here only what is published is asked about.
 */
function reachableFrom(entries: string[]): string[] {
  const seen = new Set<string>()
  const pending = [...entries]

  while (pending.length > 0) {
    const file = pending.pop()
    if (file == null || seen.has(file)) continue
    seen.add(file)
    if (!/\.tsx?$/.test(file)) continue

    for (const [, , specifier] of readFileSync(file, 'utf8').matchAll(
      SPECIFIER,
    )) {
      if (!specifier.startsWith('.')) continue
      const resolved = resolveRelative(file, specifier)
      if (resolved != null) pending.push(resolved)
    }
  }

  return [...seen]
}

/** Relative paths of all the files there are under a directory. */
async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort()
}

/**
 * What the game's logic cannot name.
 *
 * `src/lib` is the domain: what decides something and does not depend on the drawing. It is
 * also the only thing that can be taken as is to the Godot port, and there the engine **does
 * not bring the browser's parts**: there is no `Intl` —QuickJS-ng does not carry it and
 * GodotJS's V8 is compiled without ICU—, nor `window`, nor `document`, nor `navigator`. A
 * `toLocaleString` in the scoreboard does not fail here: it fails there, and in the two worst
 * ways —either it blows up, or it returns the figure without separators and nobody finds out
 * until a player sees it—.
 *
 * That is why it is checked on the code and not on the comments: explaining why `Intl` is
 * not used is not using it.
 */
const BROWSER_ONLY: { pattern: RegExp; missing: string }[] = [
  { pattern: /\bIntl\b/, missing: '`Intl`, which the engine of the port does not carry inside' },
  { pattern: /toLocale/, missing: '`toLocale…`, which needs `Intl`' },
  { pattern: /\bnavigator\b/, missing: '`navigator`, which does not exist outside the browser' },
  { pattern: /\bwindow\b/, missing: '`window`, which does not exist outside the browser' },
  { pattern: /\bdocument\b/, missing: '`document`, which does not exist outside the browser' },
]

/** The code without what is written in order to read it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}
/**
 * This game's port to the browser: the files of `src/lib` that can indeed use it.
 *
 * They are named one by one and not by wildcard on purpose: they are exactly what will have
 * to be rewritten for the new engine, so the list has to be costly to lengthen. Adding one is
 * saying "this is not ported as is", and that is decided, not inherited from a pattern.
 */
const BROWSER_PORT = [
  // The hall's settings seen from the browser: the language cookie and the
  // storage, with the notice to the other tabs.
  'settingsClient.ts',
  // The saved record, which finds out if it is changed from another tab.
  'highScore.ts',
  // The mount count that only exists if a test has asked for it before loading.
  'mountCount.ts',
  // Where the sticks are, written to `window` only if the e2e has asked for the probe.
  'sceneProbe.ts',
  // The local storage, with the browser that blocks it accounted for.
  'storage.ts',
]

let packed: string[]
let manifest: PackageManifest

beforeAll(async () => {
  ;[packed, manifest] = await Promise.all([
    packedFiles(),
    readFile(join(projectRoot, 'package.json'), 'utf8').then(
      (raw) => JSON.parse(raw) as PackageManifest,
    ),
  ])
  // Packing starts the whole of npm: on a cold machine it goes past the default
  // five seconds without anything being wrong.
}, 120_000)

describe('what the package declares', () => {
  it('has a default entry point, without which the hub cannot import it', () => {
    expect(manifest.exports['.']).toBeDefined()
  })

  it('leaves React and three to the host', () => {
    // Two copies of React break the hooks and two of three, the scene. It is the
    // expensive bug because it does not break the build: it breaks the run.
    const shared = /^(react|react-dom|three)$|^@react-three\//
    const own = Object.keys(manifest.dependencies ?? {}).filter((name) =>
      shared.test(name),
    )
    expect(own).toEqual([])
    expect(
      Object.keys(manifest.peerDependencies ?? {}).sort(),
    ).toContain('three')
  })

  it('marks the styles as a side effect so that the bundler does not swallow them', () => {
    expect(manifest.sideEffects).toContain('*.css')
  })
})

describe('the package that is published', () => {
  it('carries inside everything `exports` points at', () => {
    const targets = Object.values(manifest.exports).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('carries inside the modules that entry imports, not only the entry', () => {
    // Publishing the entry point without what is underneath does not fail on
    // packing or on building here: it fails on installing it, importing a module
    // that did not go up. And deleting `src/lib` from `files` is not needed to
    // cause it: it is enough for the game to import something from `src/app`,
    // which belongs to the website and does not travel.
    const entries = Object.values(manifest.exports)
      .map((target) => join(projectRoot, target.replace(/^\.\//, '')))
      .filter((target) => /\.tsx?$/.test(target))

    const reachable = reachableFrom(entries).map((file) =>
      relative(projectRoot, file),
    )

    // If the crawl stopped following imports, it would stay at the entries and
    // would pass without checking anything.
    expect(reachable.length).toBeGreaterThan(entries.length)
    expect(reachable.filter((file) => !packed.includes(file))).toEqual([])
  })

  it('carries inside the executable that copies the static files', () => {
    const targets = Object.values(manifest.bin).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('carries inside the static files that executable copies', async () => {
    // The executable reads from `public/` inside the installed package: whatever
    // does not go up to npm is not there, and `stick-rush-assets` stops saying
    // the package arrived incomplete.
    const assets = (await filesIn(join(projectRoot, 'public'))).map(
      (file) => `public/${file}`,
    )

    expect(assets.length).toBeGreaterThan(0)
    expect(assets.filter((asset) => !packed.includes(asset))).toEqual([])
  })

  it('and that executable copies everything there is in `public/`', async () => {
    // The list of `copy-assets.mjs` is written by hand: a new directory in `public/` that is
    // not added there works on the game's website and is missing in the hall, where the game
    // requests a file nobody copied. It is read from the source because importing it would run it.
    const source = await readFile(join(projectRoot, 'scripts/copy-assets.mjs'), 'utf8')
    const list = /const ASSETS = \[([^\]]*)\]/.exec(source)
    expect(list, 'cannot find the ASSETS list in copy-assets.mjs').not.toBeNull()
    const copied = [...list![1].matchAll(/'([^']+)'/g)].map(([, name]) => name)

    const inPublic = await readdir(join(projectRoot, 'public'))
    expect(copied.sort()).toEqual(inPublic.filter((name) => !name.startsWith('.')).sort())
  })

  it('does not carry the tests, which are of no use to whoever mounts it', () => {
    expect(packed.filter((file) => /\.test\.tsx?$/.test(file))).toEqual([])
  })
})

describe('the logic the Godot port takes along', () => {
  it('calls nothing that only exists inside a browser', async () => {
    const lib = join(projectRoot, 'src/lib')
    const sources = (await filesIn(lib)).filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.test\.tsx?$/.test(file) &&
        !BROWSER_PORT.includes(file),
    )

    // If the sweep stopped finding files, it would pass without checking anything.
    expect(sources.length).toBeGreaterThan(20)

    const found = sources.flatMap((file) => {
      const source = code(readFileSync(join(lib, file), 'utf8'))
      return BROWSER_ONLY.filter(({ pattern }) => pattern.test(source)).map(
        ({ missing }) => `src/lib/${file} uses ${missing}`,
      )
    })

    expect(
      found,
      'The logic of the game has to run outside a browser too: in the Godot port there is' +
        ' no Intl, nor window, nor document, nor navigator. Whatever needs the browser is' +
        ' moved out to src/components (like shareOrCopy.ts); a figure with the thousands' +
        ' separated is asked of formatFigure() in src/lib/textos.ts. If a file of' +
        ' src/lib really is the port to the browser, it is named in BROWSER_PORT.',
    ).toEqual([])
  })
})
