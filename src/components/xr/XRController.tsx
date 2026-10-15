'use client'

import {
  CombinedPointer,
  DefaultXRControllerGrabPointer,
  DefaultXRInputSourceRayPointer,
  XRSpace,
  useXRInputSourceStateContext,
} from '@react-three/xr'
import { useGame } from '../../lib/gameStore'
import { carriesTheHint } from '../../lib/hands'
import { ControllerModel } from './XRControllerModel'

/**
 * The player's controller: what is seen in their hand, plus the pointers.
 *
 * It replaces `<DefaultXRController>`, so it has to mount the pointers
 * itself. Both are kept: the grab one (a sphere at the grip, side
 * trigger) is the one the sticks are caught with, and the ray stays for the menu,
 * which is a long arm away and would be awkward to touch. Who can catch and who
 * cannot is decided by `Stick` with `canCatchWithPointer`, not by this file.
 *
 * The drawing of the controller lives in `XRControllerModel`, because the tutorial shows
 * that same controller before the player has anything to grab.
 *
 * **The hand does not go here.** The glove that holds it is mounted by the scene
 * (`PlayerHands`), because this component only exists on the game's own website: inside
 * the xrcade hall the store is the hall's and this is not mounted. Here it would be duplicated.
 */
export function StickRushController() {
  const state = useXRInputSourceStateContext('controller')
  const { gameState, score } = useGame()

  const handedness = state.inputSource.handedness
  // The side trigger falls towards the inside of the hand: on the left controller
  // it is on its right and vice versa.
  const side = handedness === 'left' ? 1 : -1

  // The mark only while it is needed: from the countdown —which is exactly
  // when it is worth showing the control, before anything falls— and until
  // the first stick is caught. In the menu it would be in the way, because the ray is used there, and
  // during the tutorial the demonstration's controller carries it.
  const highlight = carriesTheHint(gameState, score)

  return (
    <>
      <XRSpace space="grip-space">
        <ControllerModel
          side={side}
          highlight={highlight}
          isPressed={() =>
            state.gamepad['xr-standard-squeeze']?.state === 'pressed'
          }
        />
      </XRSpace>

      <CombinedPointer>
        <DefaultXRControllerGrabPointer
          radius={CONTROLLER_GRAB_RADIUS}
          cursorModel
        />
        <DefaultXRInputSourceRayPointer
          makeDefault
          minDistance={0.2}
          rayModel
          cursorModel
        />
      </CombinedPointer>
    </>
  )
}

/** Radius of the controller's grab sphere, in metres (0.07 by default). */
export const CONTROLLER_GRAB_RADIUS = 0.09
