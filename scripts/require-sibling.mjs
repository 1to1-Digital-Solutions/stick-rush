#!/usr/bin/env node
/**
 * Stops an npm script early, with a message that says what is missing, when it needs a file of a
 * sibling repository that is not checked out next to this one:
 *
 *   node scripts/require-sibling.mjs <path> && <the command that uses it>
 *
 * The Godot scripts use the kit of the xrcade hub (`../xrcade/godot-kit`) and `npm run comunes`
 * uses Organízate (`organizate/scripts/repos/comunes.py`, two levels above the git directory, so
 * that it is found from a worktree too: write that path as `@git-common/../../organizate/…`).
 * Both repositories are private: without them these scripts cannot run, and everything else in
 * the game (dev server, build, unit and end-to-end tests) does not need them.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const GIT_COMMON = '@git-common/'

function resolvePath(path) {
  if (!path.startsWith(GIT_COMMON)) return resolve(path)
  const gitDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
  }).trim()
  return resolve(gitDir, path.slice(GIT_COMMON.length))
}

const [path] = process.argv.slice(2)
if (!path) {
  console.error('usage: require-sibling.mjs <path>')
  process.exit(2)
}
const wanted = resolvePath(path)
if (!existsSync(wanted)) {
  console.error(
    `This script needs ${wanted}, which is not there.\n` +
      'It belongs to a sibling repository (the xrcade hub or Organízate) that has to be checked out ' +
      'next to this one; both are private. See "Scripts that need the sibling repositories" in README.md.',
  )
  process.exit(1)
}
