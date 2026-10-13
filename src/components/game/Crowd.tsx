'use client'

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { createInstances } from '@react-three/drei'
import { CapsuleGeometry, SphereGeometry, type BufferGeometry, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { crowdSpots } from '../../lib/crowdLayout'
import { crowdBob, crowdTempo } from '../../lib/fairMood'
import { CROWD_SHADES } from '../../lib/gameConfig'
import { ignoreRaycast } from './FairPieces'
import type { FairMoodState } from './FairMood'
import { useDisposeInstances } from './disposeInstances'
import { useReducedMotion } from './useReducedMotion'

/**
 * The crowd of the fairground: silhouettes around the venue looking at the machine.
 *
 * A silhouette is a body (capsule) with a head (sphere), merged into a
 * single geometry so that the whole crowd is ONE instanced family and
 * therefore one draw call (see `FairPieces` for the why). They have no
 * face and no arms on purpose: at six metres, with the fairground lights behind, what
 * is read is the shape, and a plain silhouette ages better than a doll.
 *
 * They sway —higher and faster the longer the streak (`lib/fairMood.ts`)—
 * by moving the instances from `useFrame`, without going through React. With
 * `prefers-reduced-motion` they stay still.
 */

const [FigureInstances, FigureInstance] = createInstances()

/** The base silhouette, 1.7 m tall: the height of each figure is its scale in Y. */
function silhouette(): BufferGeometry {
  const body = new CapsuleGeometry(0.2, 1.05, 3, 8).translate(0, 0.725, 0)
  const head = new SphereGeometry(0.13, 8, 6).translate(0, 1.58, 0)
  const merged = mergeGeometries([body, head], false)
  body.dispose()
  head.dispose()
  if (merged == null) throw new Error('The crowd silhouette could not be merged')
  return merged
}

/** How much a figure leans at the top of its sway, in radians per metre of jump. */
const SWAY_PER_METRE = 0.6

export function Crowd({ moodRef }: { moodRef: RefObject<FairMoodState> }) {
  const spots = useMemo(() => crowdSpots(), [])
  const geometry = useMemo(() => silhouette(), [])
  const figures = useRef<(Object3D | null)[]>([])
  // Its matrices and colours are disposed of by hand on leaving (`disposeInstances.ts`).
  const instances = useDisposeInstances()
  const reducedMotion = useReducedMotion()

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }) => {
    if (reducedMotion) return
    const { streak } = moodRef.current
    const bob = crowdBob(streak)
    const tempo = crowdTempo(streak)
    const time = clock.elapsedTime

    for (let index = 0; index < spots.length; index++) {
      const figure = figures.current[index]
      if (figure == null) continue
      const spot = spots[index]
      const wave = Math.sin(time * tempo * Math.PI * 2 + spot.phase)
      // Only upwards: people jump, they do not sink into the ground.
      figure.position.y = spot.position[1] + Math.max(0, wave) * bob
      figure.rotation.z = wave * bob * SWAY_PER_METRE
    }
  })

  return (
    <FigureInstances ref={instances} limit={spots.length} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial roughness={0.9} metalness={0} />
      {spots.map((spot, index) => (
        <FigureInstance
          key={`figure-${index}`}
          ref={(node: Object3D | null) => {
            figures.current[index] = node
          }}
          raycast={ignoreRaycast}
          position={spot.position}
          rotation={[0, spot.rotationY, 0]}
          scale={[1, spot.height, 1]}
          color={CROWD_SHADES[spot.shade % CROWD_SHADES.length]}
        />
      ))}
    </FigureInstances>
  )
}
