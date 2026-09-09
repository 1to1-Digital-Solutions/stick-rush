/**
 * Con qué intención se juega una partida.
 *
 * - **Práctica**: caen los palos elegidos y la partida acaba cuando se resuelve
 *   el último. Fallar no cuesta nada. Es el juego de siempre, para calentar.
 * - **Niveles**: una escalera propia (`levels.ts`): quince niveles que suben
 *   los palos y después la velocidad, cada uno una partida suelta sin vidas que
 *   se puntúa con estrellas al acabar; una estrella desbloquea el siguiente y
 *   lo desbloqueado se recuerda entre visitas (`progress.ts`).
 * - **Desafío**: se juega con **vidas**. Cada palo que toca el suelo cuesta una,
 *   y la partida acaba al quedarse sin ellas —aunque queden palos colgando— o al
 *   resolverlos todos, que es superar el reto. Es el modo heroico.
 *
 * **Vidas y no rondas que suben de dificultad.** La dificultad ya la elige el
 * jugador y es la palanca con la que escala la puntuación (ver `scoring.ts`); si
 * el desafío la fuera subiendo por su cuenta, elegirla en el menú pasaría a no
 * significar nada y dos partidas de "Experto" no serían la misma cosa. Con
 * vidas, el modo cambia solo **cómo termina** la partida y la dificultad sigue
 * queriendo decir exactamente lo que decía.
 *
 * **Tres vidas fijas**, ni escaladas con el número de palos ni con la
 * dificultad: el trato tiene que entenderse antes de empezar —tres fallos y
 * fuera— y graduarlo es justo para lo que ya están las otras dos opciones. Con
 * 13 palos en Imposible, tres vidas es el reto; con 5 en Fácil, un trámite.
 *
 * Todo son funciones puras sobre contadores: el estado vive en `gameStore` y la
 * interfaz solo lo pinta, igual que con la puntuación.
 */

export type GameMode = 'practice' | 'levels' | 'challenge'

/** Orden de los modos en los selectores, del más suave al más exigente. */
export const GAME_MODE_ORDER: GameMode[] = ['practice', 'levels', 'challenge']

/** Etiqueta visible para el usuario (idioma del producto: español). */
export const GAME_MODE_LABELS: Record<GameMode, string> = {
  practice: 'Practice',
  levels: 'Levels',
  challenge: 'Challenge',
}

/** Qué promete cada modo, en una línea, para el menú de escritorio. */
export const GAME_MODE_HINTS: Record<GameMode, string> = {
  practice: 'Every stick drops and missing costs nothing.',
  levels: 'One level at a time: the one you clear stays unlocked.',
  challenge: 'Three lives: every stick that gets away costs one.',
}

/** Vidas con las que arranca un desafío. */
export const CHALLENGE_LIVES = 3

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
