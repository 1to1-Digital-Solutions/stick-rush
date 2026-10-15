'use client'

import { useEffect, type RefObject } from 'react'
import { useGame } from '../../lib/gameStore'

/** What the fairground watches of the game: for now, the streak. */
export interface FairMoodState {
  streak: number
}

/**
 * Carries the streak of the game to a ref that the venue reads on every frame.
 *
 * It is the only bit of the decor that listens to the state, and it paints nothing: if the
 * crowd or the bulbs read `useGame()` directly, every change of the
 * run would render hundreds of instances again to move one number.
 * Here the change reaches a ref and the scene reads it where it is already watching the
 * clock: in `useFrame`.
 */
export function FairMood({ moodRef }: { moodRef: RefObject<FairMoodState> }) {
  const { streak } = useGame()

  useEffect(() => {
    moodRef.current.streak = streak
  }, [moodRef, streak])

  return null
}
