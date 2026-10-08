'use client'

import { GameProvider } from '../components/GameProvider'
import { GameWorld } from '../components/game/GameWorld'
import { setAssetsBase } from '../lib/assets'
import type { HostAnchor } from '../lib/hostAnchor'
import type { ResultadoConHazanas } from '../lib/hazanas'
import type { Objetivo } from '../lib/objetivo'
import { fijarNombreDelJuego } from '../lib/plantillaDelMenu'
import type { Reto } from '../lib/semilla'
import { ExitProvider } from './exit'

export interface StickRushSceneProps {
  /**
   * De dónde cuelgan los ficheros estáticos del juego (el HDRI, las texturas y
   * los perfiles de mando que se copian de `public/`). Los sirve el anfitrión,
   * bajo su propio prefijo: dos juegos en el mismo origen se pisarían.
   */
  assetsBase?: string
  /**
   * Dónde y con qué rumbo plantar el mundo del juego, si quien monta la escena
   * lo sabe: el salón de xrcade presta el anclaje con el que tiene plantado su
   * arco de cabinas.
   *
   * **Sin él, el mundo se planta delante de donde se mire al entrar**, que es
   * lo único que se sabe en la web propia del juego. Dentro del salón eso
   * descoloca: leer las cabinas de la izquierda obliga a girar la cabeza, y el
   * juego salía girado hacia allí.
   */
  anchor?: HostAnchor
  /**
   * Devolver al jugador a donde estaba. Lo llama el juego desde su interfaz
   * inmersiva; qué significa volver lo decide quien monta.
   */
  onExit: () => void
  /**
   * Jugar un reto concreto del salón: el reto del día, o el código de «reta mi puntuación».
   *
   * Con él la escena entra **directamente en una partida del desafío** —el modo del récord de
   * la cabina—, con Medio y trece palos (`CHALLENGE_SETUP`) y sin lección, y el turno y el
   * titubeo de cada palo salen de la semilla: misma semilla, mismos palos cayendo en el mismo
   * orden y al mismo tiempo. Se lee al montar: para otro reto, se vuelve a montar.
   */
  reto?: Reto
  /**
   * Se llama **una vez** al acabar cada partida con puntuación, en cualquier modo, con sus
   * puntos aunque no sean récord. Dejar la partida a medias o salir no la acaba. Lleva `hazanas`
   * con los nombres de API estrenados en la partida, si hay alguno (`lib/hazanas.ts`).
   */
  onTerminar?: (resultado: ResultadoConHazanas) => void
  /**
   * Qué hay que superar: los tres listones de medalla del juego, la marca de quien juega y el
   * modo en que cuentan. Con él, el cartel de encima del marcador dice qué listón falta y cuánto
   * queda; sin él, la misión y el récord guardado en este navegador.
   */
  objetivo?: Objetivo
  /**
   * Cómo se llama el juego en su menú: el `name` del manifiesto del catálogo, el de la cabina del
   * salón. Sin él, el del `package.json` con mayúsculas, que es el mismo (`plantillaDelMenu.ts`).
   */
  nombre?: string
}

/**
 * Stick Rush como ESCENA: lo que se pinta dentro del Canvas de otro.
 *
 * Es el contrato con el que xrcade monta un juego dentro de su salón. No crea
 * Canvas, no abre ni cierra la sesión inmersiva y no pinta una sola etiqueta de
 * DOM: solo objetos de three. Así, entrar en el juego y volver al salón son
 * montar y desmontar un trozo de escena, y la sesión ni se entera — que es lo
 * que permite pasar de un juego al salón sin quitarse el visor.
 *
 * Para montarlo con su interfaz 2D y su propia sesión —lo que quiere una página
 * web normal— está `<StickRush>`, que es esta escena con un Canvas alrededor.
 *
 * El contrato completo, en `docs/montar-el-juego.md`.
 */
export function StickRushScene({ assetsBase, anchor, onExit, reto, onTerminar, objetivo, nombre }: StickRushSceneProps) {
  // Durante el render y no en un efecto: la escena pide el HDRI y las texturas
  // en cuanto se monta, es decir, antes de que corra ningún efecto. Escribir la
  // misma base dos veces no cambia nada, así que repetir el render es inocuo.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)
  // Lo mismo con el nombre: el menú lo lee desde el primer fotograma.
  fijarNombreDelJuego(nombre)

  return (
    <GameProvider reto={reto} onTerminar={onTerminar} objetivo={objetivo}>
      <ExitProvider onExit={onExit}>
        <GameWorld anchor={anchor} />
      </ExitProvider>
    </GameProvider>
  )
}
