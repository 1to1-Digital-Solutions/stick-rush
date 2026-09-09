'use client'

import { Suspense, lazy, useSyncExternalStore } from 'react'
import { useGame } from '../../lib/gameStore'
import { StartScreen } from '../ui/StartScreen'
import { HUD } from './HUD'

// El Canvas de R3F depende de WebGL/window, así que se carga aparte y solo en
// cliente. Con `lazy` de React y no con `next/dynamic`: el juego se monta
// también dentro de otras aplicaciones, que no tienen por qué ser Next.
const GameCanvas = lazy(() =>
  import('./GameCanvas').then((mod) => ({ default: mod.GameCanvas })),
)

/**
 * Si el juego ya se está pintando en el navegador.
 *
 * Es una suscripción a algo que nunca cambia porque lo que distingue los dos
 * valores es *quién* pregunta: en un render de servidor no hay WebGL con el que
 * montar el Canvas, y pintar en la hidratación lo mismo que se prerenderizó es
 * lo que evita el aviso de desajuste.
 */
const NEVER_CHANGES = () => () => {}
const useOnClient = () => useSyncExternalStore(NEVER_CHANGES, () => true, () => false)

function SceneLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-background)]">
      <p className="animate-pulse text-sm uppercase tracking-[0.3em] text-white/40">
        Loading scene…
      </p>
    </div>
  )
}

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
  const onClient = useOnClient()
  // El sonido lo monta ahora `<GameWorld>`, dentro del Canvas: acompaña al
  // juego, y el juego se monta también dentro del salón de xrcade, donde esta
  // envoltura de DOM no existe. Llamarlo aquí además abría un segundo
  // AudioContext — lo cazó el e2e del sonido.

  return (
    <div className="stick-rush relative h-full w-full">
      {onClient ? (
        <Suspense fallback={<SceneLoading />}>
          <GameCanvas />
        </Suspense>
      ) : (
        <SceneLoading />
      )}
      {gameState === 'menu' ? <StartScreen /> : <HUD />}
    </div>
  )
}
