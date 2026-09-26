import { type Difficulty } from './gameConfig'

/**
 * Puntuación de una partida.
 *
 * Atrapar un palo vale más o menos según tres cosas, y las tres premian jugar
 * mejor y no solo jugar más:
 *
 * - **La dificultad elegida**, porque en Imposible un palo pasa en siete
 *   décimas y en Fácil tienes casi seis segundos.
 * - **La racha**, porque encadenar sin fallar es más difícil que acertar la
 *   mitad de los palos repartidos. Un fallo la corta de golpe.
 * - **Los reflejos**: cogerlo recién soltado vale el doble que rescatarlo a ras
 *   de suelo. Sin esto daba igual lanzarse a por él que esperarlo abajo.
 *
 * Todo son funciones puras sobre números: el estado de la partida vive en
 * `gameStore` y la escena solo pinta el resultado. Así la fórmula se puede
 * ajustar y probar sin abrir el navegador.
 */

/** Puntos de un palo atrapado antes de aplicar ningún multiplicador. */
export const BASE_STICK_POINTS = 100

/**
 * Cuánto multiplica cada dificultad. Crece más que proporcionalmente al tiempo
 * de reacción que quita: si fuera lineal, jugar en Fácil con 13 palos rendiría
 * lo mismo que en Imposible, y la elección de dificultad daría igual.
 */
export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2.25,
  expert: 3.5,
  impossible: 5,
}

/** Cuánto suma cada palo encadenado a la racha. */
export const STREAK_STEP = 0.15

/**
 * Tope del multiplicador de racha. Sin él, una partida de 13 palos en Fácil
 * daría más que uno perfecto en Imposible solo por ser más larga.
 */
export const MAX_STREAK_MULTIPLIER = 2.5

/** Cuánto añade como mucho coger el palo nada más soltarse. */
export const MAX_REFLEX_BONUS = 1

/**
 * Multiplicador por racha. El primer palo va a 1 y cada uno encadenado suma,
 * hasta el tope.
 *
 * @param streak palos consecutivos atrapados **incluido** el actual
 */
export function streakMultiplier(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 1) return 1
  return Math.min(1 + (streak - 1) * STREAK_STEP, MAX_STREAK_MULTIPLIER)
}

/**
 * Multiplicador por reflejos.
 *
 * @param fallProgress cuánto llevaba cayendo el palo, en fracción de su tiempo
 *   de caída: de 0 (recién soltado) a 1 (a punto de tocar el suelo). Es tiempo
 *   y no recorrido porque el palo acelera (ver `stickFallProgress`). Valores
 *   fuera de rango se recortan: un palo atrapado mientras aún cuelga cuenta
 *   como el mejor caso.
 */
export function reflexMultiplier(fallProgress: number): number {
  if (!Number.isFinite(fallProgress)) return 1
  const clamped = Math.min(Math.max(fallProgress, 0), 1)
  return 1 + (1 - clamped) * MAX_REFLEX_BONUS
}

/**
 * Puntos que suma atrapar un palo. Siempre un entero: una puntuación con
 * decimales no dice nada al jugador.
 */
export function stickPoints({
  difficulty,
  streak,
  fallProgress,
}: {
  difficulty: Difficulty
  streak: number
  fallProgress: number
}): number {
  return Math.round(
    BASE_STICK_POINTS *
      DIFFICULTY_MULTIPLIERS[difficulty] *
      streakMultiplier(streak) *
      reflexMultiplier(fallProgress),
  )
}

/**
 * Puntuación máxima alcanzable en una partida: todos los palos atrapados nada
 * más soltarse y sin romper la racha. Sirve para situar el resultado ("has
 * hecho la mitad de lo posible") sin que el jugador tenga que adivinar la
 * escala.
 */
export function maxScore(difficulty: Difficulty, stickCount: number): number {
  let total = 0
  for (let i = 1; i <= stickCount; i++) {
    total += stickPoints({ difficulty, streak: i, fallProgress: 0 })
  }
  return total
}

/**
 * Cómo de bien ha ido, de 0 a 1, para elegir el mensaje de cierre. Se compara
 * con el máximo real de esa partida, así que no penaliza haber elegido pocos
 * palos ni una dificultad baja.
 */
export function scoreRatio(
  points: number,
  difficulty: Difficulty,
  stickCount: number,
): number {
  const max = maxScore(difficulty, stickCount)
  if (max <= 0) return 0
  return Math.min(Math.max(points / max, 0), 1)
}
