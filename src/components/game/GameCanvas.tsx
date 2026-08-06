'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { XR, XROrigin, useXR } from '@react-three/xr'
import {
  BACKDROP_COLOR,
  HDRI_URL,
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  PLAYER_POSITION,
} from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import { xrStore } from '@/components/xr/xrStore'
import { XRGazeAnchor } from '@/components/xr/XRGazeAnchor'
import { XRHud, XRQuitButton } from '@/components/xr/XRHud'
import { XRMenu } from '@/components/xr/XRMenu'
import { XRSessionController } from '@/components/xr/XRSessionController'
import { StickMachine } from './StickMachine'
import { Ground } from './Ground'

/**
 * Escenario: fondo, suelo e iluminación de entorno.
 *
 * El HDRI (una plaza de pueblo de noche, CC0, servido desde `public/`) hace de
 * escenario en VR y en escritorio: envuelve la escena, se proyecta sobre el
 * suelo y además ilumina la máquina con la luz cálida de las farolas.
 *
 * En AR no se dibuja ni fondo ni suelo: el escenario es la habitación del
 * jugador y taparla con un decorado rompería el passthrough. El HDRI sí se
 * mantiene, pero solo como fuente de reflejos (`background={false}`): sin él la
 * máquina se vería plana y apagada sobre la sala real.
 */
function SceneBackdrop() {
  const mode = useXR((state) => state.mode)
  const isAR = mode === 'immersive-ar'

  return (
    <>
      {!isAR && (
        <>
          {/* Solo se ve mientras carga el HDRI; luego lo sustituye el fondo. */}
          <color attach="background" args={[BACKDROP_COLOR]} />
          <Ground />
        </>
      )}

      {/* Suspense propio: mientras se carga el HDRI el resto de la escena ya se
          ve, en vez de quedarse todo el Canvas en blanco esperándolo. */}
      <Suspense fallback={null}>
        <Environment
          files={HDRI_URL}
          background={!isAR}
          environmentIntensity={1.4}
          // Proyecta el HDRI también sobre el suelo, de modo que la máquina se
          // planta en el empedrado de la plaza en vez de sobre un plano de
          // color con un corte visible contra el horizonte de la foto.
          ground={isAR ? undefined : { height: 1.6, radius: 14, scale: 45 }}
        />
      </Suspense>
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
      minDistance={1.7}
      maxDistance={7}
      maxPolarAngle={Math.PI / 2.2}
      target={[0, 1.12, -0.25]}
    />
  )
}

/**
 * Canvas de React Three Fiber con la escena completa del juego.
 *
 * - <XR> envuelve la escena para que, en sesión inmersiva, los mandos puedan
 *   apuntar y "atrapar" los palos. Con el store por defecto de
 *   @react-three/xr, los controllers/manos emiten un rayo cuyo botón de
 *   selección dispara los mismos eventos onClick que el ratón, así que la
 *   lógica de captura de Stick.tsx funciona igual en navegador y en visor.
 * - <XROrigin> planta al jugador en el centro del semicírculo, a escala 1:1
 *   (la escena está en metros): los palos le caen alrededor, al alcance del
 *   brazo. El HUD 3D cuelga de aquí para acompañarle.
 * - La cámara de escritorio se coloca algo por detrás y por encima de esa misma
 *   posición, para que se vea el aro entero.
 */
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
      <ambientLight intensity={0.35} />
      {/* Foco cálido sobre la máquina, como el de una caseta de feria de noche. */}
      <pointLight
        position={[0, MACHINE_HEIGHT + 1, -MACHINE_RADIUS * 0.4]}
        intensity={16}
        color="#ffd479"
        distance={10}
        castShadow
      />
      {/* Relleno frío por detrás, para despegar la máquina del fondo oscuro. */}
      <directionalLight position={[2.5, 4, 3]} intensity={0.35} color="#9fb6d6" />

      <XR store={xrStore}>
        {/* Arranca/cierra partidas según el estado de la sesión inmersiva. */}
        <XRSessionController />

        {/* Jugador de pie en el centro del semicírculo. La interfaz cuelga de
            <XRGazeAnchor> y no del origen: el -Z del origen lo fija la
            calibración de la sala, así que entrar mirando a otro lado dejaba el
            menú a la espalda, invisible e imposible de apuntar. */}
        <XROrigin position={PLAYER_POSITION}>
          <XRGazeAnchor>
            <XRHud />
            <XRMenu />
            <XRQuitButton />
          </XRGazeAnchor>
        </XROrigin>

        {/* Las texturas de la madera se cargan aquí dentro; con su propio
            Suspense la máquina aparece en cuanto están, sin bloquear el resto. */}
        <Suspense fallback={null}>
          <StickMachine />
        </Suspense>

        <SceneBackdrop />
        <DesktopControls />
      </XR>
    </Canvas>
  )
}
