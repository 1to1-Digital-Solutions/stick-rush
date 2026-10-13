import type { GameMode } from './gameMode'
import { MENU_EN } from './menuWords'

/**
 * El calentamiento: la primera partida con el visor, mientras el tutorial está delante, no cuenta.
 *
 * **El problema.** El menú abre en el reto y el tutorial corre encima de él: los palos que se
 * escapan mientras alguien aprende a cerrar la mano gastaban las tres vidas del reto, y el que se
 * perdía en diez segundos sin saber qué hacer era la partida que da medalla. Es la receta común de
 * los diecisiete juegos del salón: mientras se aprende el gesto, nada de lo que pasa cuenta.
 *
 * **En Stick Rush, nada cuenta es que los palos que caen al suelo no quitan vidas** y la partida
 * no se acaba: atrapar suena, vibra y suma en el marcador, como siempre, para que se aprenda lo
 * que pasa. El tutorial se cierra por sus pasos (atrapar dos palos), por «Siguiente», por
 * «Saltar» o por su plazo, y entonces **el reto empieza de cero**: máquina cargada otra vez,
 * cuenta atrás, tres vidas y en el cartel «Ahora cuenta para medalla» hasta el primer palo.
 *
 * **Nunca en el reto del día** (el que trae semilla del salón entra sin lección) **ni a dos**, y
 * solo en el reto: la práctica y los niveles no dan medalla, así que no hay nada que proteger.
 */
export function enCalentamiento({
  ensenando,
  gameMode,
  aDos,
  enReto,
}: {
  /** La partida va enseñando: con visor y sin el tutorial visto (`teaching` del store). */
  ensenando: boolean
  gameMode: GameMode
  /** Se juega a dos pasándose el mando. */
  aDos: boolean
  /** Es el reto del día del salón. */
  enReto: boolean
}): boolean {
  return ensenando && gameMode === 'challenge' && !aDos && !enReto
}

/** Cómo se llama lo que se juega mientras tanto, en el cartel que dice que no cuenta. */
export const CALENTAMIENTO = MENU_EN.warmup

/** El aviso de una línea al cerrar el tutorial, hasta que se resuelve el primer palo del reto. */
export const AHORA_CUENTA = MENU_EN.nowItCounts
