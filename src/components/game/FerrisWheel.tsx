'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import {
  GROUND_Y,
  MACHINE_STRIPE_COLORS,
  MACHINE_TRUSS_COLOR,
} from '../../lib/gameConfig'
import {
  WHEEL_CABIN_COUNT,
  WHEEL_CABIN_DROP,
  WHEEL_CABIN_HEIGHT,
  WHEEL_CENTER,
  WHEEL_RADIUS,
  WHEEL_SPEED,
  facingRotationY,
} from '../../lib/sceneryLayout'
import {
  Board,
  Bulb,
  Pole,
  ignoreRaycast,
  type PieceCounts,
} from './FairPieces'

/**
 * Ferris wheel at the back of the venue.
 *
 * It is what gives depth to the scenery: something big, far away and moving
 * that the HDRI cannot provide, because a background photo does not change on moving the
 * head. It turns slowly —one long turn— so that it is noticed to be alive without
 * drawing attention while the sticks fall.
 *
 * The wheel turns in its local XY plane and the whole faces the player, so
 * it is seen from the front and not edge-on.
 */

/** Gap between the two rings of the wheel. */
const RIM_GAP = 1.3
/**
 * Thickness of the ring, of the spokes and of the bulbs. They are generous on purpose:
 * at twelve metres, a wheel of thin tubes falls apart into a tangle of lines
 * that is barely told apart from the building behind it.
 */
const RIM_TUBE = 0.12
const SPOKE_THICKNESS = 0.11
const BULB_RADIUS = 0.14

/** Height of the leg, from the ground to the axle. */
const LEG_HEIGHT = WHEEL_CENTER[1] - GROUND_Y
/** How much each leg opens forwards and backwards. */
const LEG_SPREAD = 3.2

/**
 * What the Ferris wheel spends of the instance budget (see `PieceCounts`). The
 * three fixed poles are the two legs and the axle; per cabin there go a spoke and the
 * hanger it hangs from, the gondola, and a bulb on each ring. The rings
 * do not count: they are loose meshes, not instances.
 */
export const WHEEL_PIECES: PieceCounts = {
  boards: WHEEL_CABIN_COUNT,
  poles: 3 + WHEEL_CABIN_COUNT * 2,
  bulbs: WHEEL_CABIN_COUNT * 2,
}

/**
 * Cabin hung from the ring: the hanger and the gondola, both below the
 * point they hang from. The group that contains them undoes the turn of the wheel,
 * so they hang plumb however far round they go.
 */
function Cabin({ color }: { color: string }) {
  const hangerLength = WHEEL_CABIN_DROP - WHEEL_CABIN_HEIGHT / 2

  return (
    <>
      <Pole
        position={[0, -hangerLength / 2, 0]}
        scale={[0.08, hangerLength, 0.08]}
        color={MACHINE_TRUSS_COLOR}
      />
      <Board
        position={[0, -WHEEL_CABIN_DROP, 0]}
        scale={[0.78, WHEEL_CABIN_HEIGHT, 0.95]}
        color={color}
      />
    </>
  )
}

export function FerrisWheel({ spinning }: { spinning: boolean }) {
  const wheelRef = useRef<Group>(null)
  const cabinRefs = useRef<Group[]>([])
  const angle = useRef(0)

  // One spoke and one cabin per slot, spread over the whole turn.
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
    // The cabins are mounted on the wheel, so they would turn with it and
    // end up upside down: each one undoes the turn and stays plumb.
    for (const cabin of cabinRefs.current) cabin.rotation.z = -angle.current
  })

  const legRotationX = (side: number) =>
    Math.atan2(side * LEG_SPREAD, -LEG_HEIGHT)

  return (
    <group position={WHEEL_CENTER} rotation={[0, facingRotationY(WHEEL_CENTER), 0]}>
      {/* Legs open forwards and backwards, out of the plane of the wheel */}
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
          <mesh
            key={`rim-${side}`}
            position={[0, 0, (side * RIM_GAP) / 2]}
            raycast={ignoreRaycast}
          >
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
            {/* The spoke is born vertical: it is turned until it points at its slot of the ring. */}
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
            {/* A bulb on each ring, so that the outline is seen at night */}
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
