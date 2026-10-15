import { type GameMode } from './gameMode'
import { createStoredPreference, gameStorage } from './storage'

/**
 * The best score, kept between visits.
 *
 * One integer per mode in `localStorage`, with no identifiers nor anything that
 * describes who is playing. It breaks on purpose the "zero storage" that the
 * security audit approved, because a record that is erased on reload is not a
 * record; the rest of what is stored are the hoop height (`hoopHeight.ts`), the
 * tutorial already seen (`tutorial.ts`) and the mute (`mutePreference.ts`). The
 * scenery and the mode still live only in memory.
 *
 * **One record per mode** and not a global one: a challenge is cut short when
 * the lives run out, so with the same sticks and the same difficulty it can
 * never score more than the equivalent practice. With a single best, the mode
 * with something at stake would be the only one that would never beat it.
 *
 * Access is fault tolerant: in private mode, or with storage blocked by
 * policy, touching `localStorage` **throws** instead of returning `null`. There
 * the game is left without a record and is played just the same: it is an extra
 * feature, not a condition for playing.
 *
 * The read and write functions receive the `Storage` as a parameter, so the
 * rule is tested without a browser and without touching the real storage. On
 * top there is a store React subscribes to (`useSyncExternalStore`): the
 * record is not React state but something that lives outside and that the game
 * queries, which is exactly what avoids synchronising it with effects.
 */

/**
 * Key of each mode's record. Prefixed so as not to clash with anything else of
 * the same origin. The practice one is the one that already existed: whoever had
 * a record before the modes existed keeps it where it was.
 */
export const HIGH_SCORE_KEYS: Record<GameMode, string> = {
  practice: 'stick-rush:best-points',
  levels: 'stick-rush:best-points:levels',
  challenge: 'stick-rush:best-points:challenge',
}

/** The endless run does not measure points —they grow without limit— but the best streak. */
export const ENDLESS_STREAK_KEY = 'stick-rush:best-streak:endless'

/**
 * Interprets what was read from storage.
 *
 * It is external input —anyone can edit it from the browser's tools—, so only
 * an exact non-negative integer is accepted. Anything else counts as "there is
 * no record yet" instead of propagating a `NaN` to the score.
 */
export function parseBestPoints(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 0
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) return 0
  return value
}

/** Stored record of that mode, or 0 if there is no readable one. */
export function readBestPoints(
  storage: Storage | null,
  mode: GameMode,
): number {
  if (!storage) return 0
  try {
    return parseBestPoints(storage.getItem(HIGH_SCORE_KEYS[mode]))
  } catch {
    // Storage blocked: the game is played without a previous record.
    return 0
  }
}

/**
 * Saves a mode's record. Impossible values are not written, so as not to
 * leave in the browser something the read is going to discard.
 */
export function writeBestPoints(
  storage: Storage | null,
  mode: GameMode,
  points: number,
): void {
  if (!storage || !Number.isSafeInteger(points) || points < 0) return
  try {
    storage.setItem(HIGH_SCORE_KEYS[mode], String(points))
  } catch {
    // Quota exhausted or writing forbidden: that run is left without a record.
    // Losing it does not justify interrupting the game with a notice.
  }
}


/*
 * The browser is not touched here: what touches it (the `storage` event between tabs) lives in
 * `highScore.ts`, which re-exports all of this. That way the Godot port (`godot/`) loads the bests
 * as they are, with its own saving, without dragging `window` along.
 */

/** Who wants to find out, in this same process, that the record has changed. */
const listeners = new Set<() => void>()

/**
 * Signs someone up to find out that the record has changed in this process; returns how to
 * stop listening. What another tab writes is added by `subscribeBestPoints`, which is the
 * browser's one.
 */
export function subscribeToRecord(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Current record of a mode. It is read from the browser every time instead of
 * keeping a copy: the storage is the only source of truth, so there are no two
 * versions that could disagree.
 */
export function getBestPoints(mode: GameMode): number {
  return readBestPoints(gameStorage(), mode)
}

/**
 * Saves the score if it improves that mode's record, and notifies whoever is
 * watching it.
 */
export function saveBestPoints(mode: GameMode, points: number): void {
  if (!Number.isSafeInteger(points) || points <= getBestPoints(mode)) return
  writeBestPoints(gameStorage(), mode, points)
  for (const listener of listeners) listener()
}

const endlessStreak = createStoredPreference<number>({
  key: ENDLESS_STREAK_KEY,
  parse: parseBestPoints,
  serialize: String,
})

export const {
  get: getBestEndlessStreak,
  getServer: getServerBestEndlessStreak,
  subscribe: subscribeBestEndlessStreak,
} = endlessStreak

/** Saves the streak of an endless run if it improves the best. */
export function saveBestEndlessStreak(streak: number): void {
  if (!Number.isSafeInteger(streak) || streak <= getBestEndlessStreak()) return
  endlessStreak.save(streak)
}
