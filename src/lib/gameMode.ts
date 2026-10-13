/**
 * Con qué intención se juega una partida.
 *
 * - **Práctica**: caen los palos elegidos y la partida acaba cuando se resuelve
 *   el último. Fallar no cuesta nada. Es el juego de siempre, para calentar.
 * - **Niveles**: una escalera propia (`levels.ts`): quince niveles que suben
 *   los palos y después la velocidad, cada uno una partida suelta sin vidas que
 *   se puntúa con estrellas al acabar; una estrella desbloquea el siguiente y
 *   lo desbloqueado se recuerda entre visitas (`progress.ts`).
 * - **Reto** (`challenge`, el desafío): se juega con **vidas**. Cada palo que toca el suelo cuesta una,
 *   y la partida acaba al quedarse sin ellas —aunque queden palos colgando— o al
 *   resolverlos todos, que es superar el reto. Es el modo heroico.
 *
 * **Vidas y no rondas que suben de dificultad.** El desafío se juega siempre con
 * lo mismo (`CHALLENGE_SETUP`): es la partida del récord de la cabina y del reto
 * del día, y una partida que se endureciera por su cuenta dejaría de ser la misma
 * para todos. Las vidas cambian solo **cómo termina**.
 *
 * **Tres vidas fijas**: el trato tiene que entenderse antes de empezar —tres
 * fallos y fuera—. Con el aro lleno a velocidad media, eso es el reto.
 *
 * Todo son funciones puras sobre contadores: el estado vive en `gameStore` y la
 * interfaz solo lo pinta, igual que con la puntuación.
 */

import { type Difficulty, MAX_STICKS } from './gameConfig'
import { MENU_EN } from './menuWords'

export type GameMode = 'practice' | 'levels' | 'challenge'

/** Orden de los modos en los selectores, del más suave al más exigente. */
export const GAME_MODE_ORDER: GameMode[] = ['practice', 'levels', 'challenge']

/** Cómo se llama cada modo en los menús, en inglés (la clave del diccionario: «Challenge» es «Reto»). */
export const GAME_MODE_LABELS = {
  practice: 'Practice',
  levels: 'Levels',
  challenge: 'Challenge',
} as const satisfies Record<GameMode, string>

/**
 * Qué promete cada modo, en una línea, para los dos menús, **y si cuenta para medalla**: el
 * récord de la cabina y las medallas del salón salen del reto, y quien elige otra cosa tiene que
 * saberlo antes de empezar y no al acabar.
 */
export const GAME_MODE_HINTS = {
  practice: 'No medal. Every stick drops, missing costs nothing.',
  levels: 'No medal. One level at a time, each unlocks the next.',
  challenge: 'Counts for a medal. Three lives, one per stick lost.',
} as const satisfies Record<GameMode, string>

/**
 * El modo que hay elegido al abrir el menú, **siempre**: no se recuerda el último.
 *
 * Se abre en el reto porque es el modo del récord y de las medallas del salón: quien entra y
 * pulsa Jugar sin tocar nada tiene que estar jugando a lo que cuenta, con su objetivo delante.
 * La práctica queda a un toque.
 */
export const DEFAULT_GAME_MODE: GameMode = 'challenge'

/** Vidas con las que arranca un desafío. */
export const CHALLENGE_LIVES = 3

/**
 * Con qué se juega el desafío: siempre lo mismo, **Medio y los trece palos**.
 *
 * **Un reto tiene que exigir.** Con Fácil y cinco palos, tres vidas para cinco palos que tardan
 * seis segundos en caer era un trámite, y todas las partidas acababan en la misma puntuación.
 * Con el aro lleno a velocidad media caen varios a la vez por todo el arco, hay que girarse a
 * buscarlos, y la racha —que es lo que más multiplica— se gana o se pierde de verdad.
 *
 * **Fijo porque su récord es el de la cabina** (`stick-rush:best-points:challenge`, en el
 * manifiesto del salón) y los puntos escalan con la dificultad y con los palos: con los dos a
 * elegir, dos récords del desafío no se podían comparar, y el reto del día —la misma partida
 * para todos— no sería la misma partida. Y porque el desafío se juega **dándole a Jugar**: lo
 * que se pregunta es de la práctica, que es donde se calienta.
 */
export const CHALLENGE_SETUP: { readonly difficulty: Difficulty; readonly stickCount: number } = {
  difficulty: 'medium',
  stickCount: MAX_STICKS,
}

/**
 * Si el modo pregunta cuántos palos y a qué velocidad. **Solo la práctica**: en Niveles lo dice
 * el nivel y en el desafío va fijo (`CHALLENGE_SETUP`), así que sus menús se quedan en elegir
 * el modo y darle a Jugar.
 */
export function picksSetup(mode: GameMode): boolean {
  return mode === 'practice'
}

/**
 * Cómo ha acabado una partida.
 *
 * - `cleared`: se resolvieron todos los palos. En práctica es el único final
 *   posible; en desafío es haber superado el reto.
 * - `failed`: se agotaron las vidas antes de acabar. Solo en desafío.
 */
export type RunOutcome = 'cleared' | 'failed'

/** Lo que hay que saber de una partida para decidir si sigue viva. */
export interface RunProgress {
  mode: GameMode
  /** Palos ya resueltos: atrapados más perdidos. */
  resolved: number
  /** Palos que se han escapado, los que descuentan vida. */
  misses: number
  /** Palos que se pusieron en juego. */
  stickCount: number
}

/**
 * Vidas con las que se empieza, o `null` en un modo que no se juega con ellas.
 *
 * `null` y no cero a propósito: cero vidas es haber perdido, y confundir "no hay
 * vidas en juego" con "te has quedado sin ellas" cerraría toda partida de
 * práctica en el primer fallo.
 */
export function startingLives(mode: GameMode): number | null {
  return mode === 'challenge' ? CHALLENGE_LIVES : null
}

/** Vidas que quedan tras `misses` fallos. Nunca baja de cero. */
export function remainingLives(mode: GameMode, misses: number): number | null {
  const lives = startingLives(mode)
  if (lives == null) return null
  return Math.max(0, lives - misses)
}

/**
 * Cómo ha acabado la partida, o `null` si sigue en marcha.
 *
 * Quedarse sin vidas manda sobre todo lo demás: el último palo puede tocar el
 * suelo a la vez que se resuelve el resto, y ahí la partida se ha perdido, no
 * completado.
 */
export function runOutcome({
  mode,
  resolved,
  misses,
  stickCount,
}: RunProgress): RunOutcome | null {
  if (remainingLives(mode, misses) === 0) return 'failed'
  if (resolved >= stickCount) return 'cleared'
  return null
}

/**
 * Lo que dice el botón de repetir al acabar, con las palabras comunes del salón (`palabras.ts`):
 * «Otro reto» en el modo que da medalla y «Otra partida» en los demás.
 */
export function otraDelModo(mode: GameMode): typeof MENU_EN.anotherChallenge | typeof MENU_EN.anotherRun {
  return mode === 'challenge' ? MENU_EN.anotherChallenge : MENU_EN.anotherRun
}
