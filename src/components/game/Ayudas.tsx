'use client'

import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef, useState } from 'react'
import { Group, Mesh, MeshBasicMaterial } from 'three'

import {
  HINT_MARK_COLOR,
  THROB,
  moveToward,
  advanceHints,
  throb,
  sweepPhase,
  noHints,
} from '../../lib/hints'
import { useHand } from '../../lib/settingsClient'
import { useGame } from '../../lib/gameStore'
import {
  CAIDA,
  FANTASMA,
  GUION_DE_AYUDAS,
  HUELLA,
  HUELLAS,
  HUELLAS_Y,
  MANDO_JUNTO_AL_PALO,
  caidaDelFantasma,
  mandoJuntoAlPalo,
  paloDelFantasma,
  vanACaer,
  type AyudaDeLaMaquina,
  type HechoDeLasAyudas,
} from '../../lib/guionDeAyudas'
import { TUTORIAL_BUTTONS } from '../../lib/tutorial'
import { RealController } from '../xr/RealController'
import { NO_RAYCAST } from '../raycast'

/**
 * Las ayudas visuales: lo que hay que hacer, enseñado sin una sola letra.
 *
 * **Por qué existe.** El tutorial explica el juego y se queda como red de seguridad, pero lo
 * primero que hace alguien al entrar no es leer: es mirar alrededor. Si mirando alrededor no se
 * ve dónde ponerse, que los palos caen ni con qué se cogen, el juego empieza con una pregunta.
 * Aquí están las respuestas, dibujadas: las huellas en el centro del aro, el palo fantasma
 * cayendo desde el de delante hasta la altura del pecho, y a su lado el mando de verdad con el
 * botón de agarre latiendo.
 *
 * **Y ninguna se queda puesta.** Cada una se apaga sola en cuanto el gesto se hace una vez, o al
 * agotarse su plazo, y lo que flota se va antes de que caiga el primer palo; lo decide
 * `lib/guionDeAyudas.ts` sobre el motor de `lib/ayudas.ts`, los dos probados sin navegador.
 * Aquí solo se pinta.
 *
 * **Todo se monta de una vez y no se desmonta nunca**, aunque no se vea. Montar una malla nueva
 * a mitad de partida obliga a three a compilar su material, y compilar un shader bloquea el
 * hilo: con el visor puesto eso es un tirón. Montado desde el principio lo compila `Calentar`
 * con todo lo demás. Lo que se enciende y se apaga es `visible` y la opacidad — y una ayuda
 * apagada es invisible, así que tampoco cuesta una llamada de dibujo.
 *
 * **Cuelga del mundo, junto a la máquina**, y no de nada que se monte con la partida: su origen
 * es el centro del aro, que es respecto de lo que está escrito el guion.
 *
 * **Solo dentro del visor.** Fuera de la sesión se juega con el ratón sobre una pantalla, y ahí
 * la web lo cuenta con letras, que se leen antes de empezar y sin tener las manos ocupadas.
 */

/** Lo transparente que llega a ponerse cada ayuda encendida del todo. */
const OPACIDAD = { suelo: 0.75, palo: 0.6 } as const

/**
 * Lo pintado sobre el suelo se separa sesgando la profundidad al rasterizar y no levantándolo un
 * milímetro: el milímetro basta en el navegador y no basta con el visor puesto.
 */
const CALCO = {
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
} as const

/** Lo que llevan todos los materiales de una ayuda: ámbar, translúcido y sin tono. */
const PINTURA = {
  color: HINT_MARK_COLOR,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
} as const

/** ¿Ha pedido quien juega que las cosas no se muevan solas? */
function sinMovimiento(): boolean {
  if (typeof window === 'undefined' || window.matchMedia == null) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Ayudas() {
  const enSesion = useXR((state) => state.mode != null)
  const { gameState, countdown, score, hoopHeight } = useGame()
  const mano = useHand()
  const [quieto] = useState(sinMovimiento)

  /** Dónde va el mando: junto a donde se para el fantasma, del lado de la mano buena. */
  const junto = useMemo(() => {
    const { posicion, giro } = mandoJuntoAlPalo(hoopHeight, mano)
    return { position: posicion, rotation: [0, giro, 0] as const, escala: MANDO_JUNTO_AL_PALO.escala }
  }, [hoopHeight, mano])

  /** El reloj de cada ayuda y cuáles se enseñan, sin pasar por el estado de React. */
  const estado = useRef(noHints())
  /**
   * Lo que el guion da por hecho. **Una vez hecho, se queda hecho**: volver al menú no vuelve a
   * encender lo que ya se aprendió. Se muta el mismo objeto en cada fotograma en vez de armar
   * uno nuevo: noventa objetos por segundo son noventa objetos que recoger.
   */
  const hechos = useRef<Record<HechoDeLasAyudas, boolean>>({ grab: false, cae: false })
  /** Lo que se ve de cada una ahora mismo, de 0 a 1. */
  const fuerza = useRef<Record<AyudaDeLaMaquina, number>>({ suelo: 0, palo: 0, mando: 0 })

  const huellas = useRef<(Mesh | null)[]>([])
  const palo = useRef<Mesh>(null)
  const mando = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    hechos.current.grab ||= score > 0
    hechos.current.cae ||= vanACaer(gameState, countdown)
    const paso = advanceHints(GUION_DE_AYUDAS, hechos.current, estado.current, enSesion ? delta : 0)
    const reloj = clock.elapsedTime
    const pulso = quieto ? 1 : throb(reloj, THROB.strength)

    for (const ayuda of GUION_DE_AYUDAS) {
      const quiere = enSesion && paso.lit.has(ayuda.id) ? 1 : 0
      fuerza.current[ayuda.id] = moveToward(fuerza.current[ayuda.id], quiere, delta)
    }

    // Las huellas del suelo, latiendo: es lo que las separa de una losa más de la plaza.
    const enElSuelo = fuerza.current.suelo
    for (const pieza of huellas.current) {
      if (pieza == null) continue
      pieza.visible = enElSuelo > 0.004
      ;(pieza.material as MeshBasicMaterial).opacity = enElSuelo * OPACIDAD.suelo * pulso
    }

    // El palo fantasma, cayendo desde el de delante hasta la altura del pecho. **No late**: ya
    // se mueve, y un latido encima de la caída lo convertiría en un parpadeo. Quieto a media
    // caída si se ha pedido que nada se mueva solo, que así sigue diciendo hacia dónde van.
    const conPalo = fuerza.current.palo
    if (palo.current != null) {
      palo.current.visible = conPalo > 0.004
      const vuelta = quieto
        ? { bajada: CAIDA.recorrido / 2, se: 1 }
        : caidaDelFantasma(sweepPhase(reloj, CAIDA.periodo).progress)
      const [x, y, z] = paloDelFantasma(hoopHeight)
      palo.current.position.set(x, y - vuelta.bajada, z)
      ;(palo.current.material as MeshBasicMaterial).opacity = conPalo * OPACIDAD.palo * vuelta.se
    }

    // El mando de verdad. Se apaga escondiendo el grupo y no desmontándolo: desmontarlo libera
    // los materiales del modelo y volver a enseñarlo los recompilaría.
    if (mando.current != null) mando.current.visible = fuerza.current.mando > 0.004
  })

  return (
    <group name="ayudas">
      {/* Las huellas, en el suelo y a los pies de quien entra: en el centro del aro y de
          frente a la máquina, que es desde donde se llega a todos los palos. */}
      {HUELLAS.map((huella, indice) => (
        <mesh
          key={indice}
          name={`ayuda-huella-${indice}`}
          ref={(pieza) => {
            huellas.current[indice] = pieza
          }}
          visible={false}
          raycast={NO_RAYCAST}
          position={[huella.x, HUELLAS_Y, huella.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          // Una huella es un óvalo: el círculo de doce lados estirado a lo largo del pie.
          scale={[HUELLA.ancho / 2, HUELLA.largo / 2, 1]}
        >
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial {...PINTURA} {...CALCO} />
        </mesh>
      ))}

      {/* El palo fantasma: un cilindro un poco más grueso que el palo de verdad, que lo envuelve
          donde cuelga y cae con él. Sin rayo: lo que se coge es el palo de verdad. */}
      <mesh ref={palo} name="ayuda-palo" visible={false} raycast={NO_RAYCAST}>
        <cylinderGeometry args={[FANTASMA.radio, FANTASMA.radio, FANTASMA.largo, 12]} />
        <meshBasicMaterial {...PINTURA} />
      </mesh>

      {/* El mando de verdad con el botón de agarre latiendo, **al lado de donde se para el
          fantasma** y no sobre la mano: la mano la ocupa la copia del tutorial, y dos copias del
          mismo modelo en el mismo sitio se pisan. Así sale desde la primera vez. Dentro de un
          grupo propio para apagarlo sin desmontarlo. */}
      <group ref={mando} name="ayuda-mando" visible={false}>
        <RealController hand={mano} button={TUTORIAL_BUTTONS.grab} beside={junto} />
      </group>
    </group>
  )
}
