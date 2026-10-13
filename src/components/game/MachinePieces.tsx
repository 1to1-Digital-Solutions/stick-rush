'use client'

import { type ComponentProps, type ReactNode } from 'react'
import { createInstances } from '@react-three/drei'
import { MACHINE_BULB_COLOR } from '../../lib/gameConfig'
import { useSoltarInstancias } from './disposeInstances'

/**
 * Las piezas repetidas de la máquina, instanciadas.
 *
 * La máquina se llevaba 85 de las 110 llamadas de dibujo de la escena: 69 tubos sueltos y 16
 * de las bombillas de su guirnalda. En el visor eso se paga POR OJO, así que eran ~170 por
 * fotograma para algo que cabe en cinco. Es la misma receta que ya usa el recinto de feria en
 * `FairPieces.tsx`, que dibuja sus 285 piezas en tres.
 *
 * **Por qué hay tres familias de tubos y no una.** Comparten geometría pero no material, y un
 * `<Instances>` tiene un solo material: el aro de los palos es mate (`metalness` 0.1) porque
 * es madera pintada, los postes son metal pulido (0.7) y la celosía queda en medio (0.6).
 * Unificarlos sería más barato y cambiaría cómo se ve la máquina, que es justo lo que esta
 * optimización no puede tocar. Tres llamadas en vez de 69 ya es el 96%.
 *
 * Los palos y sus ganchos NO entran aquí: se cogen con la mano, y una instancia no se puede
 * apuntar ni mover por su cuenta.
 */

const [MatteInstances, MatteInstance] = createInstances()
const [FrameInstances, FrameInstance] = createInstances()
const [TrussInstances, TrussInstance] = createInstances()
const [SocketInstances, SocketInstance] = createInstances()
const [GlassInstances, GlassInstance] = createInstances()

/** Cuántas piezas de cada familia se van a colgar. */
export interface MachinePieceCounts {
  /** Tramos del aro de los palos, mates. */
  matte: number
  /** Postes de la máquina, metal pulido. */
  frame: number
  /** Aro superior, celosía y riostras. */
  truss: number
  /** Bombillas de la guirnalda: casquillo y cristal, una de cada. */
  bulbs: number
}

/**
 * La estructura no se toca ni se apunta. Sin esto, cada movimiento del ratón —y cada
 * fotograma con los mandos apuntando en el visor— lanzaría un rayo contra los 69 tubos para
 * nada, justo mientras el jugador intenta acertar a un palo.
 */
const ignoreRaycast = () => null

type PieceProps = ComponentProps<typeof MatteInstance>

/** Tramo del aro de los palos: madera pintada a rayas. */
export function MatteTube(props: PieceProps) {
  return <MatteInstance raycast={ignoreRaycast} {...props} />
}

/** Poste de la máquina: metal pulido. */
export function FrameTube(props: PieceProps) {
  return <FrameInstance raycast={ignoreRaycast} {...props} />
}

/** Aro superior, montantes, diagonales y riostras. */
export function TrussTube(props: PieceProps) {
  return <TrussInstance raycast={ignoreRaycast} {...props} />
}

/** Casquillo de una bombilla de la guirnalda. */
export function BulbSocket(props: PieceProps) {
  return <SocketInstance raycast={ignoreRaycast} {...props} />
}

/** Cristal de una bombilla: no ilumina, se ve encendido. */
export function BulbGlass(props: PieceProps) {
  return <GlassInstance raycast={ignoreRaycast} {...props} />
}

/**
 * Proveedor de las familias. Van anidadas porque cada `createInstances` reparte su contexto a
 * los descendientes.
 *
 * `limit` es el recuento exacto: si las piezas lo superan, drei deja de pintar las que sobran
 * **sin avisar**, y la máquina aparecería a trozos según la altura del aro. Por eso se calcula
 * de lo que se va a pintar y no se escribe a mano.
 *
 * `frustumCulled={false}`: el mesh instanciado vive en el origen y su volumen envolvente no
 * sigue a las instancias, así que dejar decidir al motor haría desaparecer la máquina entera
 * al mirar hacia otro lado — con el visor puesto, girar la cabeza.
 *
 * La geometría de los tubos es unitaria (1 m de alto y 1 de diámetro), de modo que la escala
 * de cada uno son sus medidas en metros. Las bombillas no: son todas iguales y sus medidas
 * van horneadas, porque el casquillo es cónico y eso no se consigue escalando.
 */
export function MachinePieces({
  limits,
  children,
}: {
  limits: MachinePieceCounts
  children: ReactNode
}) {
  // Sus matrices y colores se sueltan a mano al salir (`disposeInstances.ts`).
  const matte = useSoltarInstancias()
  const frame = useSoltarInstancias()
  const truss = useSoltarInstancias()
  const socket = useSoltarInstancias()
  const glass = useSoltarInstancias()

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

          {/* Las bombillas son todas iguales, así que sus medidas van en la geometría y las
              instancias no escalan: el casquillo es un cilindro CÓNICO y un escalado no puede
              reproducir esa conicidad, solo estirarlo. */}
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
