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
import { useReducedMotion } from './useReducedMotion'

/**
 * El público de la feria: siluetas alrededor del recinto mirando a la máquina.
 *
 * Una silueta es un cuerpo (cápsula) con una cabeza (esfera), fundidos en una
 * sola geometría para que todo el público sea UNA familia instanciada y por
 * tanto una llamada de dibujo (ver `FairPieces` para el porqué). No tienen
 * cara ni brazos a propósito: a seis metros, con las luces de feria detrás, lo
 * que se lee es la forma, y una silueta lisa envejece mejor que un muñeco.
 *
 * Se mecen —más alto y más deprisa cuanto mayor es la racha (`lib/fairMood.ts`)—
 * moviendo las instancias desde `useFrame`, sin pasar por React. Con
 * `prefers-reduced-motion` se quedan quietas.
 */

const [FigureInstances, FigureInstance] = createInstances()

/** La silueta base, de 1,7 m: la estatura de cada figura es su escala en Y. */
function silhouette(): BufferGeometry {
  const body = new CapsuleGeometry(0.2, 1.05, 3, 8).translate(0, 0.725, 0)
  const head = new SphereGeometry(0.13, 8, 6).translate(0, 1.58, 0)
  const merged = mergeGeometries([body, head], false)
  body.dispose()
  head.dispose()
  if (merged == null) throw new Error('No se pudo fundir la silueta del público')
  return merged
}

/** Cuánto se ladea una figura en lo alto de su vaivén, en radianes por metro de salto. */
const SWAY_PER_METRE = 0.6

export function Crowd({ moodRef }: { moodRef: RefObject<FairMoodState> }) {
  const spots = useMemo(() => crowdSpots(), [])
  const geometry = useMemo(() => silhouette(), [])
  const figures = useRef<(Object3D | null)[]>([])
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
      // Solo hacia arriba: la gente salta, no se hunde en el suelo.
      figure.position.y = spot.position[1] + Math.max(0, wave) * bob
      figure.rotation.z = wave * bob * SWAY_PER_METRE
    }
  })

  return (
    <FigureInstances limit={spots.length} frustumCulled={false}>
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
