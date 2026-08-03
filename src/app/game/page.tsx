'use client'

import { GameProvider } from '@/components/GameProvider'
import { GameScene } from '@/components/game/GameScene'

/** Ruta directa a la escena (Canvas 3D + menú/HUD como overlays). */
export default function GamePage() {
  return (
    <GameProvider>
      <GameScene />
    </GameProvider>
  )
}
