'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR, XROrigin, useXR } from '@react-three/xr'
import { useGame } from '../../lib/gameStore'
import { ExitRing } from '../xr/ExitRing'
import { getXrStore } from '../xr/xrStore'
import { GameWorld } from './GameWorld'

/**
 * The Canvas of the game's own website: one of its hosts, not the game.
 *
 * The game itself is `<GameWorld>`, which is three objects and nothing else. What
 * goes around it —the Canvas, the WebXR session, the desktop camera— belongs
 * to whoever hosts it, and this website is a host just like the xrcade hall.
 * That its own website mounts it the same way the hall does is not gratuitous symmetry: it is
 * how the game is tried with the headset without bringing up the whole hub, and what
 * makes a contract failure show up here and not in the hall.
 */

/**
 * Orbit of the desktop camera. It is disabled during the run (so as not to
 * compete with the catch) and in an immersive session, where the point of view is
 * the headset's call.
 */
function DesktopControls() {
  const mode = useXR((state) => state.mode)
  const { gameState } = useGame()

  return (
    <OrbitControls
      // From the countdown on there is no more orbiting: the run has started and turning
      // the camera while the sticks fall competes with the catch.
      enabled={
        mode == null && (gameState === 'menu' || gameState === 'finished')
      }
      enablePan={false}
      minDistance={1.7}
      maxDistance={7}
      maxPolarAngle={Math.PI / 2.2}
      target={[0, 1.12, -0.25]}
    />
  )
}

export function GameCanvas() {
  return (
    <Canvas
      // "percentage" = PCFShadowMap. R3F's default value is
      // PCFSoftShadowMap, deprecated in three 0.185 (it warns on the console).
      shadows="percentage"
      // Raised and behind the player: at the height of the hoop, a horizontal
      // semicircle would be seen edge-on (a plain bar).
      camera={{ position: [0, 1.9, 3.05], fov: 52, near: 0.05, far: 60 }}
      gl={{ antialias: true }}
      className="absolute inset-0"
    >
      <XR store={getXrStore()}>
        {/* The player, standing at zero. Having the hoop around them is
            solved by the world itself shifting (see `<GameWorld>`), just as
            it does in the hall: that way the game mounts identically in both places. */}
        <XROrigin position={[0, 0, 0]} />
        <GameWorld hasDomUi />
        <DesktopControls />
        {/* The common exit, holding B or Y: in the hall the hall provides it. */}
        <ExitRing />
      </XR>
    </Canvas>
  )
}
