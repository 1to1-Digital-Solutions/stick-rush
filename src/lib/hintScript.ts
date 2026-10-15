import type { HintScript } from './hints'
import type { Hand } from './settings'
import {
  MACHINE_RADIUS,
  PLAYER_OFFSET_Z,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_RADIUS,
} from './gameConfig'

/**
 * The visual hints of this game: what is shown on entering, and what switches each thing off.
 *
 * **What is not seen by looking at the machine** are two things. Where to stand: at the centre of
 * the hoop, facing the sticks, which is where all of them are reached from without moving. And that
 * a stick **is caught by closing the hand on it while it falls** —with the grip button—, not by
 * pointing at it with the ray like a menu button, and that it is caught **down low**, at chest
 * height, where it passes as it falls, and not up high, where it hangs. The tutorial tells it with
 * letters; this shows it before, without any.
 *
 * The engine —when each one switches on and when it switches off— is in `lib/hints.ts`, the same
 * file in all the games. Here is what belongs to this one: the script and the dimensions of what is
 * painted, which come from here and not from inside the scene so that the test can measure **the
 * same numbers that are painted** and not a copy of them.
 *
 * The dimensions go in **machine coordinates**: the centre of the hoop at zero, the ground at
 * `y = 0` and whoever plays standing one step behind the centre, at `z = PLAYER_OFFSET_Z`
 * (`GameWorld` shifts the world the opposite way). The height of the hoop is not fixed —it comes
 * from the eyes of whoever plays (`hoopHeight.ts`)—, so everything that hangs from it receives it.
 */

/**
 * What a hint of this game can wait for or take for granted.
 *
 * - `grab`: the first stick caught. It is the milestone of the first step of the tutorial
 *   (`milestonesFromCatches`), and the run notes it.
 * - `falling`: that the sticks are about to start falling —the last second of the
 *   countdown— or are already falling. **Everything that floats has to be gone before**: in front
 *   of the hoop, at chest height, is exactly where a stick passes as it falls.
 *
 * Both stay done once done: going back to the menu does not switch on again what was already
 * learned.
 */
export type HintFact = 'grab' | 'falling'

/**
 * The script.
 *
 * - **`ground`**, the two footprints of where to stand: at the centre of the hoop, facing the machine.
 *   They are shown **from the moment the cabinet is entered** —taking position is the only thing
 *   that can be done with the menu in front— and they go with the first stick caught. They are
 *   painted on the ground, and there they can stay while playing: they cover nothing that falls,
 *   since the sticks fall at the hoop, far from the feet.
 * - **`stick`**, the ghost stick: it comes out of the stick hanging in front, wrapping it, falls to
 *   chest height and stays still there for a moment, which is the catch. It is at once "what has
 *   to be caught, highlighted" and "the gesture": that they fall, and where they are caught.
 * - **`controller`**, the real controller with the grip button throbbing, **next to where the
 *   ghost stops** (`controllerByTheStick`): the ghost says what and where; the controller, with what.
 *   It does not go in the hand, which is where the tutorial puts it, so there are no two copies of
 *   the model stepping on each other, and it comes out from the first time.
 *
 * **The ghost and the controller go before anything falls** (`falling`): both float where the
 * game is played, and there they are only good while no sticks are passing. With the countdown
 * running they are still seen for two seconds, which is when one is looking at the machine.
 */
export const HINT_SCRIPT = [
  { id: 'ground', until: 'grab', expiresAfter: 14 },
  { id: 'stick', until: 'falling', expiresAfter: 16 },
  { id: 'controller', until: 'falling', expiresAfter: 16 },
] as const satisfies HintScript<HintFact>

/** What each one is called, so that the scene does not paint them by an invented name. */
export type MachineHint = (typeof HINT_SCRIPT)[number]['id']

/**
 * Whether the sticks are going to start falling: the last second of the countdown, or already in play.
 *
 * The last second and not zero because the ghost and the controller fade out in half a second
 * (`CROSSFADE`), and the first stick comes out as soon as the count ends: on Impossible, in two
 * tenths it is already at chest height.
 */
export function aboutToFall(gameState: string, countdown: number): boolean {
  return gameState === 'playing' || (gameState === 'countdown' && countdown <= 1)
}

/* --- The dimensions of what is painted --- */

/**
 * The two footprints, where whoever plays stands and facing the machine, and what each one measures.
 *
 * **Facing forward and side by side**: the sticks fall around, in front and to the sides, and are
 * caught without taking a step. They go **right where the game places whoever comes in**, so they
 * do not ask to move: they say "here, and looking at the sticks". Shoulder-width apart.
 */
export const FOOTPRINT = { length: 0.26, width: 0.1 }
export const FOOTPRINTS: readonly { x: number; z: number }[] = [
  { x: -0.11, z: PLAYER_OFFSET_Z },
  { x: 0.11, z: PLAYER_OFFSET_Z },
]

/** At what height the footprints are painted above the ground, before the rasterisation bias. */
export const FOOTPRINTS_Y = 0.005

/**
 * Where the stick the ghost comes out of hangs: **the front one**, at the centre of the arch.
 *
 * It is the one in front of the eyes on entering, and with an odd number of sticks —the five
 * of the challenge, the thirteen— there is one hanging right there, so the ghost comes out of a
 * real stick. With an even number it comes out of the gap at the centre, which says the same.
 */
export function ghostStick(hoopHeight: number): [number, number, number] {
  return [0, hoopHeight - STICK_CORD_LENGTH - STICK_LENGTH / 2, -MACHINE_RADIUS]
}

/**
 * By how much the ghost stick wraps the real one: a little more on each side, so that it reads
 * as the stick lit up and not as another stick put inside it.
 */
export const GHOST_MARGIN = 0.006

/** Radius and length of the ghost stick: the real one plus the margin. */
export const GHOST = {
  radius: STICK_RADIUS + GHOST_MARGIN,
  length: STICK_LENGTH + GHOST_MARGIN * 2,
} as const

/**
 * The fall the ghost shows: how far it drops, how long it takes and how the loop is divided up.
 *
 * **It drops to chest height and stops.** What cannot be guessed is that the stick is caught
 * where it passes and not where it hangs, so the stretch that matters is the stop: the ghost
 * stays still down low, with the controller throbbing beside it, and only then fades out. It
 * reappears up high instead of going up, which seen from the eyes would be a stick climbing.
 */
export const FALL = {
  /** How long a whole loop takes, in seconds. */
  period: 2.4,
  /** Up to what point of the loop it takes to appear, still where the stick hangs. */
  appears: 0.12,
  /** Up to what point the fall lasts. */
  falls: 0.5,
  /** And from what point it fades out, already stopped down low. */
  leaves: 0.86,
  /**
   * How far it drops: from the centre of the hanging stick to chest height. The hoop goes half a
   * metre above the eyes (`HOOP_RISE_ABOVE_EYES`), so the ghost ends up some thirty
   * centimetres below them, where the hand reaches comfortably.
   */
  travel: 0.5,
} as const

/**
 * Where the ghost is at that moment of its loop: how far it has dropped, in metres, and how
 * visible it is, from 0 to 1.
 *
 * The fall starts slowly and accelerates, the way something really falls; at a fixed speed it read
 * as a stick sliding along a rail.
 */
export function ghostFall(progress: number): { drop: number; visible: number } {
  const step = Math.min(1, Math.max(0, progress))
  if (step < FALL.appears) return { drop: 0, visible: step / FALL.appears }
  if (step < FALL.falls) {
    const stretch = (step - FALL.appears) / (FALL.falls - FALL.appears)
    return { drop: FALL.travel * stretch * stretch, visible: 1 }
  }
  if (step < FALL.leaves) return { drop: FALL.travel, visible: 1 }
  return { drop: FALL.travel, visible: 1 - (step - FALL.leaves) / (1 - FALL.leaves) }
}

/**
 * The real controller next to the place where the ghost stops: on the side of the good hand of
 * whoever plays, a hand's breadth outwards and a little towards whoever looks at it, and enlarged
 * just enough for the button to be read.
 *
 * - **On the side of the good hand** (`xrcade:hand`, the hall's one): here it is caught with either
 *   of the two, and the one that is reached out first is that one.
 * - **13 cm from the ghost**: the controller measures some 12 cm, and between the two there is air
 *   so that they read as two things.
 * - **Ten centimetres in front of the hoop**, towards whoever plays: in front of the curtain of
 *   sticks and not behind, which from the eyes would be half covered.
 *
 * TO BE CALIBRATED WITH THE HEADSET: the three figures.
 */
export const CONTROLLER_BY_THE_STICK = {
  /** How far it moves away from the ghost towards the hand's side, in metres. */
  gap: 0.13,
  /** How far it comes forward from the hoop towards whoever plays, in metres. */
  ahead: 0.1,
  /** The controller measures some 12 cm: at sixty centimetres from the eyes enlarging it is welcome. */
  scale: 1.3,
} as const

/**
 * Where the controller goes, in machine coordinates, and how much it is turned about the vertical
 * (three's `rotation.y`): what leaves **the grip side facing whoever plays**.
 *
 * The model is drawn as a controller in the hand, pointing at −Z; the grip of the right one is on
 * its left side (−X) and that of the left one on the right (+X). Turned like this it is seen from
 * the side, with the button towards the eyes, which are above the footprints.
 */
export function controllerByTheStick(
  hoopHeight: number,
  hand: Hand,
): { position: [number, number, number]; turn: number } {
  const [x0, y0, z0] = ghostStick(hoopHeight)
  const side = hand === 'left' ? -1 : 1
  const x = x0 + side * CONTROLLER_BY_THE_STICK.gap
  const y = y0 - FALL.travel
  const z = z0 + CONTROLLER_BY_THE_STICK.ahead
  const towardPlayer = PLAYER_OFFSET_Z - z
  const turn = hand === 'left' ? Math.atan2(-towardPlayer, -x) : Math.atan2(towardPlayer, x)
  return { position: [x, y, z], turn }
}
