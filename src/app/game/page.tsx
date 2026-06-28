'use client'

import { GameProvider } from '@/components/GameProvider'
import { GameScene } from '@/components/game/GameScene'

/** Ruta directa a la escena de juego (Canvas 3D + HUD). */
export default function GamePage() {
  return (
    <GameProvider>
      <GameScene />
    </GameProvider>
  )
}
