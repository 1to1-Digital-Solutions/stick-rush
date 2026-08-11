'use client'

import { useMemo } from 'react'
import { MACHINE_TRUSS_COLOR } from '@/lib/gameConfig'
import {
  GARLAND_BULBS_PER_SPAN,
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  STALL_COUNT,
  STALL_RING_RADIUS,
  garlandBulbs,
  ringSlots,
  type RingSlot,
  type Vec3,
} from '@/lib/sceneryLayout'
import { Bulb, FairPieces, Pole, type PieceCounts } from './FairPieces'
import { FairStall, STALL_PIECES } from './FairStall'
import { FerrisWheel, WHEEL_PIECES } from './FerrisWheel'
import { useReducedMotion } from './useReducedMotion'

/**
 * El recinto de feria en el que está montada la máquina: casetas alrededor,
 * guirnaldas de bombillas cerrando el círculo por arriba y una noria al fondo.
 *
 * Solo se pinta con el escenario puesto. En passthrough el decorado es la
 * habitación del jugador, y esto la taparía (ver `SceneBackdrop`).
 */

const GARLAND_BULB_RADIUS = 0.055
const GARLAND_POST_THICKNESS = 0.12

/**
 * Lo que gastan las guirnaldas del presupuesto de instancias: cada poste, con
 * su base, y el tramo de bombillas que sale de él hacia el siguiente.
 */
const GARLAND_PIECES: PieceCounts = {
  boards: 0,
  poles: GARLAND_POST_COUNT * 2,
  bulbs: GARLAND_POST_COUNT * GARLAND_BULBS_PER_SPAN,
}

/**
 * Sitio a reservar en las tres familias de piezas (ver `PieceCounts`). Sale de
 * lo que declara cada trozo del recinto, y no de un recuento a mano, para que
 * añadir una caseta o un premio no haga desaparecer piezas en silencio.
 */
const FAIR_PIECES: PieceCounts = {
  boards:
    STALL_COUNT * STALL_PIECES.boards +
    GARLAND_PIECES.boards +
    WHEEL_PIECES.boards,
  poles:
    STALL_COUNT * STALL_PIECES.poles +
    GARLAND_PIECES.poles +
    WHEEL_PIECES.poles,
  bulbs:
    STALL_COUNT * STALL_PIECES.bulbs +
    GARLAND_PIECES.bulbs +
    WHEEL_PIECES.bulbs,
}

/** La punta del poste, de donde se tienden las guirnaldas. */
function postTop({ position }: RingSlot): Vec3 {
  return [position[0], GARLAND_POST_HEIGHT, position[2]]
}

/**
 * Postes con sus tramos de bombillas. Los postes van desfasados respecto a las
 * casetas para que no queden unos tapando a otras.
 */
function Garlands() {
  const { posts, bulbs } = useMemo(() => {
    const posts = ringSlots(
      GARLAND_POST_COUNT,
      GARLAND_RING_RADIUS,
      Math.PI / GARLAND_POST_COUNT,
    )
    const bulbs = posts.flatMap((post, index) =>
      garlandBulbs({
        from: postTop(post),
        to: postTop(posts[(index + 1) % posts.length]),
      }),
    )
    return { posts, bulbs }
  }, [])

  return (
    <group>
      {posts.map((post, index) => (
        <group key={`post-${index}`} position={post.position}>
          <Pole
            position={[0, GARLAND_POST_HEIGHT / 2, 0]}
            scale={[
              GARLAND_POST_THICKNESS,
              GARLAND_POST_HEIGHT,
              GARLAND_POST_THICKNESS,
            ]}
            color={MACHINE_TRUSS_COLOR}
          />
          <Pole
            position={[0, 0.06, 0]}
            scale={[0.34, 0.12, 0.34]}
            color={MACHINE_TRUSS_COLOR}
          />
        </group>
      ))}

      {bulbs.map((position, index) => (
        <Bulb
          key={`garland-bulb-${index}`}
          position={position}
          scale={GARLAND_BULB_RADIUS}
        />
      ))}
    </group>
  )
}

export function Fairground() {
  // La noria es lo único que se mueve aquí; con el movimiento reducido se queda
  // parada, como el vaivén de los palos.
  const reducedMotion = useReducedMotion()
  const stalls = useMemo(() => ringSlots(STALL_COUNT, STALL_RING_RADIUS), [])

  return (
    <FairPieces limits={FAIR_PIECES}>
      {stalls.map((slot, index) => (
        <FairStall key={`stall-${index}`} slot={slot} index={index} />
      ))}
      <Garlands />
      <FerrisWheel spinning={!reducedMotion} />
    </FairPieces>
  )
}
