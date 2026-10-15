'use client'

import { Suspense, lazy, useSyncExternalStore } from 'react'
import { useGame } from '../../lib/gameStore'
import { StartScreen } from '../ui/StartScreen'
import { HUD } from './HUD'
import { useLang } from '../../lib/settingsClient'
import { translator } from '../../lib/textos'

// R3F's Canvas depends on WebGL/window, so it is loaded separately and only on
// the client. With React's `lazy` and not with `next/dynamic`: the game is also
// mounted inside other applications, which need not be Next.
const GameCanvas = lazy(() =>
  import('./GameCanvas').then((mod) => ({ default: mod.GameCanvas })),
)

/**
 * Whether the game is already being painted in the browser.
 *
 * It is a subscription to something that never changes because what tells the two
 * values apart is *who* asks: in a server render there is no WebGL to
 * mount the Canvas with, and painting in hydration the same thing that was prerendered is
 * what avoids the mismatch warning.
 */
const NEVER_CHANGES = () => () => {}
const useOnClient = () => useSyncExternalStore(NEVER_CHANGES, () => true, () => false)

function SceneLoading() {
  const t = translator(useLang())
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-background)]">
      <p className="animate-pulse text-sm uppercase tracking-[0.3em] text-white/40">
         {t('Loading scene…')}
</p>
    </div>
  )
}

/**
 * Game scene. The 3D Canvas (with <XR>) is ALWAYS mounted so that the
 * immersive session can start with the scene already in the tree; the menu
 * (StartScreen) and the HUD are laid over it as DOM overlays depending on the state.
 *
 * Before, the menu replaced the scene, so pressing "Entrar en VR"
 * started the session with nothing mounted and nothing was seen in the headset.
 */
export function GameScene() {
  const { gameState } = useGame()
  const onClient = useOnClient()
  // The sound is now mounted by `<GameWorld>`, inside the Canvas: it goes with the
  // game, and the game is also mounted inside the xrcade hall, where this
  // DOM wrapper does not exist. Calling it here as well opened a second
  // AudioContext — the sound e2e caught it.

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
