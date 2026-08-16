'use client'

import { type ComponentProps, type ReactNode } from 'react'
import { createInstances } from '@react-three/drei'
import { MACHINE_BULB_COLOR } from '../../lib/gameConfig'

/**
 * Las tres piezas con las que está construido el recinto de feria: tablas
 * (cajas), postes (cilindros) y bombillas (esferas).
 *
 * Van instanciadas porque el decorado son cientos de trozos y en el visor lo
 * que se paga no es el número de triángulos sino el de llamadas de dibujo: así
 * todo el recinto —casetas, guirnaldas y noria— cabe en tres. Cada pieza se
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
 * no es un número escrito a mano —que se quedaría viejo al añadir una caseta o
 * un premio— sino la suma de lo que declara cada trozo: ver `FAIR_PIECES` en
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
 * las cientos de piezas del recinto para nada.
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
  children,
}: {
  limits: PieceCounts
  children: ReactNode
}) {
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
            color={MACHINE_BULB_COLOR}
            emissive={MACHINE_BULB_COLOR}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
          {children}
        </BulbInstances>
      </PoleInstances>
    </BoardInstances>
  )
}
