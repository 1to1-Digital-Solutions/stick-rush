'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { XR, XROrigin, useXR } from '@react-three/xr'
import {
  GROUND_Y,
  MACHINE_HEIGHT,
  XR_PLAYER_DISTANCE,
  XR_PLAYER_SCALE,
} from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import { xrStore } from '@/components/xr/xrStore'
import { XRHud } from '@/components/xr/XRHud'
import { XRSessionController } from '@/components/xr/XRSessionController'
import { StickMachine } from './StickMachine'
import { Ground } from './Ground'

/**
 * Escenario: fondo, niebla, suelo e iluminación de entorno.
 *
 * En AR nada de esto se dibuja: el escenario es la habitación del jugador y
 * pintar un fondo opaco (o el suelo virtual) taparía el passthrough. Solo queda
 * la máquina con sus palos, que es justo el modo AR que pide el producto.
 */
function SceneBackdrop() {
  const mode = useXR((state) => state.mode)

  if (mode === 'immersive-ar') {
    return null
  }

  return (
    <>
      <color attach="background" args={['#0F172A']} />
      <fog attach="fog" args={['#0F172A', 12, 28]} />
      <Ground />
      <Environment preset="night" />
    </>
  )
}

/**
 * Órbita de la cámara de escritorio. Se desactiva durante la partida (para no
 * competir con la captura) y en sesión inmersiva, donde el punto de vista lo
 * manda el visor.
 */
function DesktopControls() {
  const mode = useXR((state) => state.mode)
  const { gameState } = useGame()

  return (
    <OrbitControls
      enabled={mode == null && gameState !== 'playing'}
      enablePan={false}
      minDistance={4}
      maxDistance={16}
      maxPolarAngle={Math.PI / 2}
      target={[0, 1.5, 0]}
    />
  )
}

/**
 * Canvas de React Three Fiber con la escena completa del juego.
 *
 * - Luz ambiental suave + foco verde sobre la máquina (también en AR, para que
 *   la máquina no quede plana sobre la sala real).
 * - <XR> envuelve la escena para que, en sesión inmersiva, los mandos
 *   puedan apuntar y "atrapar" los palos. Con el store por defecto de
 *   @react-three/xr, los controllers/manos emiten un rayo cuyo botón de
 *   selección dispara los mismos eventos onClick que el ratón, así que la
 *   lógica de captura de Stick.tsx funciona igual en navegador y en visor.
 * - <XROrigin> coloca los pies del jugador sobre el suelo virtual (GROUND_Y),
 *   frente a la máquina y agrandado por XR_PLAYER_SCALE: la escena está
 *   modelada para la cámara de escritorio y, a escala 1:1, los palos quedarían
 *   metros por encima de la cabeza (ver gameConfig).
 */
export function GameCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 2, 8], fov: 60 }}
      gl={{ antialias: true }}
      className="absolute inset-0"
    >
      <ambientLight intensity={0.4} />
      <pointLight
        position={[0, MACHINE_HEIGHT + 3, 2]}
        intensity={60}
        color="#15803d"
        distance={20}
        castShadow
      />
      <directionalLight position={[4, 8, 6]} intensity={0.6} />

      <XR store={xrStore}>
        {/* Arranca/cierra partidas según el estado de la sesión inmersiva. */}
        <XRSessionController />

        {/* Jugador de pie sobre el suelo, frente a la máquina, mirando a -Z.
            El HUD 3D cuelga de aquí para heredar su escala y quedar siempre
            delante, a una distancia cómoda. */}
        <XROrigin
          position={[0, GROUND_Y, XR_PLAYER_DISTANCE]}
          scale={XR_PLAYER_SCALE}
        >
          <XRHud />
        </XROrigin>

        <StickMachine />
        <SceneBackdrop />
        <DesktopControls />
      </XR>
    </Canvas>
  )
}
