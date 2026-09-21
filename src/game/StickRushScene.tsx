'use client'

import { GameProvider } from '../components/GameProvider'
import { GameWorld } from '../components/game/GameWorld'
import { setAssetsBase } from '../lib/assets'
import type { HostAnchor } from '../lib/hostAnchor'
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
export function StickRushScene({ assetsBase, anchor, onExit }: StickRushSceneProps) {
  // Durante el render y no en un efecto: la escena pide el HDRI y las texturas
  // en cuanto se monta, es decir, antes de que corra ningún efecto. Escribir la
  // misma base dos veces no cambia nada, así que repetir el render es inocuo.
  if (assetsBase !== undefined) setAssetsBase(assetsBase)

  return (
    <GameProvider>
      <ExitProvider onExit={onExit}>
        <GameWorld anchor={anchor} />
      </ExitProvider>
    </GameProvider>
  )
}
