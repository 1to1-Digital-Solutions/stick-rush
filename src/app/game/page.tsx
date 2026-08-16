'use client'

import { StickRush } from '@/game'

/** Ruta directa al juego, la misma pantalla que la portada. */
export default function GamePage() {
  return (
    <div className="h-dvh w-full">
      <StickRush />
    </div>
  )
}
