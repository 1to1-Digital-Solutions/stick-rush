'use client'

import { useRef, type ComponentProps, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { createInstances } from '@react-three/drei'
import { Color, type MeshStandardMaterial } from 'three'
import { bulbGlow, bulbPulse } from '../../lib/fairMood'
import { MACHINE_BULB_COLOR, PARTY_BULB_COLOR } from '../../lib/gameConfig'
import type { FairMoodState } from './FairMood'
import { useReducedMotion } from './useReducedMotion'

/**
 * Las tres piezas en código del recinto de feria: tablas (cajas), postes
 * (cilindros) y bombillas (esferas). Con ellas se hacen la noria y las
 * bombillas de las guirnaldas; los puestos y las farolas son piezas del kit de
 * xrcade (`FeriaKit`).
 *
 * Van instanciadas porque son más de cien trozos y en el visor lo que se paga
 * no es el número de triángulos sino el de llamadas de dibujo: así la noria y
 * las guirnaldas caben en tres. Cada pieza se
 * coloca con su `position`/`rotation`/`scale` normales dentro de los grupos que
 * la contienen, y el color va por instancia.
 *
 * Las geometrías son unitarias (caja de 1 m, cilindro de 1 m de alto y de
 * diámetro, esfera de radio 1), de modo que la escala de cada pieza son
 * directamente sus medidas en metros.
 */

const [BoardInstances, BoardInstance] = createInstances()
const [PoleInstances, PoleInstance] = createInstances()
const [BulbInstances, BulbInstance] = createInstances()

/**
 * Cuántas piezas de cada familia gasta un trozo del recinto.
 *
 * Cada `<Instances>` se dimensiona de antemano y, si las piezas superan su
 * límite, drei deja de pintar las que sobran **sin avisar**. Por eso el tamaño
 * no es un número escrito a mano —que se quedaría viejo al añadir una cabina o
 * un tramo de guirnalda— sino la suma de lo que declara cada trozo: ver `FAIR_PIECES` en
 * `Fairground`.
 */
export interface PieceCounts {
  boards: number
  poles: number
  bulbs: number
}

/**
 * El decorado no se toca ni se apunta: sin esto, cada movimiento del ratón —y
 * cada fotograma con los mandos del visor apuntando— lanzaría un rayo contra
 * las más de cien piezas del recinto para nada.
 *
 * Se exporta porque no todo el decorado son instancias: los aros de la noria
 * son mallas sueltas y tienen que anularlo igual (y son las piezas con más
 * triángulos de todo el recinto).
 */
export const ignoreRaycast = () => null

type PieceProps = ComponentProps<typeof BoardInstance>

/** Tabla, panel o cajón: cualquier pieza recta del recinto. */
export function Board(props: PieceProps) {
  return <BoardInstance raycast={ignoreRaycast} {...props} />
}

/** Poste, montante o radio: cualquier pieza cilíndrica. */
export function Pole(props: PieceProps) {
  return <PoleInstance raycast={ignoreRaycast} {...props} />
}

/** Bombilla de feria: no ilumina, se ve encendida. */
export function Bulb(props: PieceProps) {
  return <BulbInstance raycast={ignoreRaycast} {...props} />
}

/** Los dos colores entre los que se mueve la bombilla; se reservan una vez. */
const BULB_COLOR = new Color(MACHINE_BULB_COLOR)
const PARTY_COLOR = new Color(PARTY_BULB_COLOR)
/** Lo que tarda el brillo en llegar a su nuevo valor: fracción por segundo. */
const GLOW_EASE = 3

/**
 * Las bombillas responden a la racha (`lib/fairMood.ts`): suben de brillo con
 * ella y, con fiesta, palpitan hacia el blanco. Se toca el material de la
 * familia entera —todas las bombillas de la feria son un solo material—, así
 * que cuesta lo mismo con cien que con mil. Con el movimiento reducido el
 * palpitar se apaga; el brillo sigue subiendo, que eso no se mueve.
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
 * Proveedor de las tres familias de piezas. Van anidadas porque cada
 * `createInstances` reparte su contexto a los descendientes; el orden entre
 * ellas da igual, lo que importa es que el decorado quede dentro de las tres.
 *
 * `limits` es el recuento exacto de piezas que va a colgar de aquí: reservar de
 * menos las pierde en silencio y reservar de más deja búferes sin usar.
 *
 * `frustumCulled={false}`: el mesh instanciado vive en el origen y su volumen
 * envolvente no sigue a las instancias, así que dejar que el motor decida si se
 * ve haría desaparecer el recinto entero al mirar hacia otro lado.
 */
export function FairPieces({
  limits,
  moodRef,
  children,
}: {
  limits: PieceCounts
  /** La racha, para que las bombillas respondan a ella (ver `FairMood`). */
  moodRef: RefObject<FairMoodState>
  children: ReactNode
}) {
  const bulbMaterial = useRef<MeshStandardMaterial>(null)

  return (
    <BoardInstances limit={limits.boards} frustumCulled={false}>
      <boxGeometry />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />

      <PoleInstances limit={limits.poles} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
        <meshStandardMaterial roughness={0.6} metalness={0.25} />

        <BulbInstances limit={limits.bulbs} frustumCulled={false}>
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
