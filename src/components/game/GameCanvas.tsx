'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR, XROrigin, useXR } from '@react-three/xr'
import { useGame } from '../../lib/gameStore'
import { ExitRing } from '../xr/ExitRing'
import { getXrStore } from '../xr/xrStore'
import { GameWorld } from './GameWorld'

/**
 * El Canvas de la web del juego: uno de sus anfitriones, no el juego.
 *
 * El juego en sí es `<GameWorld>`, que son objetos de three y nada más. Lo que
 * se pone alrededor —el Canvas, la sesión de WebXR, la cámara de escritorio—
 * es de quien lo hospeda, y esta web es un anfitrión como el salón de xrcade.
 * Que su propia web se monte igual que el salón no es simetría gratuita: es
 * cómo se prueba el juego con el visor sin levantar el hub entero, y lo que
 * hace que un fallo del contrato salga aquí y no en el salón.
 */

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
      // Desde la cuenta atrás ya no se orbita: la partida ha empezado y girar
      // la cámara mientras caen los palos compite con la captura.
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
      // "percentage" = PCFShadowMap. El valor por defecto de R3F es
      // PCFSoftShadowMap, deprecado en three 0.185 (avisa por consola).
      shadows="percentage"
      // Elevada y por detrás del jugador: a la altura del aro, un semicírculo
      // horizontal se vería de canto (una simple barra).
      camera={{ position: [0, 1.9, 3.05], fov: 52, near: 0.05, far: 60 }}
      gl={{ antialias: true }}
      className="absolute inset-0"
    >
      <XR store={getXrStore()}>
        {/* El jugador, de pie en el cero. Que el aro le quede alrededor lo
            resuelve el propio mundo corriéndose (ver `<GameWorld>`), igual que
            hace en el salón: así el juego se monta idéntico en los dos sitios. */}
        <XROrigin position={[0, 0, 0]} />
        <GameWorld hasDomUi />
        <DesktopControls />
        {/* La salida común, sosteniendo B o Y: en el salón la pone el salón. */}
        <ExitRing />
      </XR>
    </Canvas>
  )
}
