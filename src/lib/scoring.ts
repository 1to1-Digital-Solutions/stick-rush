import { type Difficulty } from './gameConfig'

/**
 * Scoring of a run.
 *
 * Catching a stick is worth more or less depending on three things, and all three reward playing
 * better and not just playing more:
 *
 * - **The chosen difficulty**, because on Impossible a stick goes by in seven
 *   tenths and on Easy you have almost six seconds.
 * - **The streak**, because chaining without missing is harder than getting
 *   half of the sticks spread out. A miss cuts it at a stroke.
 * - **The reflexes**: catching it just released is worth double that of rescuing it at floor
 *   level. Without this it made no difference whether you dived for it or waited for it below.
 *
 * Everything is pure functions over numbers: the state of the run lives in
 * `gameStore` and the scene only draws the result. That way the formula can be
 * tuned and tested without opening the browser.
 */

/** Points of a caught stick before applying any multiplier. */
export const BASE_STICK_POINTS = 100

/**
 * How much each difficulty multiplies. It grows more than proportionally to the reaction
 * time it takes away: if it were linear, playing on Easy with 13 sticks would yield
 * the same as on Impossible, and the choice of difficulty would make no difference.
 */
export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2.25,
  expert: 3.5,
  impossible: 5,
}

/** How much each chained stick adds to the streak. */
export const STREAK_STEP = 0.15

/**
 * Cap of the streak multiplier. Without it, a run of 13 sticks on Easy
 * would give more than a perfect one on Impossible just for being longer.
 */
export const MAX_STREAK_MULTIPLIER = 2.5

/** How much catching the stick as soon as it is released adds at most. */
export const MAX_REFLEX_BONUS = 1

/**
 * Streak multiplier. The first stick goes at 1 and each chained one adds,
 * up to the cap.
 *
 * @param streak consecutive sticks caught **including** the current one
 */
export function streakMultiplier(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 1) return 1
  return Math.min(1 + (streak - 1) * STREAK_STEP, MAX_STREAK_MULTIPLIER)
}

/**
 * Reflex multiplier.
 *
 * @param fallProgress how long the stick had been falling, as a fraction of its fall
 *   time: from 0 (just released) to 1 (about to touch the floor). It is time
 *   and not travel because the stick accelerates (see `stickFallProgress`). Values
 *   out of range are trimmed: a stick caught while it still hangs counts
 *   as the best case.
 */
export function reflexMultiplier(fallProgress: number): number {
  if (!Number.isFinite(fallProgress)) return 1
  const clamped = Math.min(Math.max(fallProgress, 0), 1)
  return 1 + (1 - clamped) * MAX_REFLEX_BONUS
}

/**
 * Points that catching a stick adds. Always an integer: a score with
 * decimals says nothing to the player.
 */
export function stickPoints({
  difficulty,
  streak,
  fallProgress,
}: {
  difficulty: Difficulty
  streak: number
  fallProgress: number
}): number {
  return Math.round(
    BASE_STICK_POINTS *
      DIFFICULTY_MULTIPLIERS[difficulty] *
      streakMultiplier(streak) *
      reflexMultiplier(fallProgress),
  )
}

/**
 * Maximum score reachable in a run: all the sticks caught as soon as
 * they are released and without breaking the streak. It serves to place the result ("you have
 * done half of what is possible") without the player having to guess the
 * scale.
 */
export function maxScore(difficulty: Difficulty, stickCount: number): number {
  let total = 0
  for (let i = 1; i <= stickCount; i++) {
    total += stickPoints({ difficulty, streak: i, fallProgress: 0 })
  }
  return total
}

/**
 * How well it has gone, from 0 to 1, to choose the closing message. It is compared
 * with the real maximum of that run, so it does not penalise having chosen few
 * sticks nor a low difficulty.
 */
export function scoreRatio(
  points: number,
  difficulty: Difficulty,
  stickCount: number,
): number {
  const max = maxScore(difficulty, stickCount)
  if (max <= 0) return 0
  return Math.min(Math.max(points / max, 0), 1)
}
