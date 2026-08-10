'use client'

import dynamic from 'next/dynamic'
import { useGame } from '@/lib/gameStore'
import { StartScreen } from '@/components/ui/StartScreen'
import { HUD } from './HUD'
import { useGameSound } from './useGameSound'

// El Canvas de R3F depende de WebGL/window, así que se carga solo en cliente.
const GameCanvas = dynamic(
  () => import('./GameCanvas').then((mod) => mod.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-background)]">
        <p className="animate-pulse text-sm uppercase tracking-[0.3em] text-white/40">
          Cargando escena…
        </p>
      </div>
    ),
  },
)

/**
 * Escena de juego. El Canvas 3D (con <XR>) está SIEMPRE montado para que la
 * sesión inmersiva pueda arrancar con la escena ya en el árbol; el menú
 * (StartScreen) y el HUD se superponen como overlays en DOM según el estado.
 *
 * Antes el menú reemplazaba a la escena, por lo que pulsar "Entrar en VR"
 * iniciaba la sesión sin nada montado y no se veía nada en el visor.
 */
export function GameScene() {
  const { gameState } = useGame()
  // Aquí y no dentro del Canvas: el sonido acompaña a la partida, no a la
  // escena 3D, y desde fuera vale igual para el navegador y para el visor.
  useGameSound()

  return (
    <div className="relative h-dvh w-full">
      <GameCanvas />
      {gameState === 'menu' ? <StartScreen /> : <HUD />}
    </div>
  )
}
