'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Vector3 } from 'three'
import { usePlayHeight } from '../../lib/settingsClient'
import { useGame } from '../../lib/gameStore'
import { hasFloorReference, headsetEyeHeight } from '../../lib/hoopHeight'
import { followRatio } from '../../lib/xrAnchor'

/**
 * Measures at what height whoever wears the headset has their head, so that the hoop is
 * put within their reach (see `@/lib/hoopHeight`).
 *
 * **Only while the run is being chosen.** With the sticks falling, a hoop that
 * chased the head would rise on standing on tiptoe and drop on crouching
 * for a stick, just when the player is working out where it is going to be. The
 * height is taken in the menu and stays still until the next one.
 *
 * **Smoothed and with a threshold.** The head never stops moving; without a filter, the hoop
 * would tremble with the breathing, and without a threshold every millimetre would repaint the
 * whole machine. The measurement is followed slowly and the game is only told when
 * the change is noticeable.
 *
 * It must be mounted inside <XR> to be able to read the session's state.
 */
export function XRPlayerHeight() {
  const mode = useXR((state) => state.mode)
  // Only a reference space with a floor lets the height be known: in a
  // `local` one the head is born at zero and its height does not measure from the floor. The
  // session is looked at and not `useXRSessionFeatureEnabled`, which takes as not enabled what
  // the browser simply does not publish (see `hasFloorReference`).
  const floorLevel = useXR((state) =>
    hasFloorReference(state.session?.enabledFeatures),
  )
  const { gameState, setPlayerEyeHeight } = useGame()
  // With the whole world coming down to the player (see `XRWorldHeight`), the hoop
  // already comes with it: following their height as well would lower it twice and it would end up
  // below the hands. There the hoop stays at its design height and it is the
  // scenery that comes closer — the menu's manual correction still applies.
  const atEyeHeight = usePlayHeight() === 'eyes'

  const smoothed = useRef<number | null>(null)
  const reported = useRef<number | null>(null)

  // Outside the session there is nobody to measure: the hoop goes back to its reference
  // height and the next session starts measuring from scratch.
  useEffect(() => {
    if (mode != null) return
    smoothed.current = null
    reported.current = null
    setPlayerEyeHeight(null)
  }, [mode, setPlayerEyeHeight])

  useFrame((state, delta) => {
    if (mode == null || gameState !== 'menu') return

    // The world already comes closer by itself: the hoop stays where it was drawn.
    if (atEyeHeight) {
      if (reported.current !== null) {
        reported.current = null
        setPlayerEyeHeight(null)
      }
      return
    }

    state.camera.getWorldPosition(headPosition)
    const measured = headsetEyeHeight(headPosition.y, floorLevel)
    if (measured == null) return

    // The first measurement goes in whole —the hoop has to be in place before
    // the player looks—; from then on it is chased slowly, with the same
    // framerate-independent interpolation the anchor uses.
    smoothed.current =
      smoothed.current == null
        ? measured
        : smoothed.current +
          (measured - smoothed.current) * followRatio(delta, SMOOTHING_SPEED)

    if (
      reported.current != null &&
      Math.abs(smoothed.current - reported.current) < REPORT_THRESHOLD
    ) {
      return
    }
    reported.current = smoothed.current
    setPlayerEyeHeight(smoothed.current)
  })

  return null
}

/** How much the measurement has to change to move the hoop, in metres. */
const REPORT_THRESHOLD = 0.02

/**
 * How long the measurement takes to follow the head, as an exponential time
 * constant (1/s). Quite a lot slower than the UI's anchor: here it is not
 * a turn that is chased but a height, which does not change.
 */
const SMOOTHING_SPEED = 1.2

// Reused between frames: creating a vector inside useFrame generates garbage in
// each of the headset's 90 frames per second.
const headPosition = new Vector3()
