'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import type { Group, MeshBasicMaterial } from 'three'
import { COUNTDOWN_SECONDS, useGame } from '../../lib/gameStore'
import { XR_COUNTDOWN_POSITION } from '../../lib/xrLayout'

/**
 * Countdown for immersive sessions.
 *
 * **No figures**, like the rest of the headset's UI: drei's `<Text>`
 * downloads the font from a CDN that the CSP blocks. It is counted with rings, one
 * per second, that go out from the outside in; the one about to
 * drop pulses so it shows that the clock is running and it is not an ornament.
 *
 * It goes in front of and somewhat above the hoop, where the player is already looking
 * when they have just pressed "start".
 */

const RING_RADIUS = 0.055
const RING_GAP = 0.135

/** One second of the count. It pulses while it is the one running. */
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

    // The second in progress: it grows and goes out, like a count being used up.
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

export function XRCountdown({ hasDomUi = false }: { hasDomUi?: boolean }) {
  const mode = useXR((state) => state.mode)
  const { gameState, countdown } = useGame()

  if ((hasDomUi && mode == null) || gameState !== 'countdown') {
    return null
  }

  const width = (COUNTDOWN_SECONDS - 1) * RING_GAP

  return (
    <group position={XR_COUNTDOWN_POSITION}>
      {Array.from({ length: COUNTDOWN_SECONDS }, (_, index) => {
        // Ring `index` stands for second `COUNTDOWN_SECONDS - index`,
        // so they go out from left to right as the count goes down.
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
