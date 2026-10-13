'use client'

import { Suspense, useMemo, useRef } from 'react'
import {
  GARLAND_BULBS_PER_SPAN,
  GARLAND_POST_COUNT,
  GARLAND_POST_HEIGHT,
  GARLAND_RING_RADIUS,
  garlandBulbs,
  ringSlots,
  type RingSlot,
  type Vec3,
} from '../../lib/sceneryLayout'
import { Crowd } from './Crowd'
import { FairMood, type FairMoodState } from './FairMood'
import { Bulb, FairPieces, type PieceCounts } from './FairPieces'
import { FeriaKit } from './FairKit'
import { FerrisWheel, WHEEL_PIECES } from './FerrisWheel'
import { useReducedMotion } from './useReducedMotion'

/**
 * El recinto de feria en el que está montada la máquina: puestos alrededor,
 * guirnaldas de bombillas tendidas entre farolas cerrando el círculo por
 * arriba, público entre los puestos y una noria al fondo. Los puestos, las
 * farolas y sus banderolas son piezas del kit de xrcade (`FeriaKit`); las
 * bombillas, la noria y el público se hacen en código. Las bombillas y el público responden a la racha
 * (`lib/fairMood.ts`), que les llega por un ref y no por props: el recinto no
 * se vuelve a renderizar por nada que pase en la partida.
 *
 * Solo se pinta con el escenario puesto. En passthrough el decorado es la
 * habitación del jugador, y esto la taparía (ver `SceneBackdrop`).
 */

const GARLAND_BULB_RADIUS = 0.055

/**
 * Lo que gastan las guirnaldas del presupuesto de instancias: el tramo de
 * bombillas que sale de cada farola hacia la siguiente. Las farolas no gastan
 * nada de aquí: son piezas del kit, con su propio `InstancedMesh`.
 */
const GARLAND_PIECES: PieceCounts = {
  boards: 0,
  poles: 0,
  bulbs: GARLAND_POST_COUNT * GARLAND_BULBS_PER_SPAN,
}

/**
 * Sitio a reservar en las tres familias de piezas (ver `PieceCounts`). Sale de
 * lo que declara cada trozo del recinto, y no de un recuento a mano, para que
 * añadir una cabina o un tramo no haga desaparecer piezas en silencio.
 */
const FAIR_PIECES: PieceCounts = {
  boards: GARLAND_PIECES.boards + WHEEL_PIECES.boards,
  poles: GARLAND_PIECES.poles + WHEEL_PIECES.poles,
  bulbs: GARLAND_PIECES.bulbs + WHEEL_PIECES.bulbs,
}

/** La punta de la farola, de donde se tienden las guirnaldas. */
function postTop({ position }: RingSlot): Vec3 {
  return [position[0], GARLAND_POST_HEIGHT, position[2]]
}

/**
 * Los tramos de bombillas entre farola y farola. Las farolas las pinta
 * `FeriaKit` en los mismos sitios (`lib/fairKit.ts`), desfasadas respecto a
 * los puestos para que no queden unas tapando a otros.
 */
function Garlands() {
  const bulbs = useMemo(() => {
    const posts = ringSlots(
      GARLAND_POST_COUNT,
      GARLAND_RING_RADIUS,
      Math.PI / GARLAND_POST_COUNT,
    )
    return posts.flatMap((post, index) =>
      garlandBulbs({
        from: postTop(post),
        to: postTop(posts[(index + 1) % posts.length]),
      }),
    )
  }, [])

  return (
    <group>
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
  const mood = useRef<FairMoodState>({ streak: 0 })

  return (
    <FairPieces limits={FAIR_PIECES} moodRef={mood}>
      <FairMood moodRef={mood} />
      {/* Suspense propio: mientras bajan los modelos, el resto del recinto
          ya se ve. */}
      <Suspense fallback={null}>
        <FeriaKit />
      </Suspense>
      <Garlands />
      <Crowd moodRef={mood} />
      <FerrisWheel spinning={!reducedMotion} />
    </FairPieces>
  )
}
