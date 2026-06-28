'use client'

import { useMemo } from 'react'
import { CatmullRomCurve3, Vector3 } from 'three'
import {
  DIFFICULTY_SPEEDS,
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  stickColor,
} from '@/lib/gameConfig'
import { useGame } from '@/lib/gameStore'
import { Stick } from './Stick'

/**
 * Pseudo-aleatorio determinista en [0, 1) a partir de dos enteros (índice
 * y partida). Evita Math.random() en render (impuro) manteniendo el jitter
 * estable durante el ciclo de vida de cada palo.
 */
function seededRandom(a: number, b: number): number {
  const x = Math.sin(a * 374761393 + b * 668265263) * 43758.5453
  return x - Math.floor(x)
}

/** Puntos del arco semicircular en el plano XY (de izquierda a derecha). */
function buildArcPoints(segments: number): Vector3[] {
  const points: Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    // Ángulo de PI (izquierda) a 0 (derecha): semicírculo superior.
    const angle = Math.PI - (i / segments) * Math.PI
    points.push(
      new Vector3(
        Math.cos(angle) * MACHINE_RADIUS,
        Math.sin(angle) * MACHINE_RADIUS * 0.5 + MACHINE_HEIGHT,
        0,
      ),
    )
  }
  return points
}

export function StickMachine() {
  const { stickCount, difficulty, runId, catchStick, resolveStick } = useGame()
  const speed = DIFFICULTY_SPEEDS[difficulty]

  // Curva del arco; se construye una vez (geometría fija de la máquina).
  const curve = useMemo(
    () => new CatmullRomCurve3(buildArcPoints(48)),
    [],
  )

  // Anclajes y retardos escalonados. Se recalculan en cada partida (runId)
  // y cuando cambia el número de palos.
  const sticks = useMemo(() => {
    return Array.from({ length: stickCount }, (_, index) => {
      // Reparte los palos por el arco evitando los extremos exactos.
      const t = stickCount === 1 ? 0.5 : (index + 1) / (stickCount + 1)
      const point = curve.getPointAt(t)
      // Caída escalonada: cada palo arranca algo más tarde, con jitter.
      const delay = (index * (1000 + seededRandom(index, runId) * 500)) / 1000
      return {
        key: `${runId}-${index}`,
        anchor: [point.x, point.y, point.z] as [number, number, number],
        color: stickColor(index),
        delay,
      }
    })
  }, [curve, stickCount, runId])

  // Tubo del arco generado a partir de la curva.
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 64, 0.12, 12, false]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Soportes verticales en los extremos del arco */}
      {[-MACHINE_RADIUS, MACHINE_RADIUS].map((x) => (
        <mesh key={x} position={[x, MACHINE_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[0.1, 0.12, MACHINE_HEIGHT, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}

      {sticks.map((stick) => (
        <Stick
          key={stick.key}
          anchor={stick.anchor}
          color={stick.color}
          speed={speed}
          delay={stick.delay}
          onCatch={catchStick}
          onResolve={resolveStick}
        />
      ))}
    </group>
  )
}
