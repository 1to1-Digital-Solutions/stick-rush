'use client'

import { StickRush } from '@/game'

/** Direct route to the game, the same screen as the home page. */
export default function GamePage() {
  return (
    <div className="h-dvh w-full">
      <StickRush />
    </div>
  )
}
