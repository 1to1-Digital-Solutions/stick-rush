/**
 * The game, drivable from a browser test without playing: what is common to the seventeen
 * (`e2e/support/common.ts`) to take the same UX screenshots in all of them.
 *
 * Grabbing sticks with the headset's emulator is what neither the emulator nor a test does well, and what is
 * looked at in those screenshots —the menu, the sign before starting, on crossing the bronze and at the end— does not
 * depend on how they were grabbed. So the test starts the challenge, gives it the points and ends it.
 *
 * **The key carries the name of the game**: the games are all installed at once inside the hall, and
 * a `declare global` belongs to the page, not to whoever writes it; with two games calling their own thing `__run`,
 * TypeScript merges the declarations and the hall does not build.
 *
 * **It only counts if somebody asks for it**: the test creates `window.__runStickRush` before loading the
 * page (`requestRun`), and the scene leaves there what can be asked of it. In a real run
 * this does nothing, which is what allows leaving it in place. It is looked up on `globalThis`, which in the
 * browser is the window and outside it exists too: that way `src/lib` does not touch the browser.
 */

import type { GoalSignView } from './goal'

/** What a test can do to the game: what is common in `CommonRun` (`e2e/support/common.ts`). */
export interface TestRun {
  /** Starts a challenge, solo, with no lesson nor countdown to wait for. */
  start: () => void
  /** Sets the points of the challenge in progress, as if a stick had already been caught. */
  score: (points: number) => void
  /** Ends the challenge in progress as if every stick had been resolved: it counts for the hall. */
  end: () => void
  /** What the goal sign says now, or `null` if it is not showing. */
  sign: () => GoalSignView | null
}

declare global {
  var __runStickRush: Partial<TestRun> | undefined
}

/** Does somebody want to drive the game from outside? */
export function isTestRunRequested(): boolean {
  return globalThis.__runStickRush != null
}

/** Leaves at hand what can be done, if somebody has asked for it. */
export function exposeTestRun(api: TestRun): void {
  const run = globalThis.__runStickRush
  if (run == null) return
  run.start = api.start
  run.score = api.score
  run.end = api.end
  run.sign = api.sign
}
