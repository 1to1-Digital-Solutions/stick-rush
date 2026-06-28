'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { XR } from '@react-three/xr'
import { MACHINE_HEIGHT } from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import { xrStore } from '@/components/xr/xrStore'
import { StickMachine } from './StickMachine'
import { Ground } from './Ground'

/**
 * Canvas de React Three Fiber con la escena completa del juego.
 *
 * - Luz ambiental suave + foco verde sobre la máquina.
 * - <XR> envuelve la escena para que, en sesión inmersiva, los mandos
 *   puedan apuntar y "atrapar" los palos (el sistema de punteros de
 *   @react-three/xr dispara los mismos onClick que el ratón).
 * - OrbitControls solo activo cuando la partida ha terminado, para poder
 *   inspeccionar la escena sin interferir con la captura durante el juego.
 */
export function GameCanvas() {
  const { gameState } = useGame()
  const interactive = gameState === 'playing'

  return (
    <Canvas
      shadows
      camera={{ position: [0, 2, 8], fov: 60 }}
      gl={{ antialias: true }}
      className="absolute inset-0"
    >
      <color attach="background" args={['#0F172A']} />
      <fog attach="fog" args={['#0F172A', 12, 28]} />

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
        <StickMachine />
        <Ground />
        <Environment preset="night" />
      </XR>

      <OrbitControls
        enabled={!interactive}
        enablePan={false}
        minDistance={4}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2}
        target={[0, 1.5, 0]}
      />
    </Canvas>
  )
}
