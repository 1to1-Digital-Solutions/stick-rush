import { DIFFICULTY_ORDER, type Difficulty } from './gameConfig'

/**
 * The Levels mode: a ladder of fifteen separate runs.
 *
 * The challenge of this game does not rise on its own —the difficulty is chosen by the player
 * and the lives are what changes—, so the levels bring their own ladder:
 * within one speed, more sticks; with the sticks used up, more speed. Each
 * level is played whole and without lives, is scored with stars for the sticks
 * caught, and one is enough to unlock the next. What is unlocked is
 * remembered between visits (`progress.ts`).
 */

/** Sticks of each level within one same speed, from fewer to more. */
export const LEVEL_STICK_STEPS = [5, 9, 13] as const

export const LEVEL_COUNT = DIFFICULTY_ORDER.length * LEVEL_STICK_STEPS.length

export type Stars = 0 | 1 | 2 | 3

/** What share of the sticks has to be caught for each star. */
export const STAR_THRESHOLDS: readonly [number, number, number] = [0.6, 0.8, 1]

export interface LevelSpec {
  level: number
  difficulty: Difficulty
  stickCount: number
}

/** Trims a level to the range that exists; anything odd falls to the first. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)))
}

/** What hangs from the machine in that level. */
export function levelSpec(level: number): LevelSpec {
  const safe = clampLevel(level)
  const index = safe - 1
  const steps = LEVEL_STICK_STEPS.length
  return {
    level: safe,
    difficulty: DIFFICULTY_ORDER[Math.floor(index / steps)],
    stickCount: LEVEL_STICK_STEPS[index % steps],
  }
}

/** The stars of a run: how many sticks were caught out of those that fell. */
export function levelStars(caught: number, stickCount: number): Stars {
  if (!Number.isFinite(stickCount) || stickCount <= 0) return 0
  const ratio = Math.min(1, Math.max(0, caught / stickCount))
  let stars: Stars = 0
  for (const threshold of STAR_THRESHOLDS) if (ratio >= threshold) stars = (stars + 1) as Stars
  return stars
}

export function levelPassed(stars: Stars): boolean {
  return stars >= 1
}

/** Up to which level can be played after this run. It never goes down. */
export function nextUnlocked(unlocked: number, level: number, stars: Stars): number {
  const current = clampLevel(unlocked)
  if (!levelPassed(stars)) return current
  return Math.max(current, clampLevel(level + 1))
}
