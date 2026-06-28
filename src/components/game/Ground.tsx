'use client'

import { Grid } from '@react-three/drei'
import { GROUND_Y } from '@/lib/gameConfig'

/**
 * Suelo de la escena: un plano oscuro semitransparente con una rejilla
 * que da sensación de profundidad y reflejo sutil. Situado en y=GROUND_Y,
 * que es también la cota a la que un palo se considera "perdido".
 */
export function Ground() {
  return (
    <group position={[0, GROUND_Y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial
          color="#0b1320"
          metalness={0.4}
          roughness={0.6}
          transparent
          opacity={0.85}
        />
      </mesh>
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#1f3a2b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#15803d"
        fadeDistance={22}
        fadeStrength={1.5}
        infiniteGrid={false}
      />
    </group>
  )
}
