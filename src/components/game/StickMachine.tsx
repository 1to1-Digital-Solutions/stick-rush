'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RepeatWrapping } from 'three'
import {
  DIFFICULTY_SPEEDS,
  GROUND_Y,
  MACHINE_BULB_COLOR,
  MACHINE_FRAME_COLOR,
  MACHINE_HEIGHT,
  MACHINE_STRIPE_COLORS,
  STICK_COLOR,
  WOOD_TEXTURES,
  machinePoint,
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

/** Segmentos del aro, a rayas alternas como el toldo de una caseta. */
const ARC_SEGMENTS = 24
/** Bombillas de la guirnalda que recorre el aro. */
const BULB_COUNT = 13
const TUBE_RADIUS = 0.045

/**
 * La máquina: un aro semicircular horizontal, sostenido por dos postes, del que
 * cuelgan los palos. El jugador se pone en el centro.
 *
 * El aro se construye por segmentos rectos en vez de con una curva continua
 * porque cada tramo alterna color: es lo que le da el aire de caseta de feria
 * sin necesidad de texturas.
 */
export function StickMachine() {
  const { stickCount, difficulty, runId, catchStick, resolveStick } = useGame()
  const speed = DIFFICULTY_SPEEDS[difficulty]

  const [normalMap, roughnessMap] = useTexture([
    WOOD_TEXTURES.normalMap,
    WOOD_TEXTURES.roughnessMap,
  ])

  // El grano corre a lo largo del palo, que es mucho más largo que ancho. Se
  // ajusta en el render del padre para que los materiales de los palos, que se
  // crean después, ya nazcan con la textura configurada.
  useMemo(() => {
    for (const texture of [normalMap, roughnessMap]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(1, 3)
    }
  }, [normalMap, roughnessMap])

  // Tramos del aro: cada uno es un cilindro entre dos puntos consecutivos.
  const segments = useMemo(
    () =>
      Array.from({ length: ARC_SEGMENTS }, (_, index) => {
        const from = machinePoint(index / ARC_SEGMENTS)
        const to = machinePoint((index + 1) / ARC_SEGMENTS)
        const mid: [number, number, number] = [
          (from[0] + to[0]) / 2,
          (from[1] + to[1]) / 2,
          (from[2] + to[2]) / 2,
        ]
        const dx = to[0] - from[0]
        const dz = to[2] - from[2]
        const length = Math.hypot(dx, dz)
        return {
          index,
          mid,
          length,
          // El cilindro nace vertical: se tumba y se orienta a lo largo del tramo.
          rotation: [Math.PI / 2, 0, -Math.atan2(dz, dx) + Math.PI / 2] as [
            number,
            number,
            number,
          ],
          color: MACHINE_STRIPE_COLORS[index % MACHINE_STRIPE_COLORS.length],
        }
      }),
    [],
  )

  // Bombillas repartidas por el aro, justo por encima del tubo.
  const bulbs = useMemo(
    () =>
      Array.from({ length: BULB_COUNT }, (_, index) => {
        const [x, y, z] = machinePoint((index + 0.5) / BULB_COUNT)
        return { index, position: [x, y + TUBE_RADIUS + 0.03, z] as [number, number, number] }
      }),
    [],
  )

  // Anclajes y retardos escalonados. Se recalculan en cada partida (runId)
  // y cuando cambia el número de palos.
  const sticks = useMemo(
    () =>
      Array.from({ length: stickCount }, (_, index) => {
        // Reparte los palos por el aro evitando los extremos exactos.
        const t = stickCount === 1 ? 0.5 : (index + 1) / (stickCount + 1)
        // Caída escalonada: cada palo arranca algo más tarde, con jitter.
        const delay = index * (1 + seededRandom(index, runId) * 0.5)
        return { key: `${runId}-${index}`, anchor: machinePoint(t), delay }
      }),
    [stickCount, runId],
  )

  const postHeight = MACHINE_HEIGHT - GROUND_Y

  return (
    <group>
      {/* Aro a rayas */}
      {segments.map((segment) => (
        <mesh key={segment.index} position={segment.mid} rotation={segment.rotation}>
          {/* Un pelo más largo que el tramo, para que no se vean las juntas. */}
          <cylinderGeometry
            args={[TUBE_RADIUS, TUBE_RADIUS, segment.length * 1.08, 12]}
          />
          <meshStandardMaterial
            color={segment.color}
            metalness={0.1}
            roughness={0.55}
          />
        </mesh>
      ))}

      {/* Guirnalda de bombillas */}
      {bulbs.map((bulb) => (
        <mesh key={bulb.index} position={bulb.position}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshStandardMaterial
            color={MACHINE_BULB_COLOR}
            emissive={MACHINE_BULB_COLOR}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Postes en los extremos del semicírculo, con su base */}
      {[machinePoint(0), machinePoint(1)].map(([x, , z]) => (
        <group key={`${x}-${z}`} position={[x, GROUND_Y, z]}>
          <mesh position={[0, postHeight / 2, 0]}>
            <cylinderGeometry args={[0.045, 0.06, postHeight, 12]} />
            <meshStandardMaterial
              color={MACHINE_FRAME_COLOR}
              metalness={0.7}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.16, 0.19, 0.04, 20]} />
            <meshStandardMaterial
              color={MACHINE_FRAME_COLOR}
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}

      {sticks.map((stick) => (
        <Stick
          key={stick.key}
          anchor={stick.anchor}
          color={STICK_COLOR}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          speed={speed}
          delay={stick.delay}
          onCatch={catchStick}
          onResolve={resolveStick}
        />
      ))}
    </group>
  )
}
