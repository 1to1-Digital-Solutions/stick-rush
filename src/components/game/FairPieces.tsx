'use client'

import { useRef, type ComponentProps, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { createInstances } from '@react-three/drei'
import { Color, type MeshStandardMaterial } from 'three'
import { bulbGlow, bulbPulse } from '../../lib/fairMood'
import { MACHINE_BULB_COLOR, PARTY_BULB_COLOR } from '../../lib/gameConfig'
import type { FairMoodState } from './FairMood'
import { useDisposeInstances } from './disposeInstances'
import { useReducedMotion } from './useReducedMotion'

/**
 * The three in-code pieces of the fairground venue: boards (boxes), poles
 * (cylinders) and bulbs (spheres). With them the Ferris wheel and the
 * bulbs of the garlands are made; the stalls and the lampposts are pieces of the
 * xrcade kit (`FairKit`).
 *
 * They are instanced because they are more than a hundred bits and in the headset what is paid
 * is not the number of triangles but the number of draw calls: this way the Ferris wheel and
 * the garlands fit in three. Each piece is
 * placed with its normal `position`/`rotation`/`scale` inside the groups that
 * contain it, and the colour goes per instance.
 *
 * The geometries are unit ones (a 1 m box, a cylinder 1 m tall and 1 m in
 * diameter, a sphere of radius 1), so that the scale of each piece is
 * directly its measurements in metres.
 */

const [BoardInstances, BoardInstance] = createInstances()
const [PoleInstances, PoleInstance] = createInstances()
const [BulbInstances, BulbInstance] = createInstances()

/**
 * How many pieces of each family a bit of the venue spends.
 *
 * Each `<Instances>` is sized beforehand and, if the pieces exceed its
 * limit, drei stops painting the ones left over **without warning**. That is why the size
 * is not a number written by hand —which would go stale on adding a cabin or
 * a stretch of garland— but the sum of what each bit declares: see `FAIR_PIECES` in
 * `Fairground`.
 */
export interface PieceCounts {
  boards: number
  poles: number
  bulbs: number
}

/**
 * The decor is neither touched nor pointed at: without this, every movement of the mouse —and
 * every frame with the headset's controllers pointing— would cast a ray against
 * the more than a hundred pieces of the venue for nothing.
 *
 * It is exported because not all the decor is instances: the rings of the Ferris wheel
 * are loose meshes and have to cancel it just the same (and they are the pieces with the most
 * triangles of the whole venue).
 */
export const ignoreRaycast = () => null

type PieceProps = ComponentProps<typeof BoardInstance>

/** Board, panel or crate: any straight piece of the venue. */
export function Board(props: PieceProps) {
  return <BoardInstance raycast={ignoreRaycast} {...props} />
}

/** Pole, upright or spoke: any cylindrical piece. */
export function Pole(props: PieceProps) {
  return <PoleInstance raycast={ignoreRaycast} {...props} />
}

/** Fairground bulb: it does not light, it looks lit. */
export function Bulb(props: PieceProps) {
  return <BulbInstance raycast={ignoreRaycast} {...props} />
}

/** The two colours the bulb moves between; they are allocated once. */
const BULB_COLOR = new Color(MACHINE_BULB_COLOR)
const PARTY_COLOR = new Color(PARTY_BULB_COLOR)
/** How long the glow takes to reach its new value: fraction per second. */
const GLOW_EASE = 3

/**
 * The bulbs respond to the streak (`lib/fairMood.ts`): they get brighter with
 * it and, with a party on, they throb towards white. The material of the whole
 * family is touched —all the bulbs of the fairground are a single material—, so
 * it costs the same with a hundred as with a thousand. With reduced motion the
 * throbbing goes off; the glow keeps rising, since that does not move.
 */
function BulbMood({
  moodRef,
  materialRef,
}: {
  moodRef: RefObject<FairMoodState>
  materialRef: RefObject<MeshStandardMaterial | null>
}) {
  const reducedMotion = useReducedMotion()

  useFrame(({ clock }, delta) => {
    const material = materialRef.current
    if (material == null) return
    const { streak } = moodRef.current
    const target = bulbGlow(streak)
    material.emissiveIntensity += (target - material.emissiveIntensity) * Math.min(1, delta * GLOW_EASE)
    const pulse = reducedMotion ? 0 : bulbPulse(streak, clock.elapsedTime)
    material.emissive.lerpColors(BULB_COLOR, PARTY_COLOR, pulse)
  })

  return null
}

/**
 * Provider of the three families of pieces. They are nested because each
 * `createInstances` hands its context to the descendants; the order between
 * them does not matter, what matters is that the decor ends up inside all three.
 *
 * `limits` is the exact count of pieces that will hang from here: allocating too
 * few loses them silently and allocating too many leaves buffers unused.
 *
 * `frustumCulled={false}`: the instanced mesh lives at the origin and its bounding
 * volume does not follow the instances, so letting the engine decide whether it is
 * seen would make the whole venue disappear on looking another way.
 */
export function FairPieces({
  limits,
  moodRef,
  children,
}: {
  limits: PieceCounts
  /** The streak, so that the bulbs respond to it (see `FairMood`). */
  moodRef: RefObject<FairMoodState>
  children: ReactNode
}) {
  const bulbMaterial = useRef<MeshStandardMaterial>(null)
  // Their matrices and colours are disposed of by hand on leaving (`disposeInstances.ts`).
  const boards = useDisposeInstances()
  const poles = useDisposeInstances()
  const bulbs = useDisposeInstances()

  return (
    <BoardInstances ref={boards} limit={limits.boards} frustumCulled={false}>
      <boxGeometry />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />

      <PoleInstances ref={poles} limit={limits.poles} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
        <meshStandardMaterial roughness={0.6} metalness={0.25} />

        <BulbInstances ref={bulbs} limit={limits.bulbs} frustumCulled={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            ref={bulbMaterial}
            color={MACHINE_BULB_COLOR}
            emissive={MACHINE_BULB_COLOR}
            emissiveIntensity={bulbGlow(0)}
            toneMapped={false}
          />
          <BulbMood moodRef={moodRef} materialRef={bulbMaterial} />
          {children}
        </BulbInstances>
      </PoleInstances>
    </BoardInstances>
  )
}
