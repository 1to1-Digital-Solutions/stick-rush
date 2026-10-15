'use client'

import { useXR } from '@react-three/xr'

import { playingBareHanded } from '../../lib/xrInteraction'

/**
 * Whether the current session is being played bare-handed.
 *
 * The rule lives in `@/lib/xrInteraction`, tested without a browser; here it is only
 * given what the session says. The selector returns a boolean and not the list,
 * because anything not compared by value would render again on
 * every frame.
 */
export function useBareHands(): boolean {
  return useXR((state) =>
    playingBareHanded(state.inputSourceStates.map((input) => input.type)),
  )
}
