/**
 * The hand seen in the headset: a glove that grips the controller and closes its fist on squeezing.
 *
 * **Why.** With the goggles on the player asked "to see the hands, or something, to know where
 * one has them and what to grab the sticks with". The drawn controller says where the controller
 * is, but not where the hand is nor when it closes, which is what this game is about. The glove
 * closes its fist with the side trigger: the same press that catches a stick is seen in the hand.
 *
 * Here lives what the glove **does** —how much each finger closes depending on what is squeezed,
 * and at what pace—, without three or React, to test it without a headset. The drawing is in
 * `components/xr/Glove.tsx`. It serves as a mould for the other games: the only thing proper to
 * each one is the shape of its controller.
 */

/** How closed each group of fingers is, from 0 (open) to 1 (fist). */
export interface Pose {
  /** Middle, ring and little finger: the ones that squeeze the side trigger. */
  readonly fingers: number
  /** The index finger, which sits on the front trigger. */
  readonly index: number
  readonly thumb: number
}

/** What is read from the controller every frame. Both values go from 0 to 1. */
export interface Reading {
  /** The side trigger (`xr-standard-squeeze`). */
  readonly grip: number
  /** The front trigger (`xr-standard-trigger`). */
  readonly trigger: number
}

/** What the controller state of @react-three/xr says about a button, reduced to what is used. */
export interface ControllerButtonState {
  readonly state: 'default' | 'touched' | 'pressed'
  readonly button?: number
}

/**
 * How much a button is squeezed, from 0 to 1.
 *
 * The analogue value if the controller gives it —the Quest's triggers do—; if not, pressed or not.
 * A button that does not exist is not squeezed.
 */
export function pressAmount(button: ControllerButtonState | undefined): number {
  if (button == null) return 0
  if (button.button != null && Number.isFinite(button.button)) return clamp01(button.button)
  return button.state === 'pressed' ? 1 : 0
}

/**
 * How closed the hand is with the controller loose: the fingers wrap the handle without squeezing.
 * A fully open glove would not look like it is holding anything. TO BE CALIBRATED WITH THE HEADSET.
 */
export const REST = 0.15

/**
 * The pose that what is being squeezed asks for.
 *
 * The side one closes the whole fist; the index finger follows its trigger, but it also curls in
 * with the fist —nobody closes their hand with the index finger stretched out—; and the thumb goes
 * along halfway.
 */
export function glovePose({ grip, trigger }: Reading): Pose {
  const squeezed = clamp01(grip)
  const fingers = REST + (1 - REST) * squeezed
  return {
    fingers,
    index: Math.max(REST + (1 - REST) * clamp01(trigger), fingers * 0.8),
    thumb: REST + (1 - REST) * squeezed * 0.7,
  }
}

/**
 * How fast the hand goes to the requested pose, as a time constant (1/s). The hand does not
 * jump: it closes; and fast enough for the fist to be seen closing at the same
 * instant a stick is caught. TO BE CALIBRATED WITH THE HEADSET.
 */
export const CLOSING_SPEED = 18

/** One step of the hand towards the requested pose, `dt` seconds later. */
export function approachPose(
  current: Pose,
  target: Pose,
  dt: number,
  speed = CLOSING_SPEED,
): Pose {
  const t = Number.isFinite(dt) && dt > 0 ? 1 - Math.exp(-speed * dt) : 0
  const step = (a: number, b: number) => a + (b - a) * t
  return {
    fingers: step(current.fingers, target.fingers),
    index: step(current.index, target.index),
    thumb: step(current.thumb, target.thumb),
  }
}

/**
 * How much each joint of a finger bends with the fist fully closed, in radians: the
 * base one, the middle one and the tip one. Three phalanges that add up to a little over half a
 * turn, which is what wraps a four-centimetre handle.
 */
export const MAX_BEND = [1.25, 1.35, 0.95] as const

/** The angles of the three joints of a finger with that closure. */
export function fingerAngles(closure: number): [number, number, number] {
  const c = clamp01(closure)
  return [MAX_BEND[0] * c, MAX_BEND[1] * c, MAX_BEND[2] * c]
}

/**
 * From what closure the hand is taken as closed: the fingertips turn green, which is the
 * confirmation that the headset is reading the trigger.
 */
export const CLOSED = 0.85

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.min(1, Math.max(0, x))
}
