'use client'

import { Grid } from '@react-three/drei'
import { GROUND_Y } from '@/lib/gameConfig'

/**
 * Suelo de la escena: la moqueta roja de la caseta, con una rejilla dorada
 * tenue que da sensación de profundidad. Situado en y=GROUND_Y, que es la cota
 * a la que un palo se considera perdido.
 */
export function Ground() {
  return (
    <group position={[0, GROUND_Y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#4a1013" metalness={0} roughness={0.95} />
      </mesh>
      <Grid
        args={[24, 24]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6b2a24"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#9a7b33"
        fadeDistance={16}
        fadeStrength={1.5}
        infiniteGrid={false}
      />
    </group>
  )
}
