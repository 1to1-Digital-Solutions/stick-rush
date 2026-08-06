'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import type { Group, MeshBasicMaterial } from 'three'
import { COUNTDOWN_SECONDS, useGame } from '@/lib/gameStore'
import { XR_COUNTDOWN_POSITION } from '@/lib/xrLayout'

/**
 * Cuenta atrás para las sesiones inmersivas.
 *
 * **Sin cifras**, como el resto de la interfaz del visor: `<Text>` de drei
 * descarga la fuente de un CDN que la CSP bloquea. Se cuenta con anillos, uno
 * por segundo, que se apagan de fuera hacia dentro; el que está a punto de
 * caer late para que se vea que el reloj corre y no es un adorno.
 *
 * Va delante y algo por encima del aro, donde el jugador ya está mirando
 * cuando acaba de pulsar "empezar".
 */

const RING_RADIUS = 0.055
const RING_GAP = 0.135

/** Un segundo de la cuenta. Late mientras es el que está corriendo. */
function CountdownRing({
  x,
  spent,
  active,
}: {
  x: number
  spent: boolean
  active: boolean
}) {
  const materialRef = useRef<MeshBasicMaterial>(null)
  const groupRef = useRef<Group>(null)
  const time = useRef(0)

  useFrame((_, delta) => {
    const material = materialRef.current
    const group = groupRef.current
    if (material == null || group == null) return

    time.current += delta

    if (spent) {
      material.opacity = 0.12
      group.scale.setScalar(0.8)
      return
    }

    if (!active) {
      material.opacity = 0.85
      group.scale.setScalar(1)
      return
    }

    // El segundo en curso: crece y se apaga, como una cuenta que se consume.
    const pulse = 0.5 + 0.5 * Math.sin(time.current * Math.PI * 2)
    material.opacity = 0.6 + pulse * 0.4
    group.scale.setScalar(1.12 + pulse * 0.12)
  })

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      <mesh>
        <torusGeometry args={[RING_RADIUS, RING_RADIUS * 0.16, 8, 28]} />
        <meshBasicMaterial
          ref={materialRef}
          color={spent ? '#475569' : '#22c55e'}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export function XRCountdown() {
  const mode = useXR((state) => state.mode)
  const { gameState, countdown } = useGame()

  if (mode == null || gameState !== 'countdown') {
    return null
  }

  const width = (COUNTDOWN_SECONDS - 1) * RING_GAP

  return (
    <group position={XR_COUNTDOWN_POSITION}>
      {Array.from({ length: COUNTDOWN_SECONDS }, (_, index) => {
        // El anillo `index` representa el segundo `COUNTDOWN_SECONDS - index`,
        // así se apagan de izquierda a derecha conforme baja la cuenta.
        const second = COUNTDOWN_SECONDS - index
        return (
          <CountdownRing
            key={second}
            x={index * RING_GAP - width / 2}
            spent={countdown < second}
            active={countdown === second}
          />
        )
      })}
    </group>
  )
}
