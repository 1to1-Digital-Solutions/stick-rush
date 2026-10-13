export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

/**
 * **Mean** fall speed in metres per second. The scene is at human scale
 * (1 unit = 1 metre) and a stick travels ~1.45 m from its release to the
 * ground, so on Easy it lasts a little under 6 s and on Impossible, seven
 * tenths.
 *
 * It is a mean and not a constant: the stick falls accelerating (see
 * `fallAcceleration`). It is still expressed like this because what decides the
 * difficulty is how long the fall lasts, and that is distance over mean speed,
 * the same as when it fell at a fixed speed: moving to gravity touched no time.
 *
 * They are recalculated every time the geometry changes —first when the hoop
 * was brought closer to the player, then when it was shrunk by 8 %—, because the
 * distance changes with it and otherwise all the difficulties would shift
 * without anyone deciding it. `gameConfig.test.ts` watches that the reaction
 * margins stay in place.
 */
export const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 0.257,
  medium: 0.452,
  hard: 0.771,
  expert: 1.213,
  impossible: 2.16,
}

/** Label visible to the user (product language: Spanish). */
export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  impossible: 'Impossible',
} as const satisfies Record<Difficulty, string>

/** Order of difficulties from lowest to highest to build selectors. */
export const DIFFICULTY_ORDER: Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'impossible',
]

/**
 * Colour of each difficulty button: it progresses from green (easy) to red
 * (impossible). It serves as a visual signal of priority/risk, always
 * accompanied by text so as not to depend on colour alone.
 */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#15803d',
  medium: '#65a30d',
  hard: '#d97706',
  expert: '#ea580c',
  impossible: '#dc2626',
}

/**
 * Red of the challenge's lives. A single one for the desktop menu, the
 * scoreboard and the headset: a heart that changes colour when going from one
 * place to another stops reading as the same thing.
 */
export const LIFE_COLOR = '#f87171'

/** Colour of the sticks: wood painted fairground yellow. */
export const STICK_COLOR = '#e8b93f'
/** Green of the hit: the stick lights up when it is caught. */
export const STICK_CAUGHT_COLOR = '#22c55e'
/** Red of the miss: the stick that touches the ground stays tinted. */
export const STICK_MISSED_COLOR = '#b91c1c'

/** Shades of the machine, in fairground-stall stripes. */
export const MACHINE_STRIPE_COLORS = ['#c1121f', '#f4ece0']
/** Posts and finials of the machine. */
export const MACHINE_FRAME_COLOR = '#9a7b33'
/** Truss (top hoop, uprights and diagonals): painted iron. */
export const MACHINE_TRUSS_COLOR = '#6d6357'
/** Bulbs of the garland. */
export const MACHINE_BULB_COLOR = '#ffd479'

/** Background and fog outside AR: a night in the square, matching the scenery. */
export const BACKDROP_COLOR = '#0d1017'

/** Shades of the crowd's clothes: dark, so that they are silhouettes against the lights. */
export const CROWD_SHADES = ['#2b2430', '#3b2e28', '#233040', '#3a2c3c', '#2f3a2e']
/** The white the bulbs lean towards when the streak gets the party going. */
export const PARTY_BULB_COLOR = '#fff6e6'

/** Limits of selectable sticks. */
export const MIN_STICKS = 5
export const MAX_STICKS = 13

/**
 * Geometry of the machine and of the sticks, in metres.
 *
 * The hoop is a **horizontal** semicircle (in the XZ plane) that surrounds the
 * player in front: they stand at the centre and stretch out their arm to catch
 * the sticks, which fall around them and not on top of them. With the vertical
 * arch of before, the centre sticks literally fell on their head.
 */
/**
 * Radius of the hoop. It is ruled by the real reach of the arm: the sticks are
 * caught with the hand (grip), not by pointing, so they have to fall inside the
 * volume the player reaches without moving from the spot. With the 1.25 m of the
 * original design they looked far away and there was no way to get to them in
 * the headset.
 */
export const MACHINE_RADIUS = 0.57
/**
 * **Nominal** height of the hoop: just above the head. The sticks hang down to
 * ~1.4 m and fall through chest height, which is where the hand reaches
 * comfortably.
 *
 * **It does not shrink with the rest.** The machine was reduced by 8 % because it
 * looked too big, but this height is ruled by the player's stature, not by the
 * size of the machine: lowering it would leave the hoop at eye level.
 *
 * And for that same reason it is not fixed either: in the headset the real
 * height comes from the player's (see `hoopHeight.ts`), and this is the one that
 * corresponds to the reference stature. It is the one used on desktop and the
 * one that acts as a fallback when the headset does not say how high the head is.
 */
export const MACHINE_HEIGHT = 1.95
export const STICK_LENGTH = 0.39
export const STICK_RADIUS = 0.02
export const GROUND_Y = 0
/** Gap between the hoop and the stick, taken up by the cord it hangs from. */
export const STICK_CORD_LENGTH = 0.11

/**
 * Where the player stands with respect to the centre of the hoop, in metres (−Z is towards the arch).
 *
 * It has been moved twice, always because of what was seen with the headset on:
 *
 * - **At −0.18 it was too much**: "the player starts very close to the machine, maybe half a
 *   little step back". It was left at −0.02, almost at the centre of the hoop.
 * - **And from there, a mini-step back** ("it is perfect", with this single touch-up): ten
 *   centimetres **behind** the centre. The front sticks end up a little farther away
 *   —65 cm horizontally, within the 75 of the arm— and the ones at the ends, which used to
 *   fall to one side, now fall a little in front: the whole machine is seen in front and
 *   nothing falls on top of whoever plays. What is still demanded is that each stick **crosses**
 *   the reach of the arm as it falls (`xrInteraction.test.ts`, `hoopHeight.test.ts`).
 *
 * TO BE CALIBRATED WITH THE HEADSET.
 */
export const PLAYER_OFFSET_Z = 0.08

/** Position of the player: the feet, on the ground, one step behind the centre of the hoop. */
export const PLAYER_POSITION: [number, number, number] = [
  0,
  GROUND_Y,
  PLAYER_OFFSET_Z,
]

/** Distance from the player to a point of the scene, in metres. */
export function distanceFromPlayer([x, y, z]: [
  number,
  number,
  number,
]): number {
  const [px, , pz] = PLAYER_POSITION
  return Math.hypot(x - px, y - PLAYER_SHOULDER_HEIGHT, z - pz)
}

/** Reference shoulder height, origin of the reach of the arm. */
export const PLAYER_SHOULDER_HEIGHT = 1.45

/**
 * Height of the anchor from which the stick is considered lost: the one that
 * leaves its tip right on the ground. Measuring it at the anchor made the whole
 * stick sink under the ground (and remain catchable) before counting as lost.
 */
export const STICK_MISS_Y = GROUND_Y + STICK_CORD_LENGTH + STICK_LENGTH

/** Distance a stick travels from its release until it is given up as lost. */
export const STICK_FALL_DISTANCE = MACHINE_HEIGHT - STICK_MISS_Y

/**
 * Seconds a stick takes to reach the ground on each difficulty. It is the real
 * margin the player has to catch it, and what gets adjusted when touching
 * `DIFFICULTY_SPEEDS` or the geometry of the machine.
 */
export function fallDurationSeconds(difficulty: Difficulty): number {
  return STICK_FALL_DISTANCE / DIFFICULTY_SPEEDS[difficulty]
}

/**
 * Acceleration with which a stick falls, in m/s², so that it travels `distance`
 * at the mean speed `meanSpeed`.
 *
 * The stick is released **at rest** —it hung from a cord— and accelerates the
 * way anything falls: at a fixed speed it "floated" at first and arrived slow at
 * the bottom, and the eye noticed. But with real gravity (9.81) any stick touches
 * the ground in half a second, faster than Impossible does now, and Easy would
 * stop being easy. That is why each difficulty is **the same real fall in slow
 * motion**: the duration of each level is kept and the acceleration comes from
 * it (d = ½·a·T² with T = d/v̄, hence a = 2·v̄²/d). Impossible ends up at
 * ~6.4 m/s², almost real time; Easy, at ~0.09.
 *
 * Neither is the hoop raised nor is an initial impulse given to compensate: the
 * hoop is ruled by the reach of the arm (`hoopHeight.ts`), and a stick that
 * starts with speed looks pushed, not released.
 */
export function fallAcceleration(
  meanSpeed: number,
  distance: number = STICK_FALL_DISTANCE,
): number {
  if (!Number.isFinite(meanSpeed) || !Number.isFinite(distance) || distance <= 0) {
    return 0
  }
  return (2 * meanSpeed * meanSpeed) / distance
}

/** How far a stick has dropped `seconds` after being released with that acceleration. */
export function fallDrop(seconds: number, acceleration: number): number {
  if (!(seconds > 0)) return 0
  return 0.5 * acceleration * seconds * seconds
}

/**
 * How far a stick whose anchor is at height `y` has fallen, **in time**: 0
 * just released, 1 about to touch the ground. It is what turns "when I caught
 * it" into the reflex bonus of the score (see `scoring.ts`) and into the
 * in extremis tap (`haptics.ts`).
 *
 * It is measured in time and not in distance because what is rewarded are the
 * reflexes. Falling with acceleration the two things no longer coincide: halfway
 * through its time a stick has only dropped a quarter of the distance, and
 * measuring the place would give away bonus to whoever catches it up high only
 * because the stick goes slowly there. As it starts from rest, the fraction of
 * time is the root of the fraction of distance, whatever the difficulty; there
 * is no need to know which one it is.
 *
 * `hoopHeight` is the height that stick left from: with the hoop fitted to the
 * player (see `hoopHeight.ts`) the distance changes, and always measuring it
 * against the nominal height would give away reflexes to whoever has it low and
 * take them from whoever has it high.
 */
export function stickFallProgress(
  y: number,
  hoopHeight: number = MACHINE_HEIGHT,
): number {
  const distance = hoopHeight - STICK_MISS_Y
  if (!Number.isFinite(y) || !Number.isFinite(distance) || distance <= 0) {
    return 0
  }
  const fallen = (hoopHeight - y) / distance
  return Math.sqrt(Math.min(Math.max(fallen, 0), 1))
}

/**
 * Point of the hoop for `t` in [0, 1], spreading from left to right in front of
 * the player (who looks towards -Z). It is the same curve the machine follows
 * and the sticks hang from.
 */
export function machinePoint(
  t: number,
  hoopHeight: number = MACHINE_HEIGHT,
): [number, number, number] {
  const angle = (t - 0.5) * Math.PI
  return [
    Math.sin(angle) * MACHINE_RADIUS,
    hoopHeight,
    -Math.cos(angle) * MACHINE_RADIUS,
  ]
}

/**
 * Paths of the local assets (CC0, see public/CREDITS.md), relative to the base
 * they are served from: whoever mounts the game decides where they are (see
 * `assets.ts`), so they are resolved when requested with `assetUrl()`.
 */
export const HDRI_PATH = 'hdri/plaza_pueblo_1k.exr'

/**
 * Maps of the sticks' wood. The relief and the roughness are used, which are
 * the ones that give the feeling of wood with weight, but not the colour map: it
 * is an almost black wood and, as the tint multiplies, it left the sticks dark
 * brown instead of yellow. The colour goes flat, like painted wood.
 */
export const WOOD_TEXTURES = {
  normalMap: 'textures/wood_nor_1k.jpg',
  roughnessMap: 'textures/wood_rough_1k.jpg',
} as const
