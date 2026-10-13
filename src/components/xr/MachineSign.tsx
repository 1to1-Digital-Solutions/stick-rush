'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useHand } from '../../lib/settingsClient'
import { thresholdPulses, signPlacement } from '../../lib/machineSign'
import { useGame } from '../../lib/gameStore'
import { playPulses } from '../../lib/haptics'
import type { Medal } from '../../lib/goal'
import { GoalSign } from './GoalSign'

/** The sign does not move: its placement is the same for the whole run. */
const PLACEMENT = signPlacement()

/**
 * The goal sign, facing the player and under the machine: above the headset's scoreboard.
 *
 * Here only what comes from each side is put together: what it says comes from the store (`sign`),
 * where it goes is decided by `signPlacement` and it is painted by the component shared by all the
 * games of the hall. It hangs from the UI (`XRGazeAnchor`), like the scoreboard: it goes with whoever
 * plays, not with the scenery, and it rises or drops with their eyes.
 *
 * Outside the immersive session, on the game's website, the DOM scoreboard rules and the mission is
 * read there (`HUD.tsx`).
 */
export function MachineSign({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const session = useXR((state) => state.session)
  const { sign, medal } = useGame()
  const hand = useHand()

  // The crossed threshold is felt in the good hand, an instant after the catch that crossed it; the
  // sound is played by `useGameSound`. Whatever is still pending is cancelled on unmount.
  const cancel = useRef(() => {})
  useEffect(() => () => cancel.current(), [])
  const onCelebrate = useCallback(
    (crossed: Medal) => {
      cancel.current()
      cancel.current = playPulses(session?.inputSources ?? [], thresholdPulses(crossed, hand))
    },
    [session, hand],
  )

  if ((hasDomUi && mode == null) || sign == null) return null

  return (
    <GoalSign
      view={sign}
      position={PLACEMENT.position}
      rotation={PLACEMENT.rotation}
      distance={PLACEMENT.distance}
      celebrate={medal}
      onCelebrate={onCelebrate}
    />
  )
}
