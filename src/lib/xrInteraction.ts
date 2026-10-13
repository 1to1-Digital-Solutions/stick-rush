/**
 * Rules of interaction with the sticks.
 *
 * A stick is grabbed **with the hand**, not by pointing. In an immersive session
 * @react-three/xr registers several pointers per controller and each one is identified
 * by its `pointerType`:
 *
 * - `grab`  — sphere stuck to the fist, activated with the side trigger (squeeze).
 * - `touch` — direct contact of the hand, without a controller.
 * - `ray`   — the ray that comes out of the controller and reaches any distance.
 * - `mouse` — the mouse, on desktop.
 *
 * The ray is left only for handling the menu: if it were valid for the sticks, the
 * game would come down to pointing from afar and would lose the fun of catching them.
 */
export type PointerKind = 'grab' | 'touch' | 'ray' | 'mouse' | (string & {})

/**
 * Can this pointer catch a stick?
 *
 * Everything is accepted except the ray, instead of listing the valid ones: mouse
 * events do not always carry `pointerType`, and a new pointer of the library must
 * be able to grab sticks by default rather than stay mute without anyone noticing.
 */
export function canCatchWithPointer(pointerType: PointerKind | undefined) {
  return pointerType !== 'ray'
}

/** Life of a stick: it hangs from the hoop, falls, and ends up caught or on the floor. */
export type StickState = 'hanging' | 'falling' | 'caught' | 'missed'

/**
 * Can this stick be caught right now?
 *
 * **A stick is grabbed until it touches the floor, hanging included.** It is a
 * product decision, not an oversight: the window starts as soon as the run
 * starts and closes when the stick is resolved. Emptying the hoop without waiting for
 * anything to fall is a legitimate way to play, and the reflex bonus
 * (`reflexMultiplier`) rewards it precisely for that — whoever waits for the stick
 * below gets half the points.
 *
 * What does close:
 *
 * - A stick **already resolved** (caught or touched the floor) does not count again. The
 *   missed stick stays lying there so that the floor counts the misses, but it is
 *   scenery: picking it up from the floor would erase the miss.
 * - With the run **stopped** nothing is grabbed, and that includes the countdown:
 *   before, the whole hoop could be emptied with clicks before anything started to
 *   fall.
 */
export function canCatchStick(state: StickState, paused: boolean) {
  if (paused) return false
  return state === 'hanging' || state === 'falling'
}

/**
 * Is it being played bare-handed?
 *
 * It changes what has to be **shown**, not what has to be done: the sticks are
 * grabbed the same —the grab pointer goes with the hand just as with the controller—,
 * but the tutorial drew a controller with its side trigger marked, and whoever
 * enters with their hands saw an object they do not have and a button they cannot
 * squeeze.
 *
 * It is required that **there are hands and there are no controllers**, and not only that there are hands: the
 * headset can have both things connected —the controllers on the table keep
 * announcing themselves— and there what the player has in the hand rules. With nothing
 * connected yet the controller is drawn, which is what most people bring.
 */
export function playingBareHanded(inputTypes: readonly string[]): boolean {
  return inputTypes.includes('hand') && !inputTypes.includes('controller')
}
