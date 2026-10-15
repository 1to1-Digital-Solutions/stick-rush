'use client'

import { useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useGame } from '../../lib/gameStore'
import { useBareHands } from './useBareHands'

/**
 * Bridge between the state of the WebXR session and the state of the game.
 *
 * On entering VR/AR the player is taken **to the menu**, not to a run: in the
 * headset `XRMenu` rules, which is where they choose sticks and difficulty. Before, the session
 * started a run by itself and chained the next one when it ended, so that
 * nothing could ever be chosen nor could one go back without taking the headset off.
 *
 * It must be mounted inside <XR> to be able to read the session's state.
 */
export function XRSessionController() {
  const mode = useXR((state) => state.mode)
  const bareHanded = useBareHands()
  const { gameState, resetGame, setImmersive, setBareHanded } = useGame()

  // What the game is played with is only known inside the session, and it is needed outside: the
  // tutorial's reflection in the overlay is DOM and does not reach this state. It goes in its
  // own effect because it changes by itself —the controllers are left on the table
  // mid-run— and not on entering or leaving the session.
  useEffect(() => {
    setBareHanded(bareHanded)
  }, [bareHanded, setBareHanded])

  // Remembering that there was a session is essential: on desktop `mode` is always
  // null, and without this guard any run started with the mouse would
  // cancel itself as soon as it began.
  //
  // It starts from whatever there is on mount: mounted already inside a session —what the hall does on
  // choosing a cabinet— there is no desktop run to discard, and the one there is is the hall's
  // challenge, which starts playing (see `HallOptions`). Starting from `false`, it took it for a
  // half-played desktop one and sent the challenge back to the menu.
  const immersive = useRef(mode != null)

  useEffect(() => {
    // The game needs to know whether the headset is on to decide who it
    // shows how to play (see `startGame`). It is noted before anything else: even if
    // the session does not change state, the datum has to be up to date.
    setImmersive(mode != null)

    // Entry: if one arrives with a half-played desktop run, it is discarded.
    // In the headset the starting point is always the menu.
    if (mode != null) {
      if (immersive.current) return
      immersive.current = true
      if (gameState !== 'menu') resetGame()
      return
    }

    // Exit: back to the desktop menu.
    if (!immersive.current) return
    immersive.current = false
    resetGame()
  }, [mode, gameState, resetGame, setImmersive])

  return null
}
