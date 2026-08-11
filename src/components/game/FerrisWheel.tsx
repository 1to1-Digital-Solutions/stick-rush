'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { MACHINE_STRIPE_COLORS, MACHINE_TRUSS_COLOR } from '@/lib/gameConfig'
import {
  WHEEL_CABIN_COUNT,
  WHEEL_CABIN_DROP,
  WHEEL_CENTER,
  WHEEL_RADIUS,
  WHEEL_SPEED,
  facingRotationY,
} from '@/lib/sceneryLayout'
import { Board, Bulb, Pole } from './FairPieces'

/**
 * Noria al fondo del recinto.
 *
 * Es lo que da profundidad al escenario: algo grande, lejano y en movimiento
 * que el HDRI no puede aportar, porque una foto de fondo no cambia al mover la
 * cabeza. Gira despacio —una vuelta larga— para que se note que está viva sin
 * llamar la atención mientras caen los palos.
 *
 * La rueda gira en su plano XY local y el conjunto encara al jugador, así que
 * se ve de frente y no de canto.
 */

/** Separación entre los dos aros de la rueda. */
const RIM_GAP = 1.3
/**
 * Grosor del aro, de los radios y de las bombillas. Van generosos a propósito:
 * a doce metros, una rueda de tubos finos se deshace en una maraña de líneas
 * que apenas se distingue del edificio que tiene detrás.
 */
const RIM_TUBE = 0.12
const SPOKE_THICKNESS = 0.11
const BULB_RADIUS = 0.14
/** Alto de la góndola de una cabina. */
const CABIN_HEIGHT = 0.6

/** Alto del pie, del suelo al eje. */
const LEG_HEIGHT = WHEEL_CENTER[1]
/** Cuánto se abre cada pie hacia delante y hacia atrás. */
const LEG_SPREAD = 3.2

/**
 * Cabina colgada del aro: la horquilla y la góndola, las dos por debajo del
 * punto del que cuelgan. El grupo que las contiene deshace el giro de la rueda,
 * así que caen a plomo den la vuelta que den.
 */
function Cabin({ color }: { color: string }) {
  const hangerLength = WHEEL_CABIN_DROP - CABIN_HEIGHT / 2

  return (
    <>
      <Pole
        position={[0, -hangerLength / 2, 0]}
        scale={[0.08, hangerLength, 0.08]}
        color={MACHINE_TRUSS_COLOR}
      />
      <Board
        position={[0, -WHEEL_CABIN_DROP, 0]}
        scale={[0.78, CABIN_HEIGHT, 0.95]}
        color={color}
      />
    </>
  )
}

export function FerrisWheel({ spinning }: { spinning: boolean }) {
  const wheelRef = useRef<Group>(null)
  const cabinRefs = useRef<Group[]>([])
  const angle = useRef(0)

  // Un radio y una cabina por hueco, repartidos por toda la vuelta.
  const spokes = useMemo(
    () =>
      Array.from({ length: WHEEL_CABIN_COUNT }, (_, index) => {
        const spokeAngle = (index / WHEEL_CABIN_COUNT) * Math.PI * 2
        return {
          angle: spokeAngle,
          direction: [Math.cos(spokeAngle), Math.sin(spokeAngle)] as const,
          color: MACHINE_STRIPE_COLORS[index % MACHINE_STRIPE_COLORS.length],
        }
      }),
    [],
  )

  useFrame((_, delta) => {
    if (!spinning || wheelRef.current == null) return
    angle.current += delta * WHEEL_SPEED
    wheelRef.current.rotation.z = angle.current
    // Las cabinas van montadas en la rueda, así que girarían con ella y
    // acabarían boca abajo: cada una deshace el giro y se queda a plomo.
    for (const cabin of cabinRefs.current) cabin.rotation.z = -angle.current
  })

  const legRotationX = (side: number) =>
    Math.atan2(side * LEG_SPREAD, -LEG_HEIGHT)

  return (
    <group position={WHEEL_CENTER} rotation={[0, facingRotationY(WHEEL_CENTER), 0]}>
      {/* Pies abiertos hacia delante y hacia atrás, fuera del plano de la rueda */}
      {[-1, 1].map((side) => (
        <Pole
          key={`leg-${side}`}
          position={[0, -LEG_HEIGHT / 2, (side * LEG_SPREAD) / 2]}
          rotation={[legRotationX(side), 0, 0]}
          scale={[0.4, Math.hypot(LEG_HEIGHT, LEG_SPREAD), 0.4]}
          color={MACHINE_TRUSS_COLOR}
        />
      ))}
      <Pole
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.42, RIM_GAP + 0.6, 0.42]}
        color={MACHINE_TRUSS_COLOR}
      />

      <group ref={wheelRef}>
        {[-1, 1].map((side) => (
          <mesh key={`rim-${side}`} position={[0, 0, (side * RIM_GAP) / 2]}>
            <torusGeometry args={[WHEEL_RADIUS, RIM_TUBE, 6, 48]} />
            <meshStandardMaterial
              color={MACHINE_TRUSS_COLOR}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
        ))}

        {spokes.map((spoke, index) => (
          <group key={`spoke-${index}`}>
            {/* El radio nace vertical: se gira hasta apuntar a su hueco del aro. */}
            <Pole
              position={[
                (spoke.direction[0] * WHEEL_RADIUS) / 2,
                (spoke.direction[1] * WHEEL_RADIUS) / 2,
                0,
              ]}
              rotation={[0, 0, spoke.angle - Math.PI / 2]}
              scale={[SPOKE_THICKNESS, WHEEL_RADIUS, SPOKE_THICKNESS]}
              color={MACHINE_TRUSS_COLOR}
            />
            {/* Una bombilla en cada aro, para que el contorno se vea de noche */}
            {[-1, 1].map((side) => (
              <Bulb
                key={`rim-bulb-${side}`}
                position={[
                  spoke.direction[0] * WHEEL_RADIUS,
                  spoke.direction[1] * WHEEL_RADIUS,
                  (side * RIM_GAP) / 2,
                ]}
                scale={BULB_RADIUS}
              />
            ))}
            <group
              ref={(node) => {
                if (node) cabinRefs.current[index] = node
              }}
              position={[
                spoke.direction[0] * WHEEL_RADIUS,
                spoke.direction[1] * WHEEL_RADIUS,
                0,
              ]}
            >
              <Cabin color={spoke.color} />
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}
