/**
 * With what intention a run is played.
 *
 * - **Practice**: the chosen sticks fall and the run ends when the last one is
 *   resolved. Missing costs nothing. It is the usual game, to warm up.
 * - **Levels**: a ladder of its own (`levels.ts`): fifteen levels that raise
 *   the sticks and then the speed, each one a single run without lives that
 *   is scored with stars at the end; one star unlocks the next and
 *   what is unlocked is remembered between visits (`progress.ts`).
 * - **Challenge** (`challenge`, «Reto»): it is played with **lives**. Each stick that touches the ground costs one,
 *   and the run ends when they run out —even if sticks are still hanging— or when
 *   all of them are resolved, which is beating the challenge. It is the heroic mode.
 *
 * **Lives and not rounds that rise in difficulty.** The challenge is always played
 * with the same thing (`CHALLENGE_SETUP`): it is the run of the cabinet's record
 * and of the challenge of the day, and a run that got harder on its own would stop
 * being the same for everyone. The lives change only **how it ends**.
 *
 * **Three fixed lives**: the deal has to be understood before starting —three
 * misses and out—. With the hoop full at medium speed, that is the challenge.
 *
 * All of them are pure functions over counters: the state lives in `gameStore`
 * and the UI only paints it, the same as with the score.
 */

import { type Difficulty, MAX_STICKS } from './gameConfig'
import { MENU_EN } from './menuWords'

export type GameMode = 'practice' | 'levels' | 'challenge'

/** Order of the modes in the selectors, from the gentlest to the most demanding. */
export const GAME_MODE_ORDER: GameMode[] = ['practice', 'levels', 'challenge']

/** What each mode is called in the menus, in English (the dictionary key: «Challenge» is «Reto»). */
export const GAME_MODE_LABELS = {
  practice: 'Practice',
  levels: 'Levels',
  challenge: 'Challenge',
} as const satisfies Record<GameMode, string>

/**
 * What each mode promises, in one line, for the two menus, **and whether it counts for a medal**:
 * the cabinet's record and the hall's medals come from the challenge, and whoever chooses something
 * else has to know it before starting and not at the end.
 */
export const GAME_MODE_HINTS = {
  practice: 'No medal. Every stick drops, missing costs nothing.',
  levels: 'No medal. One level at a time, each unlocks the next.',
  challenge: 'Counts for a medal. Three lives, one per stick lost.',
} as const satisfies Record<GameMode, string>

/**
 * The mode that is chosen when the menu opens, **always**: the last one is not remembered.
 *
 * It opens on the challenge because it is the mode of the record and of the hall's medals: whoever
 * comes in and presses Jugar without touching anything has to be playing what counts, with its
 * goal in front of them. Practice is one tap away.
 */
export const DEFAULT_GAME_MODE: GameMode = 'challenge'

/** Lives a challenge starts with. */
export const CHALLENGE_LIVES = 3

/**
 * What the challenge is played with: always the same, **Medium and the thirteen sticks**.
 *
 * **A challenge has to be demanding.** With Easy and five sticks, three lives for five sticks that
 * take six seconds to fall was a formality, and every run ended on the same score.
 * With the hoop full at medium speed several fall at once all along the arch, you have to turn
 * around to look for them, and the streak —which is what multiplies the most— is really won or lost.
 *
 * **Fixed because its record is the cabinet's** (`stick-rush:best-points:challenge`, in the
 * hall's manifest) and the points scale with the difficulty and with the sticks: with both
 * open to choice, two challenge records could not be compared, and the challenge of the day —the
 * same run for everyone— would not be the same run. And because the challenge is played **by
 * hitting Jugar**: what is asked belongs to practice, which is where you warm up.
 */
export const CHALLENGE_SETUP: { readonly difficulty: Difficulty; readonly stickCount: number } = {
  difficulty: 'medium',
  stickCount: MAX_STICKS,
}

/**
 * Whether the mode asks how many sticks and at what speed. **Only practice**: in Levels the level
 * says it and in the challenge it is fixed (`CHALLENGE_SETUP`), so their menus come down to choosing
 * the mode and hitting Jugar.
 */
export function picksSetup(mode: GameMode): boolean {
  return mode === 'practice'
}

/**
 * How a run has ended.
 *
 * - `cleared`: all the sticks were resolved. In practice it is the only possible
 *   ending; in the challenge it is having beaten the challenge.
 * - `failed`: the lives ran out before finishing. Only in the challenge.
 */
export type RunOutcome = 'cleared' | 'failed'

/** What needs to be known about a run to decide whether it is still alive. */
export interface RunProgress {
  mode: GameMode
  /** Sticks already resolved: caught plus lost. */
  resolved: number
  /** Sticks that have got away, the ones that take a life. */
  misses: number
  /** Sticks that were put into play. */
  stickCount: number
}

/**
 * Lives one starts with, or `null` in a mode that is not played with them.
 *
 * `null` and not zero on purpose: zero lives is having lost, and confusing "there
 * are no lives at stake" with "you have run out of them" would close every
 * practice run on the first miss.
 */
export function startingLives(mode: GameMode): number | null {
  return mode === 'challenge' ? CHALLENGE_LIVES : null
}

/** Lives left after `misses` misses. It never goes below zero. */
export function remainingLives(mode: GameMode, misses: number): number | null {
  const lives = startingLives(mode)
  if (lives == null) return null
  return Math.max(0, lives - misses)
}

/**
 * How the run has ended, or `null` if it is still under way.
 *
 * Running out of lives rules over everything else: the last stick can touch the
 * ground at the same time as the rest is resolved, and there the run has been
 * lost, not completed.
 */
export function runOutcome({
  mode,
  resolved,
  misses,
  stickCount,
}: RunProgress): RunOutcome | null {
  if (remainingLives(mode, misses) === 0) return 'failed'
  if (resolved >= stickCount) return 'cleared'
  return null
}

/**
 * What the repeat button says at the end, with the hall's common words (`menuWords.ts`):
 * «Otro reto» in the mode that gives a medal and «Otra partida» in the others.
 */
export function anotherOfMode(mode: GameMode): typeof MENU_EN.anotherChallenge | typeof MENU_EN.anotherRun {
  return mode === 'challenge' ? MENU_EN.anotherChallenge : MENU_EN.anotherRun
}
