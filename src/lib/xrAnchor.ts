/**
 * Anchoring of the immersive ui to the player's gaze.
 *
 * **The problem it solves.** Menu, scoreboard and back button hung from
 * `<XROrigin>` at fixed positions with negative Z. But the origin is not the
 * player's head: it is the origin of the room's reference space, and its
 * −Z is decided by the system on creating the session (on a Quest, depending on how the
 * guardian is calibrated). If the player did not enter looking right towards that −Z,
 * the ui appeared **behind their back**: they did not see the menu, could not select
 * anything and the exit button was unreachable.
 *
 * **How it is solved.** A group that is placed under the player and turns with them,
 * so that the ui always falls inside their field of view. But not
 * stuck to the face: following the gaze frame by frame is dizzying and, above all, makes
 * it impossible to aim (the target flees from the ray). So there is a **dead
 * zone**: while the player looks towards the ui, it stays still and
 * can be aimed at calmly; only if they turn too far does the ui
 * catch up with them with a smooth turn and stay still again.
 *
 * Only the angle arithmetic lives here, with nothing of three.js, to be able to
 * test the behaviour without a browser or a headset —which is precisely what could not
 * be done with the pointers—. The `XRGazeAnchor` component just reads
 * the camera and applies what `stepAnchor` decides.
 */

/**
 * How much the head can turn before the ui follows it, in radians
 * (~40°). It is somewhat less than half a comfortable field of view: on glancing sideways the
 * ui is still there, but on turning towards somewhere else it comes behind.
 */
export const XR_ANCHOR_DEADZONE = 0.7

/**
 * How long the reframing takes, as an exponential time constant (1/s).
 * A high value chases abruptly and is dizzying; a low one is left behind.
 */
export const XR_ANCHOR_FOLLOW_SPEED = 3.5

/**
 * Offset below which the reframing is considered finished
 * (~1.7°). Without this, the exponential interpolation never quite arrives and the
 * ui would be left chasing the player forever.
 */
export const XR_ANCHOR_SETTLE = 0.03

const TWO_PI = Math.PI * 2

/**
 * Takes any angle to the range [−π, π). The exact antipode is ambiguous by
 * nature (±π are the same angle) and is resolved as −π.
 */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  const wrapped = (angle + Math.PI) % TWO_PI
  return (wrapped < 0 ? wrapped + TWO_PI : wrapped) - Math.PI
}

/**
 * Shortest turn to go from `from` to `to`. It returns the direction in the sign, and
 * never goes the long way round: from 170° to −170° is 20°, not 340°.
 */
export function angleDelta(from: number, to: number): number {
  return normalizeAngle(to - from)
}

/**
 * Interpolation fraction of this frame, independent of the framerate.
 *
 * A bare `factor * delta` changes behaviour between the 72 Hz of one
 * headset and the 120 of another; the exponential gives the same travel in the same
 * real time whatever the number of frames.
 */
export function followRatio(
  delta: number,
  speed: number = XR_ANCHOR_FOLLOW_SPEED,
): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0
  return 1 - Math.exp(-speed * delta)
}

/** Brings `current` closer to `target` by the short way, without overshooting. */
export function approachAngle(
  current: number,
  target: number,
  ratio: number,
): number {
  const clamped = Math.min(Math.max(ratio, 0), 1)
  return normalizeAngle(current + angleDelta(current, target) * clamped)
}

/**
 * State of the anchoring between frames.
 *
 * `following` is what gives the hysteresis: it switches on when leaving the dead
 * zone and does not switch off until having caught up with the player. Without it, the ui
 * would stop as soon as it entered the dead zone again and would always be left
 * crooked at the edge.
 */
export type AnchorState = {
  /** Current orientation of the ui, in radians. */
  yaw: number
  /** Is it reframing right now? */
  following: boolean
}

export type AnchorOptions = {
  deadzone?: number
  /**
   * The dead zone towards the left, if it is different. By default, the same as to the
   * right. It is for what the ui has to one side on purpose —the menu column,
   * 55° to the left (`XR_COLUMN`)—: with the usual dead zone, turning to look at it
   * would make the whole ui chase it, and the column would escape every time
   * one turns towards it.
   */
  leftDeadzone?: number
  speed?: number
  settle?: number
}

/** Initial state: the ui is born already aligned with the gaze. */
export function initialAnchorState(yaw: number): AnchorState {
  return { yaw: normalizeAngle(yaw), following: false }
}

/**
 * Advances the anchoring one frame.
 *
 * @param state    where the ui is now
 * @param gazeYaw  where the player is looking
 * @param delta    seconds elapsed since the previous frame
 */
export function stepAnchor(
  state: AnchorState,
  gazeYaw: number,
  delta: number,
  options: AnchorOptions = {},
): AnchorState {
  const {
    deadzone = XR_ANCHOR_DEADZONE,
    leftDeadzone = deadzone,
    speed = XR_ANCHOR_FOLLOW_SPEED,
    settle = XR_ANCHOR_SETTLE,
  } = options

  const target = normalizeAngle(gazeYaw)
  const signed = angleDelta(state.yaw, target)
  const offset = Math.abs(signed)
  // A positive turn around the vertical is looking to the left (−Z towards −X).
  const limit = signed > 0 ? leftDeadzone : deadzone

  // Still and the player looking at it: it is not touched, to be able to aim calmly.
  if (!state.following && offset <= limit) {
    return state
  }

  // It has left the dead zone: from here on it chases until catching up with them.
  if (offset <= settle) {
    return { yaw: target, following: false }
  }

  return {
    yaw: approachAngle(state.yaw, target, followRatio(delta, speed)),
    following: true,
  }
}
