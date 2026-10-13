import type { Matrix4 } from 'three'

import type { GameState } from './gameStore'

/**
 * Las manos del jugador, montadas por la escena y no por el store de WebXR.
 *
 * **Por qué desde la escena.** Lo que monta el `XRStore` (su `controller`, su `hand.model`)
 * solo existe en la web propia del juego: dentro del salón de xrcade el store es del salón, y
 * el salón no dibuja manos. Ahí es donde más se juega, así que el guante y la mano desnuda
 * cuelgan de `StickRushScene` y salen igual en los dos sitios (`components/xr/ManosDelJugador`).
 *
 * Lo que decide algo vive aquí; allí solo se dibuja.
 */

export type Mano = 'left' | 'right'

/** Las dos, en el orden en que se montan. */
export const MANOS: readonly Mano[] = ['left', 'right']

/**
 * El costado del mando donde cae el gatillo lateral, como lo pide `Guante`: hacia el interior
 * de la mano, así que en el mando izquierdo queda a su derecha y viceversa.
 */
export function costadoDelGatillo(mano: Mano): 1 | -1 {
  return mano === 'left' ? 1 : -1
}

/**
 * Si las yemas del guante llevan la ayuda del agarre.
 *
 * Desde la cuenta atrás —justo cuando conviene enseñar el control, antes de que caiga nada— y
 * hasta atrapar el primer palo. En el menú estorbaría, porque allí se usa el rayo.
 */
export function llevaLaAyuda(gameState: GameState, score: number): boolean {
  return (gameState === 'countdown' || gameState === 'playing') && score === 0
}

/**
 * Dónde está el modelo articulado de cada mano, relativo a la base de estáticos.
 *
 * **Se pide a la base del juego, no a la del anfitrión**: el salón sirve los perfiles de mando,
 * pero la mano es cosa de este juego. Y **fuera de `webxr-profiles/`**: el salón borra esa
 * carpeta de cada juego al instalarlo, porque sirve la suya (`install-game-assets.ts`).
 */
export function rutaDeLaMano(mano: Mano): string {
  return `manos/generic-hand/${mano}.glb`
}

/**
 * Las veinticinco articulaciones de una mano de WebXR, en el orden de la especificación —que es
 * el orden en que `XRHand` las recorre y `fillPoses` las escribe— y con el nombre que llevan los
 * huesos del modelo `generic-hand`.
 */
export const ARTICULACIONES = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip',
] as const

/**
 * La matriz local que deja un objeto donde WebXR dice, cuelgue de donde cuelgue.
 *
 * WebXR da las poses en el espacio del origen (el `<XROrigin>` del anfitrión, en el cero de la
 * escena). La escena cuelga las manos por debajo de lo que la mueve —la altura del mundo, el
 * anclaje—, así que a la pose se le quita lo que pongan los padres: `local = padre⁻¹ · pose`.
 * Colgada tal cual, la mano aparecería desplazada lo que se haya bajado el mundo.
 *
 * @param destino        donde se escribe el resultado (la `matrix` del objeto).
 * @param padreEnElMundo la `matrixWorld` del padre, o `null` si no tiene.
 * @param enElOrigen     la pose de WebXR en el espacio del origen.
 * @param auxiliar       una matriz de trabajo, para no crear una por fotograma.
 */
export function colocarEnElOrigen(
  destino: Matrix4,
  padreEnElMundo: Matrix4 | null,
  enElOrigen: Matrix4,
  auxiliar: Matrix4,
): Matrix4 {
  if (padreEnElMundo == null) return destino.copy(enElOrigen)
  return destino.multiplyMatrices(auxiliar.copy(padreEnElMundo).invert(), enElOrigen)
}
