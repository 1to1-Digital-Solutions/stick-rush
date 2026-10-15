'use client'

import { type ComponentProps, type ReactNode } from 'react'
import { createInstances } from '@react-three/drei'
import { MACHINE_BULB_COLOR } from '../../lib/gameConfig'
import { useDisposeInstances } from './disposeInstances'

/**
 * The repeated parts of the machine, instanced.
 *
 * The machine took 85 of the scene's 110 draw calls: 69 loose tubes and 16
 * from the bulbs of its garland. In the headset that is paid PER EYE, so it was ~170 per
 * frame for something that fits in five. It is the same recipe the fairground already uses in
 * `FairPieces.tsx`, which draws its 285 pieces in three.
 *
 * **Why there are three families of tubes and not one.** They share geometry but not material, and an
 * `<Instances>` has a single material: the hoop of the sticks is matte (`metalness` 0.1) because
 * it is painted wood, the posts are polished metal (0.7) and the truss sits in between (0.6).
 * Unifying them would be cheaper and would change how the machine looks, which is exactly what this
 * optimisation cannot touch. Three calls instead of 69 is already 96%.
 *
 * The sticks and their hooks do NOT go in here: they are caught by hand, and an instance cannot be
 * pointed at nor moved on its own.
 */

const [MatteInstances, MatteInstance] = createInstances()
const [FrameInstances, FrameInstance] = createInstances()
const [TrussInstances, TrussInstance] = createInstances()
const [SocketInstances, SocketInstance] = createInstances()
const [GlassInstances, GlassInstance] = createInstances()

/** How many parts of each family are going to be hung. */
export interface MachinePieceCounts {
  /** Segments of the hoop of the sticks, matte. */
  matte: number
  /** Posts of the machine, polished metal. */
  frame: number
  /** Upper ring, truss and braces. */
  truss: number
  /** Bulbs of the garland: socket and glass, one of each. */
  bulbs: number
}

/**
 * The structure is neither touched nor pointed at. Without this, every mouse movement —and every
 * frame with the controllers pointing in the headset— would cast a ray against the 69 tubes for
 * nothing, right while the player is trying to hit a stick.
 */
const ignoreRaycast = () => null

type PieceProps = ComponentProps<typeof MatteInstance>

/** Segment of the hoop of the sticks: wood painted in stripes. */
export function MatteTube(props: PieceProps) {
  return <MatteInstance raycast={ignoreRaycast} {...props} />
}

/** Post of the machine: polished metal. */
export function FrameTube(props: PieceProps) {
  return <FrameInstance raycast={ignoreRaycast} {...props} />
}

/** Upper ring, uprights, diagonals and braces. */
export function TrussTube(props: PieceProps) {
  return <TrussInstance raycast={ignoreRaycast} {...props} />
}

/** Socket of a bulb of the garland. */
export function BulbSocket(props: PieceProps) {
  return <SocketInstance raycast={ignoreRaycast} {...props} />
}

/** Glass of a bulb: it does not light anything, it looks lit. */
export function BulbGlass(props: PieceProps) {
  return <GlassInstance raycast={ignoreRaycast} {...props} />
}

/**
 * Provider of the families. They are nested because each `createInstances` hands its context to
 * its descendants.
 *
 * `limit` is the exact count: if the parts exceed it, drei stops painting the surplus ones
 * **without warning**, and the machine would show up in bits depending on the height of the hoop. That is why it is computed
 * from what is going to be painted and not written by hand.
 *
 * `frustumCulled={false}`: the instanced mesh lives at the origin and its bounding volume does not
 * follow the instances, so letting the engine decide would make the whole machine disappear
 * when looking elsewhere — with the headset on, turning the head.
 *
 * The geometry of the tubes is unit-sized (1 m tall and 1 in diameter), so that the scale
 * of each one is its measurements in metres. The bulbs are not: they are all the same and their measurements
 * are baked in, because the socket is conical and that cannot be achieved by scaling.
 */
export function MachinePieces({
  limits,
  children,
}: {
  limits: MachinePieceCounts
  children: ReactNode
}) {
  // Their matrices and colours are disposed by hand on the way out (`disposeInstances.ts`).
  const matte = useDisposeInstances()
  const frame = useDisposeInstances()
  const truss = useDisposeInstances()
  const socket = useDisposeInstances()
  const glass = useDisposeInstances()

  return (
    <MatteInstances ref={matte} limit={limits.matte} frustumCulled={false}>
      <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
      <meshStandardMaterial metalness={0.1} roughness={0.55} />

      <FrameInstances ref={frame} limit={limits.frame} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
        <meshStandardMaterial metalness={0.7} roughness={0.35} />

        <TrussInstances ref={truss} limit={limits.truss} frustumCulled={false}>
          <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
          <meshStandardMaterial metalness={0.6} roughness={0.4} />

          {/* The bulbs are all the same, so their measurements go in the geometry and the
              instances do not scale: the socket is a CONICAL cylinder and a scaling cannot
              reproduce that taper, only stretch it. */}
          <SocketInstances ref={socket} limit={limits.bulbs} frustumCulled={false}>
            <cylinderGeometry args={[0.012, 0.015, 0.038, 8]} />
            <meshStandardMaterial color="#3b3630" metalness={0.5} roughness={0.6} />

            <GlassInstances ref={glass} limit={limits.bulbs} frustumCulled={false}>
              <sphereGeometry args={[0.024, 14, 14]} />
              <meshStandardMaterial
                color={MACHINE_BULB_COLOR}
                emissive={MACHINE_BULB_COLOR}
                emissiveIntensity={1.8}
                toneMapped={false}
              />
              {children}
            </GlassInstances>
          </SocketInstances>
        </TrussInstances>
      </FrameInstances>
    </MatteInstances>
  )
}
