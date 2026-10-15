import { MACHINE_HEIGHT, STICK_FALL_DISTANCE, STICK_MISS_Y } from './gameConfig'
import { gameStorage } from './storage'

/**
 * At what height the hoop ends up for whoever is playing.
 *
 * **The problem it solves.** `MACHINE_HEIGHT` is a fixed height, chosen for
 * a standing person of average stature. Standing it is fine; seated, or with
 * someone shorter, the same hoop ends up above the head and the sticks
 * pass out of the arm's reach. The game becomes unplayable without anything
 * failing.
 *
 * **How it is solved.** The height comes from the headset's: the hoop is planted
 * `HOOP_RISE_ABOVE_EYES` above the eyes, which is the relation the machine was
 * designed with. On top there is a manual correction, because the headset's
 * data is not always available nor always right: whoever plays seated on
 * a sofa with the space calibrated standing needs to lower it by hand.
 *
 * **The headset's data is only valid with the floor in place.** WebXR delivers the pose of
 * the head inside a reference space, and only those of type `*-floor`
 * have the origin on the floor: in a `local` one the head is born at zero and its
 * height says nothing about the stature. That is why `headsetEyeHeight` demands that the
 * session brings `local-floor`; when it does not, nothing is made up and the manual
 * adjustment stays as the only way to accommodate the hoop.
 *
 * The two limits of the statement —neither unreachable, nor inside the floor— are
 * held up with two different fences: the manual adjustment is bounded **relative
 * to whoever plays** (`HOOP_ADJUST_RANGE`, what separates the hoop from the arm), and
 * above it there is an absolute cap (`HOOP_MIN_HEIGHT`/`HOOP_MAX_HEIGHT`) in case the
 * starting data is absurd.
 *
 * Only the arithmetic lives here, with no three.js nor React, to be able to test the
 * behaviour with no browser nor headset.
 */

/**
 * Eye height of the person the scene was designed with: a standing one, of
 * average stature. `MACHINE_HEIGHT` and the heights of the immersive
 * ui (`@/lib/xrLayout`) were chosen for them, so both hang from here. With no
 * data from the headset, everything stays where it has always been.
 */
export const REFERENCE_EYE_HEIGHT = 1.6

/**
 * How far the hoop ends up above the eyes in the headset. It is the relation that makes the
 * machine playable —the sticks hang above the chest and fall through it, which is where the
 * hand reaches comfortably—, so it is what is kept when the player changes.
 *
 * **It was `MACHINE_HEIGHT − REFERENCE_EYE_HEIGHT` (35 cm) and it has been raised to 50** (with
 * the headset: «the machine higher»). It no longer comes from the desktop height: with 35 cm
 * the sticks hung at face height; with 50 they hang above and come down to the hand. The
 * desktop stays at `MACHINE_HEIGHT`, which is what its camera sees. The longer travel
 * does not change the difficulty: the speed is scaled with it (`hoopFallSpeed`).
 *
 * TO BE CALIBRATED WITH THE HEADSET.
 */
export const HOOP_RISE_ABOVE_EYES = 0.5

/**
 * Eye heights that are accepted as those of a person, in metres: from
 * seated on the floor to someone very tall standing. Outside of that the measurement is
 * not a stature but a misunderstood reference space (or a headset on
 * the table), and it is discarded.
 *
 * **The same as in the other twelve.** The cap was at 2.0, which are the eyes of someone
 * 2.15 tall: they exist, and in this game their height was left uncorrected while in the others
 * it was not. Each repo writes these figures wherever it wants —here, in `uiHeight.ts`, inside
 * `xrLayout.ts`— so nobody compared them; now somebody does, in `scripts/repos/comunes.py`.
 */
export const MIN_EYE_HEIGHT = 0.9
export const MAX_EYE_HEIGHT = 2.2

/**
 * How much the height can be corrected by hand, up or down, in metres.
 *
 * It is not a round number chosen by eye: the arm dictates it. The sticks hang
 * some 60 cm from the player horizontally and the comfortable reach is 75, so
 * there is a little under 26 cm of vertical margin left before the hoop leaves
 * what can be touched without moving from the spot (`hoopHeight.test.ts` checks it stick by
 * stick). Downwards the limit is the same by symmetry, and it leaves the hoop 15 cm
 * above the eyes: just above the head, which is where it has to be.
 */
export const HOOP_ADJUST_RANGE = 0.2

/** How much the hoop goes up or down with each tap, in metres. */
export const HOOP_ADJUST_STEP = 0.05

/**
 * Absolute caps, in metres. They are the last fence, not the adjustment: with reasonable
 * starting data they never get to bite. They are there so that no absurd
 * measurement ends up putting the hoop into the floor —the sticks need travel
 * to fall— nor hanging it from the ceiling.
 */
export const HOOP_MIN_HEIGHT = 1.05
export const HOOP_MAX_HEIGHT = 2.6

/** Can that measurement be the eye height of a person? */
export function isPlausibleEyeHeight(
  value: number | null | undefined,
): value is number {
  return (
    value != null &&
    Number.isFinite(value) &&
    value >= MIN_EYE_HEIGHT &&
    value <= MAX_EYE_HEIGHT
  )
}

/**
 * Eye height the headset delivers, or `null` if there is no data to
 * lean on.
 *
 * @param cameraY    height of the head above the session's origin, in metres
 * @param floorLevel whether that origin is on the floor (`*-floor` space)
 */
export function headsetEyeHeight(
  cameraY: number,
  floorLevel: boolean,
): number | null {
  // With no floor the origin is the point where the session started, and the height of
  // the head measures from there: it is not a stature and cannot be used as one.
  if (!floorLevel) return null
  return isPlausibleEyeHeight(cameraY) ? cameraY : null
}

/**
 * Does this session have the origin on the floor, in view of the features it
 * says it has enabled?
 *
 * `local-floor` is requested as **required** when the session opens (it is done by
 * @react-three/xr, see `xrStore.ts`), so a live session has it
 * necessarily: without it the headset would have refused to open it. But `enabledFeatures` is
 * optional in the specification and there are browsers that do not publish it, and there
 * demanding it amounts to giving up measuring the player in headsets where the data is
 * perfectly good. When the list is missing it is taken as good, which is what the
 * session guarantees; and if even so the space were not a floor one, the height would be born
 * near zero and `isPlausibleEyeHeight` would discard it anyway.
 */
export function hasFloorReference(
  enabledFeatures: readonly string[] | null | undefined,
): boolean {
  if (enabledFeatures == null) return true
  return (
    enabledFeatures.includes('local-floor') ||
    enabledFeatures.includes('bounded-floor')
  )
}

/** Keeps the manual correction inside what the hoop is allowed to move. */
export function clampHoopAdjustment(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(HOOP_ADJUST_RANGE, Math.max(-HOOP_ADJUST_RANGE, value))
}

export type HoopHeightInput = {
  /** What the headset says, or `null`/`undefined` if it does not say it. */
  eyeHeight?: number | null
  /** Manual correction, in metres. */
  adjustment?: number
}

/**
 * Height of the hoop for whoever is playing, in metres.
 *
 * With the headset's height, `HOOP_RISE_ABOVE_EYES` above the eyes; without it —desktop, or a
 * headset that does not say where the floor is—, the nominal height `MACHINE_HEIGHT`. In both
 * cases with the manual correction on top.
 */
export function hoopHeightFor({
  eyeHeight,
  adjustment = 0,
}: HoopHeightInput): number {
  const base = isPlausibleEyeHeight(eyeHeight)
    ? eyeHeight + HOOP_RISE_ABOVE_EYES
    : MACHINE_HEIGHT
  const height = base + clampHoopAdjustment(adjustment)
  return Math.min(HOOP_MAX_HEIGHT, Math.max(HOOP_MIN_HEIGHT, height))
}

/**
 * Average fall speed corrected for the height of the hoop (the stick's
 * acceleration comes from it, see `fallAcceleration`).
 *
 * Raising the hoop lengthens the travel down to the floor, so with the same
 * average speed the stick would take longer to arrive and each stature would play a different difficulty.
 * It is scaled with the travel so that Easy lasts the same for everybody:
 * accommodating the hoop is ergonomics, not an advantage. It is also what keeps
 * the times `gameConfig.test.ts` watches valid.
 */
export function hoopFallSpeed(speed: number, hoopHeight: number): number {
  const distance = hoopHeight - STICK_MISS_Y
  if (!Number.isFinite(distance) || distance <= 0) return speed
  return speed * (distance / STICK_FALL_DISTANCE)
}

/**
 * Where the manual correction is stored. With a prefix, like the record, so as not
 * to clash with anything else of the same origin.
 */
export const HOOP_ADJUST_KEY = 'stick-rush:hoop-adjust'

/**
 * Interprets what was read from storage.
 *
 * It is external input —anyone can edit it from the browser's
 * tools—, so it is bounded the same as if it came from the menu: whatever is not
 * understood counts as "no correction" instead of propagating a `NaN` to the
 * scene's geometry.
 */
export function parseHoopAdjustment(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 0
  return clampHoopAdjustment(Number(raw))
}

/** Stored correction, or 0 if there is no readable one. */
export function readHoopAdjustment(storage: Storage | null): number {
  if (!storage) return 0
  try {
    return parseHoopAdjustment(storage.getItem(HOOP_ADJUST_KEY))
  } catch {
    // Storage blocked: the game is played with the hoop where the headset leaves it.
    return 0
  }
}

/** Stores the correction, already bounded, for the next run and the next visit. */
export function writeHoopAdjustment(
  storage: Storage | null,
  value: number,
): void {
  if (!storage || !Number.isFinite(value)) return
  try {
    storage.setItem(HOOP_ADJUST_KEY, String(clampHoopAdjustment(value)))
  } catch {
    // Quota exhausted or writing forbidden: the hoop stays where it is during
    // this visit, and the next one starts over. It is no reason to
    // interrupt the game with a notice.
  }
}

/** Correction the game starts with in this browser. */
export function getHoopAdjustment(): number {
  return readHoopAdjustment(gameStorage())
}

/** Remembers the correction chosen in the headset's menu. */
export function saveHoopAdjustment(value: number): void {
  writeHoopAdjustment(gameStorage(), value)
}
