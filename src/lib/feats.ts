import { MAX_STICKS } from './gameConfig'
import { HOOP_ADJUST_RANGE } from './hoopHeight'
import type { GameResult } from './seed'
import { gameStorage } from './storage'

/**
 * The feats of Stick Rush: what a Steam achievement needs to know and the run did not count.
 *
 * They are the three marked with ➕ in `xrcade/docs/logros-de-steam.md`. The game knows nothing of
 * Steam: it only counts, stores what was earned and, when the run ends, tells the hall what it has
 * earned **for the first time** (`feats` of the result). The one that turns it into an achievement
 * is the hub.
 *
 * Everything is pure and without React: it is fed by the web's store (`gameStore.ts`) and the Godot
 * run (`godot/scene/game/run.ts`) in the same places —when a stick is caught and when a round is
 * resolved—, with the same numbers.
 */

/** The Steamworks API names. They are not changed once published. */
export const FEATS = {
  /** Catching the thirteen sticks of a round, with the machine full, without any getting away. */
  cleanSweep: 'SR_CLEAN_SWEEP',
  /** With the hoop lowered as far as the adjustment allows, catching a whole round without any getting away. */
  lowHoop: 'SR_LOW_HOOP',
  /** Hidden: catching a stick with your back to it. */
  behindBack: 'SR_BEHIND_BACK',
} as const

/** All of them, so as not to accept from the save anything that does not exist. */
const ALL: readonly string[] = Object.values(FEATS)

/**
 * How far the head has to be turned with respect to the stick, horizontally, for the catch to be
 * "behind the back": 120°. At 90° the stick is to one side, which is looking out of the corner of
 * the eye and not turning your back; past 120° it is already behind the shoulder.
 */
export const BEHIND_BACK_TURN = (2 * Math.PI) / 3

/**
 * The least the stick can be apart from the head horizontally for there to be an "in front" and a
 * "behind": with the stick right above the head the direction says nothing.
 */
const MIN_SEPARATION = 0.05

/** A point or a direction on the ground: `x` and `z` of world space (`y` upwards). */
export interface OnTheGround {
  readonly x: number
  readonly z: number
}

/**
 * Whether a stick has been caught behind the back: more than `BEHIND_BACK_TURN` between where the
 * head is looking and where the stick is, both taken to the ground. It is looked at horizontally
 * because tilting the head up or down is not turning around.
 *
 * @param head Where the eyes are.
 * @param gaze Where they are looking (it does not need to be a unit vector).
 * @param stick Where the stick being caught is (or the fist catching it, which comes to the same thing).
 */
export function isBehindBack({
  head,
  gaze,
  stick,
}: {
  head: OnTheGround
  gaze: OnTheGround
  stick: OnTheGround
}): boolean {
  const hx = stick.x - head.x
  const hz = stick.z - head.z
  const toward = Math.hypot(hx, hz)
  const looking = Math.hypot(gaze.x, gaze.z)
  // Looking at the sky or at the ground there is no "in front", and with the stick overhead there is no "where" either.
  if (toward < MIN_SEPARATION || looking < 1e-6) return false
  const cosine = (hx * gaze.x + hz * gaze.z) / (toward * looking)
  return cosine < Math.cos(BEHIND_BACK_TURN)
}

/** What was earned in the run in progress, without checking whether it was already earned before. */
export interface FeatCount {
  readonly earned: readonly string[]
}

export const NO_FEATS: FeatCount = { earned: [] }

function earn(count: FeatCount, api: string): FeatCount {
  return count.earned.includes(api) ? count : { earned: [...count.earned, api] }
}

/** A caught stick. `behind` comes from `isBehindBack`; without a headset you cannot turn your back. */
export function countCatch(count: FeatCount, { behind }: { behind: boolean }): FeatCount {
  return behind ? earn(count, FEATS.behindBack) : count
}

/**
 * Is the hoop as low as the adjustment lets it be lowered? With a rounding margin: the adjustment is
 * stored as the sum of 5 cm steps.
 */
export function hoopAtMinimum(hoopAdjustment: number): boolean {
  return hoopAdjustment <= -HOOP_ADJUST_RANGE + 1e-9
}

/**
 * A round resolved **whole**: all its sticks caught or on the ground. The one left halfway
 * —running out of lives in the challenge, ending the endless run mid-round— does not get here.
 *
 * @param sticks The sticks that hung from the machine in the round.
 * @param caught The ones that were caught of them.
 * @param hoopAdjustment The manual correction of the hoop it was played with (`hoopHeight.ts`).
 */
export function countRound(
  count: FeatCount,
  { sticks, caught, hoopAdjustment }: { sticks: number; caught: number; hoopAdjustment: number },
): FeatCount {
  if (sticks <= 0 || caught < sticks) return count
  let next = count
  if (sticks >= MAX_STICKS) next = earn(next, FEATS.cleanSweep)
  if (hoopAtMinimum(hoopAdjustment)) next = earn(next, FEATS.lowHoop)
  return next
}

/** Where the ones already earned are stored: a list of API names, in JSON. */
export const FEATS_KEY = 'stick-rush:hazanas'

/** The ones earned in some run. What is unreadable or is not a feat of this game does not count. */
export function readFeats(storage: Storage | null = gameStorage()): readonly string[] {
  if (storage == null) return []
  try {
    const read: unknown = JSON.parse(storage.getItem(FEATS_KEY) ?? '[]')
    return Array.isArray(read) ? ALL.filter((api) => read.includes(api)) : []
  } catch {
    return []
  }
}

/**
 * The ones earned in this run that were **not** earned before, and it leaves them stored.
 *
 * It is what goes in the result: the hall celebrates the first time and not the following ones.
 * With storage blocked they all look new every time; giving them in excess is harmless (Steam does
 * not unlock twice) and keeping quiet about them would not be.
 */
export function earnFeats(
  earned: readonly string[],
  storage: Storage | null = gameStorage(),
): string[] {
  const before = readFeats(storage)
  const newlyEarned = earned.filter((api) => ALL.includes(api) && !before.includes(api))
  if (newlyEarned.length > 0 && storage != null) {
    try {
      storage.setItem(FEATS_KEY, JSON.stringify([...before, ...newlyEarned]))
    } catch {
      // Quota exhausted or writing forbidden: they are given again next time, which does no harm.
    }
  }
  return newlyEarned
}

/**
 * What the scene tells the hall on finishing, with the feats first earned in the run.
 *
 * The field is optional and only goes when there is one: the common `GameResult` (`seed.ts`) is the
 * same in the seventeen games and a hall that does not read it keeps receiving the usual.
 */
export type ResultWithFeats = GameResult & {
  /** The API names earned for the first time in this run. */
  readonly feats?: readonly string[]
}

/** The result with its feats, or as is if none was first earned. */
export function withFeats(result: GameResult, newlyEarned: readonly string[]): ResultWithFeats {
  return newlyEarned.length > 0 ? { ...result, feats: [...newlyEarned] } : result
}
