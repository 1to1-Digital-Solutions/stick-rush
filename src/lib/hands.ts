import type { Matrix4 } from 'three'

import type { GameState } from './gameStore'

/**
 * The player's hands, mounted by the scene and not by the WebXR store.
 *
 * **Why from the scene.** What the `XRStore` mounts (its `controller`, its `hand.model`)
 * only exists on the game's own website: inside the xrcade hall the store is the hall's, and
 * the hall does not draw hands. That is where it is played the most, so the glove and the bare hand
 * hang from `StickRushScene` and come out the same in both places (`components/xr/PlayerHands`).
 *
 * What decides something lives here; there it is only drawn.
 */

export type Hand = 'left' | 'right'

/** Both, in the order in which they are mounted. */
export const HANDS: readonly Hand[] = ['left', 'right']

/**
 * The side of the controller where the side trigger falls, as `Glove` asks for it: towards the
 * inside of the hand, so on the left controller it is on its right and vice versa.
 */
export function triggerSide(hand: Hand): 1 | -1 {
  return hand === 'left' ? 1 : -1
}

/**
 * Whether the glove's fingertips carry the grip hint.
 *
 * From the countdown —right when it is worth showing the control, before anything falls— and
 * until the first stick is caught. In the menu it would get in the way, because the ray is used there.
 */
export function carriesTheHint(gameState: GameState, score: number): boolean {
  return (gameState === 'countdown' || gameState === 'playing') && score === 0
}

/**
 * Where the articulated model of each hand is, relative to the static files base.
 *
 * **It is requested from the game's base, not from the host's**: the hall serves the controller
 * profiles, but the hand is this game's business. And **outside `webxr-profiles/`**: the hall deletes
 * that folder of each game when installing it, because it serves its own (`install-game-assets.ts`).
 */
export function handPath(hand: Hand): string {
  return `manos/generic-hand/${hand}.glb`
}

/**
 * The twenty-five joints of a WebXR hand, in the order of the specification —which is
 * the order in which `XRHand` goes through them and `fillPoses` writes them— and with the name the
 * bones of the `generic-hand` model carry.
 */
export const JOINTS = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip',
] as const

/**
 * The local matrix that leaves an object where WebXR says, whatever it hangs from.
 *
 * WebXR gives the poses in the origin's space (the host's `<XROrigin>`, at the zero of the
 * scene). The scene hangs the hands below what moves it —the height of the world, the
 * anchor—, so what the parents put in is taken off the pose: `local = parent⁻¹ · pose`.
 * Hung as is, the hand would appear shifted by however much the world has been lowered.
 *
 * @param target        where the result is written (the object's `matrix`).
 * @param parentInWorld the parent's `matrixWorld`, or `null` if it has none.
 * @param atOrigin     the WebXR pose in the origin's space.
 * @param scratch       a working matrix, so as not to create one per frame.
 */
export function placeAtOrigin(
  target: Matrix4,
  parentInWorld: Matrix4 | null,
  atOrigin: Matrix4,
  scratch: Matrix4,
): Matrix4 {
  if (parentInWorld == null) return target.copy(atOrigin)
  return target.multiplyMatrices(scratch.copy(parentInWorld).invert(), atOrigin)
}
