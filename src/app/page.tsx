'use client'

import { GameProvider } from '@/components/GameProvider'
import { GameScene } from '@/components/game/GameScene'

export default function Home() {
  return (
    <GameProvider>
      <GameScene />
    </GameProvider>
  )
}
