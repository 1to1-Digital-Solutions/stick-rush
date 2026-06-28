'use client'

import { GameProvider } from '@/components/GameProvider'
import { useGame } from '@/lib/gameStore'
import { StartScreen } from '@/components/ui/StartScreen'
import { GameScene } from '@/components/game/GameScene'

function HomeContent() {
  const { gameState } = useGame()

  if (gameState === 'menu') {
    return <StartScreen />
  }

  return <GameScene />
}

export default function Home() {
  return (
    <GameProvider>
      <HomeContent />
    </GameProvider>
  )
}
