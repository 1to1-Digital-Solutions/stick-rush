'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Euler, Quaternion, Vector3, type Group } from 'three'
import { useGame } from '../../lib/gameStore'
import {
  XR_ANCHOR_DEADZONE,
  initialAnchorState,
  stepAnchor,
  type AnchorState,
} from '../../lib/xrAnchor'
import { usePlayHeight } from '../../lib/settingsClient'
import { XR_COLUMN, xrUiRiseOverWorld } from '../../lib/xrLayout'

/**
 * Keeps the immersive UI where the player sees it: in front of their face and at
 * the height of their eyes.
 *
 * Everything that hangs from here keeps its usual coordinates (the menu
 * 95 cm towards −Z, for example), but that −Z becomes **where the player is
 * looking** instead of a fixed direction of the room. Without this, entering the
 * headset looking another way left the menu behind the player's back: it could neither be seen nor
 * pointed at (see `@/lib/xrAnchor`).
 *
 * The group also goes with the player if they walk, so the UI does not
 * stay anchored to a point of the room, and it adapts to their height (see
 * `xrUiRise`): `<XRPlayerHeight>` measures it while the menu is in front, so
 * during the run the panel stays still instead of chasing the
 * head.
 *
 * The whole decision of *when* to turn is in `stepAnchor`, which is tested without a
 * browser; here the camera is only read and the result applied.
 */
export function XRGazeAnchor({
  children,
  always = false,
  pointerEventsOrder,
}: {
  children: ReactNode
  /**
   * Place the UI outside the immersive session too. It is what is needed
   * when the host puts no DOM UI —the xrcade hall, without a headset—:
   * there this is the only UI there is, and leaving it unplaced leaves it wherever
   * it falls, normally behind the back of whoever is looking.
   */
  always?: boolean
  /**
   * With what priority whatever hangs from here takes the ray against the rest of the scene
   * (`lib/pointers.ts`). It goes on the group and not panel by panel because it belongs to the whole UI:
   * between the hand and any button there are always sticks, which is what this machine is about.
   */
  pointerEventsOrder?: number
}) {
  const ref = useRef<Group>(null)
  const anchor = useRef<AnchorState | null>(null)
  const mode = useXR((state) => state.mode)
  const { playerEyeHeight } = useGame()

  // Every session starts from scratch: on entering, the UI must plant itself in front
  // of the player right away, without the reframing turn.
  useEffect(() => {
    anchor.current = null
  }, [mode])

  // If the whole world has already come down to whoever plays, the UI came with
  // it and needs no correction of its own (see `xrUiRiseOverWorld`).
  const atEyeHeight = usePlayHeight() === 'eyes'
  useFrame((state, delta) => {
    const group = ref.current
    // Outside the immersive session there is nothing to place if the DOM rules; if there
    // is none (`always`), this UI is the only one and it is placed anyway, in front of
    // wherever the camera the host puts is looking.
    if (group == null || (mode == null && !always)) return

    const { camera } = state
    camera.getWorldPosition(gazePosition)
    camera.getWorldQuaternion(gazeQuaternion)

    // The YXZ order isolates the horizontal turn in the first angle: that way the
    // UI follows where the player looks without tilting when they raise or
    // lower their head, which is what would make it wobble.
    gazeEuler.setFromQuaternion(gazeQuaternion, 'YXZ')

    // The anchor works in the parent's space (`<XROrigin>`), so the
    // orientation of that parent has to be discounted instead of taking it as zero.
    let parentYaw = 0
    const parent = group.parent
    if (parent != null) {
      parent.getWorldQuaternion(parentQuaternion)
      parentEuler.setFromQuaternion(parentQuaternion, 'YXZ')
      parentYaw = parentEuler.y
      parent.worldToLocal(gazePosition)
    }

    const gazeYaw = gazeEuler.y - parentYaw
    const previous = anchor.current
    const next =
      previous == null
        ? initialAnchorState(gazeYaw)
        : stepAnchor(previous, gazeYaw, delta, ANCHOR_OPTIONS)
    anchor.current = next

    // At the eye height of whoever plays, not at the floor's: the heights in
    // `xrLayout` are those of the reference person and rise or drop with the player, so
    // seated they do not find the panel at forehead height.
    group.position.set(
      gazePosition.x,
      xrUiRiseOverWorld(playerEyeHeight, atEyeHeight),
      gazePosition.z,
    )
    group.rotation.set(0, next.yaw, 0)
  })

  return (
    <group ref={ref} pointerEventsOrder={pointerEventsOrder}>
      {children}
    </group>
  )
}

/**
 * The menu's column is on the left on purpose (`XR_COLUMN`): towards that side the dead
 * zone is lengthened by how far aside it is, so that turning to look at it does not make it flee.
 */
const ANCHOR_OPTIONS = { leftDeadzone: XR_ANCHOR_DEADZONE + XR_COLUMN.azimuth }

// Reused between frames: creating vectors inside useFrame generates garbage in
// each of the headset's 90 frames per second.
const gazePosition = new Vector3()
const gazeQuaternion = new Quaternion()
const gazeEuler = new Euler()
const parentQuaternion = new Quaternion()
const parentEuler = new Euler()
