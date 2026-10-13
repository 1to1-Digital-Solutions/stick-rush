'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, type InstancedMesh } from 'three'

import {
  CERRADA,
  acercarPostura,
  angulosDelDedo,
  posturaDelGuante,
  type Lectura,
  type Postura,
} from '../../lib/glove'
import { DECOR_POINTER_EVENTS } from '../../lib/pointers'
import { HINT_COLOR } from './XRControllerModel'

/**
 * La mano del jugador, dibujada como un guante que agarra el mando y cierra el puño.
 *
 * Lo que decide cuánto se cierra cada dedo está en `lib/glove.ts`; aquí solo se dibuja.
 *
 * **Sin ficheros y en una sola llamada de dibujo.** El guante son cajas —palma, puño y tres
 * falanges por dedo—, todas instancias de la misma `InstancedMesh`: dieciséis piezas que el
 * visor pinta de una vez por ojo. Con mallas sueltas serían dieciséis llamadas por mano y por
 * ojo, y en el Quest eso se nota (`.claude/rules/xr.md`, «Lo que cuestan se mide»). El
 * esqueleto son `Object3D` sin dibujar: cada fotograma se doblan sus articulaciones y se copia
 * dónde queda cada pieza a su instancia.
 *
 * **Colocado sobre el mando dibujado** (`XRControllerModel`), en el mismo `grip-space`: el
 * mango baja por −Y con una leve inclinación, el gatillo de delante mira a −Z y el lateral
 * está en el costado de dentro (`side`). La palma va por fuera, los dedos rodean el mango por
 * delante y acaban sobre el gatillo lateral, que es el que cierran; el pulgar descansa arriba,
 * sobre la cabeza del mando.
 *
 * **La ayuda del agarre está en la mano.** Mientras hay que enseñar el gesto (`highlight`),
 * las yemas de los tres dedos que aprietan el gatillo lateral laten en ámbar —el mismo ámbar
 * que el botón y que los palos—; al cerrar el puño se ponen verdes, que confirma que el visor
 * está leyendo el gatillo.
 *
 * Para llevarlo a otro juego basta con recolocar `PALMA`, `NUDILLOS` y `PULGAR` sobre su mando.
 */

/** Blanco de guante de dibujos: se lee como una mano sin parecer la piel de nadie. */
const GUANTE = new Color('#e9eef5')
const AMBAR = new Color(HINT_COLOR)
const VERDE = new Color('#22c55e')

/** Ciclos por segundo del latido de las yemas, el mismo que el del botón del mando. */
const LATIDO_HZ = 1.6

/** Grosor y ancho de un dedo, en metros. */
const DEDO = { grueso: 0.015, ancho: 0.017 }

/**
 * Los cuatro dedos: a qué altura del mango nace cada uno y lo que miden sus tres falanges.
 * El índice arriba, sobre el gatillo de delante; el meñique abajo y más corto.
 */
const DEDOS = [
  { y: -0.012, falanges: [0.022, 0.017, 0.015], indice: true },
  { y: -0.032, falanges: [0.024, 0.018, 0.015], indice: false },
  { y: -0.052, falanges: [0.022, 0.017, 0.014], indice: false },
  { y: -0.071, falanges: [0.018, 0.014, 0.012], indice: false },
] as const

/** Dónde nacen los dedos: por fuera del mango y un poco por delante de su eje. */
const NUDILLOS = { x: 0.028, z: -0.012 }

/** La palma: una placa por fuera del mango, de lo alto de los dedos. */
const PALMA = { x: 0.036, y: -0.042, z: 0.008, medida: [0.018, 0.084, 0.056] as const }

/** El puño del guante, hacia la muñeca, que en el `grip-space` queda a +Z. */
const PUNO = { x: 0.03, y: -0.046, z: 0.052, medida: [0.036, 0.07, 0.03] as const }

/** El pulgar: nace arriba de la palma y cruza sobre la cabeza del mando. */
const PULGAR = { x: 0.028, y: 0.012, z: -0.002, falanges: [0.024, 0.02] as const }

/** Cuánto se dobla el pulgar con el puño cerrado, por articulación. */
const DOBLEZ_PULGAR = [0.5, 0.7] as const

/** La inclinación del mango del mando dibujado: los dedos lo siguen. */
const INCLINACION_DEL_MANGO = 0.22

type Esqueleto = {
  raiz: Object3D
  /** Las articulaciones de cada dedo, del nudillo a la punta. */
  dedos: Object3D[][]
  pulgar: Object3D[]
  /** Lo que se dibuja: cada una es una instancia. */
  piezas: Object3D[]
  /** Qué instancias son yemas que llevan la ayuda. */
  yemas: Set<number>
}

/** Una caja de esas medidas colgada de `padre`, que empieza en su origen y crece hacia −Z. */
function falange(padre: Object3D, largo: number, piezas: Object3D[]): Object3D {
  const pieza = new Object3D()
  pieza.position.z = -largo / 2
  pieza.scale.set(DEDO.ancho, DEDO.grueso, largo)
  padre.add(pieza)
  piezas.push(pieza)
  const siguiente = new Object3D()
  siguiente.position.z = -largo
  padre.add(siguiente)
  return siguiente
}

/**
 * Monta el esqueleto de la mano de un lado.
 *
 * @param fuera −1 o 1: hacia dónde queda el costado de fuera del mango, el de la palma. Es el
 *   contrario del gatillo lateral.
 */
function montarEsqueleto(fuera: number): Esqueleto {
  const raiz = new Object3D()
  const piezas: Object3D[] = []
  const yemas = new Set<number>()

  const caja = (x: number, y: number, z: number, medida: readonly [number, number, number]) => {
    const pieza = new Object3D()
    pieza.position.set(x, y, z)
    pieza.rotation.x = INCLINACION_DEL_MANGO
    pieza.scale.set(...medida)
    raiz.add(pieza)
    piezas.push(pieza)
  }
  caja(fuera * PALMA.x, PALMA.y, PALMA.z, PALMA.medida)
  caja(fuera * PUNO.x, PUNO.y, PUNO.z, PUNO.medida)

  const dedos = DEDOS.map(({ y, falanges, indice }) => {
    const nudillo = new Object3D()
    // El mango se inclina hacia delante al bajar, y los nudillos con él.
    nudillo.position.set(fuera * NUDILLOS.x, y, NUDILLOS.z + (y + 0.045) * INCLINACION_DEL_MANGO)
    raiz.add(nudillo)
    const articulaciones = [nudillo]
    let actual = nudillo
    falanges.forEach((largo, i) => {
      const siguiente = falange(actual, largo, piezas)
      if (i === falanges.length - 1 && !indice) yemas.add(piezas.length - 1)
      if (i < falanges.length - 1) articulaciones.push(siguiente)
      actual = siguiente
    })
    return articulaciones
  })

  const base = new Object3D()
  base.position.set(fuera * PULGAR.x, PULGAR.y, PULGAR.z)
  // Apunta hacia dentro, por encima de la cabeza del mando. En orden YXZ el doblez (X) se
  // aplica en el eje del propio pulgar y no en el de la mano.
  base.rotation.order = 'YXZ'
  base.rotation.y = fuera * (Math.PI / 2)
  raiz.add(base)
  const pulgar = [base]
  const punta = falange(base, PULGAR.falanges[0], piezas)
  pulgar.push(punta)
  falange(punta, PULGAR.falanges[1], piezas)

  return { raiz, dedos, pulgar, piezas, yemas }
}

/**
 * El guante.
 *
 * @param side      −1 o 1 según la mano, como en `ControllerModel`: el costado del gatillo
 *   lateral. La palma va en el contrario.
 * @param highlight si las yemas llevan la ayuda del agarre.
 * @param leer      lo que se aprieta ahora mismo. Se consulta en cada fotograma porque el
 *   mando cambia sin que React vuelva a renderizar.
 */
export function Guante({
  side,
  highlight,
  leer,
}: {
  side: number
  highlight: boolean
  leer: () => Lectura
}) {
  const malla = useRef<InstancedMesh>(null)
  const fuera = -side
  const esqueleto = useMemo(() => montarEsqueleto(fuera), [fuera])
  const postura = useRef<Postura>(posturaDelGuante({ agarre: 0, gatillo: 0 }))
  const tiempo = useRef(0)
  const color = useMemo(() => new Color(), [])

  // Los colores de partida, antes del primer fotograma: sin ellos la malla nace sin
  // `instanceColor` y el material se compila sin él.
  useLayoutEffect(() => {
    const mesh = malla.current
    if (mesh == null) return
    for (let i = 0; i < esqueleto.piezas.length; i++) mesh.setColorAt(i, GUANTE)
  }, [esqueleto])

  useFrame((_, delta) => {
    const mesh = malla.current
    if (mesh == null) return
    tiempo.current += delta
    postura.current = acercarPostura(postura.current, posturaDelGuante(leer()), delta)
    const { dedos, indice, pulgar } = postura.current

    // Los dedos se doblan alrededor del mango, que es vertical: giran sobre Y, desde −Z
    // (delante) hacia el costado del gatillo lateral, que es el contrario de `fuera`.
    esqueleto.dedos.forEach((articulaciones, d) => {
      const angulos = angulosDelDedo(DEDOS[d].indice ? indice : dedos)
      articulaciones.forEach((articulacion, i) => {
        articulacion.rotation.y = fuera * angulos[i]
      })
    })
    // Y el pulgar baja sobre la cabeza del mando: gira sobre su propio X (ver `montarEsqueleto`).
    esqueleto.pulgar.forEach((articulacion, i) => {
      articulacion.rotation.x = -DOBLEZ_PULGAR[i] * pulgar
    })

    esqueleto.raiz.updateMatrixWorld(true)
    esqueleto.piezas.forEach((pieza, i) => mesh.setMatrixAt(i, pieza.matrixWorld))
    mesh.instanceMatrix.needsUpdate = true

    const cerrada = dedos >= CERRADA
    const latido = 0.5 + 0.5 * Math.sin(tiempo.current * Math.PI * 2 * LATIDO_HZ)
    if (cerrada) color.copy(VERDE)
    else if (highlight) color.copy(GUANTE).lerp(AMBAR, 0.35 + 0.65 * latido)
    else color.copy(GUANTE)
    for (const yema of esqueleto.yemas) mesh.setColorAt(yema, color)
    if (mesh.instanceColor != null) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={malla}
      args={[undefined, undefined, esqueleto.piezas.length]}
      // Se mueve cada fotograma y su esfera envolvente se calcularía una vez: sin esto,
      // three la daría por fuera de la vista con la mano en otro sitio.
      frustumCulled={false}
      // La mano no es un blanco: el rayo y el agarre la atraviesan.
      pointerEvents={DECOR_POINTER_EVENTS}
    >
      <boxGeometry />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#9aa6b6"
        emissiveIntensity={0.25}
        roughness={0.85}
        flatShading
      />
    </instancedMesh>
  )
}
