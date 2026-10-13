#!/usr/bin/env node
/**
 * Copies the game's static files to wherever whoever mounts it serves them.
 *
 * The HDRI, the wood textures, the fairground models and the controller
 * profiles do not travel in the code: they are 3 MB the browser requests over HTTP while playing. An
 * application that mounts Stick Rush has to serve them from its own site and
 * tell it where with the `assetsBase` option (see `docs/mounting-the-game.md`).
 *
 * Usage, from the project that consumes it:
 *
 *   npx stick-rush-assets public/juegos/stick-rush
 *
 * It is idempotent: it is run again after bumping the game's version and leaves
 * the destination with the files of the new version.
 */
import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(packageRoot, 'public')

/** What the game needs. The rest of `public/` belongs to its own website. */
const ASSETS = ['audio', 'hdri', 'manos', 'models', 'textures', 'webxr-profiles', 'CREDITS.md']

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('Usage: stick-rush-assets <destination directory>')
    process.exit(1)
  }

  // Before touching the destination: a single one missing is noticed in the
  // headset and late —the scenery without HDRI, or the controllers not
  // registered—, so it stops here instead of leaving the copy half done. It is
  // the net that warns if a directory of `public/` is ever renamed and this
  // list is left behind.
  const missing = ASSETS.filter((asset) => !existsSync(join(source, asset)))
  if (missing.length > 0) {
    console.error(
      `Missing from the Stick Rush package: ${missing.join(', ')}. ` +
        'Reinstall the version of the game; if it persists, it is a bug of the game.',
    )
    process.exit(1)
  }

  const destination = resolve(process.cwd(), target)
  await mkdir(destination, { recursive: true })

  for (const asset of ASSETS) {
    const to = join(destination, asset)
    // Each one is redone from scratch so that bumping the version leaves no
    // orphan files from the previous one. Only what is going to be copied is
    // deleted: the destination may be a directory shared with other things.
    await rm(to, { recursive: true, force: true })
    await cp(join(source, asset), to, { recursive: true })
  }

  console.log(`Stick Rush files copied to ${destination}`)
}

await main()
