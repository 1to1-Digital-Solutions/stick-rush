import { eligeJugadores } from './duel'
import { GAME_MODE_ORDER, picksSetup, type GameMode } from './gameMode'
import { MENU_EN } from './palabras'
import { conElRetoPrimero, filasDelMenu, type FilasDelMenu, type PapelDeLaFila } from './plantillaDelMenu'

/**
 * Las filas del menú de Stick Rush según la plantilla común (`plantillaDelMenu.ts`): qué filas
 * tiene cada modo, qué papel tiene cada una y cuáles quedan detrás de «Más opciones».
 *
 * Lo usan los tres menús —el panel del visor (`XRMenu.tsx`), la portada de la web
 * (`StartScreen.tsx`) y el del port de Godot (`godot/scene/interfaz/menu.ts`)—, para que los tres
 * plieguen lo mismo.
 *
 * - **Modo**: el interruptor de modo y, en los niveles, la escalera con la velocidad del nivel,
 *   que es lo que concreta el modo elegido.
 * - **Jugadores**: solo o a dos, solo en el reto (`eligeJugadores`).
 * - **Lo demás**: la tanda o sin fin, los palos y la velocidad de la práctica, y en el visor la
 *   altura del aro y lo que se ve alrededor. El reto es una partida fija: con él elegido, lo demás
 *   no se enseña ni hay botón para pedirlo.
 *
 * Sin nada del navegador ni del motor: se porta a Godot tal cual.
 */

/**
 * Los modos en el orden de la fila «Modo»: el reto, el que da medalla, el primero. El interruptor
 * del visor los recorre en este orden y la portada los pone así; `GAME_MODE_ORDER`, del más suave
 * al más exigente, se queda para lo demás.
 */
export const MODOS_DEL_MENU: readonly GameMode[] = conElRetoPrimero(GAME_MODE_ORDER, (modo) => modo === 'challenge')

/** El modo que sigue a ese al pulsar el interruptor del visor: del último, vuelta al primero. */
export function siguienteModo(modo: GameMode): GameMode {
  return MODOS_DEL_MENU[(MODOS_DEL_MENU.indexOf(modo) + 1) % MODOS_DEL_MENU.length]
}

/** Una fila del menú: `levels` es la escalera de los niveles con su velocidad, que no se elige. */
export type FilaDelMenu = 'mode' | 'levels' | 'players' | 'endless' | 'sticks' | 'speed' | 'hoop' | 'around'

/** Dónde se pinta el menú: el visor lleva además el aro y lo de alrededor. */
export type MenuDe = 'visor' | 'portada'

/** El papel de cada fila en la plantilla. */
export function papelDeLaFila(fila: FilaDelMenu): PapelDeLaFila {
  if (fila === 'mode' || fila === 'levels') return 'modo'
  return fila === 'players' ? 'jugadores' : 'otra'
}

/** Las filas que tiene el menú con ese modo elegido, todas, en el orden de la plantilla. */
export function filasDelModo(modo: GameMode, donde: MenuDe): FilaDelMenu[] {
  const filas: FilaDelMenu[] = ['mode']
  if (modo === 'levels') filas.push('levels')
  if (eligeJugadores(modo)) filas.push('players')
  if (picksSetup(modo)) filas.push('endless', 'sticks', 'speed')
  if (donde === 'visor') filas.push('hoop', 'around')
  return filas
}

/** Lo que se enseña del menú: las filas a la vista y cuántas quedan plegadas. */
export function filasALaVista(modo: GameMode, donde: MenuDe, masOpciones: boolean): FilasDelMenu<FilaDelMenu> {
  return filasDelMenu(filasDelModo(modo, donde), papelDeLaFila, { masOpciones, enReto: modo === 'challenge' })
}

/**
 * Lo que dice el botón de plegar, o `null` si no lleva: «Más opciones» con algo plegado, «Menos
 * opciones» con todo a la vista si hay algo que volver a plegar, y nada en el reto.
 */
export function botonDeOpciones(
  modo: GameMode,
  donde: MenuDe,
  masOpciones: boolean,
): typeof MENU_EN.masOpciones | typeof MENU_EN.menosOpciones | null {
  const plegable = filasALaVista(modo, donde, false).plegadas > 0
  if (!plegable) return null
  return masOpciones ? MENU_EN.menosOpciones : MENU_EN.masOpciones
}

/** Si esa fila se ve con ese modo y ese plegado. */
export function seVe(fila: FilaDelMenu, modo: GameMode, donde: MenuDe, masOpciones: boolean): boolean {
  return filasALaVista(modo, donde, masOpciones).filas.includes(fila)
}
