import { DIFFICULTY_ORDER, type Difficulty } from './gameConfig'

/**
 * El modo Niveles: una escalera de quince partidas sueltas.
 *
 * El desafío de este juego no sube solo —la dificultad la elige el jugador y
 * las vidas son lo que cambia—, así que los niveles traen su propia escalera:
 * dentro de una velocidad, más palos; agotados los palos, más velocidad. Cada
 * nivel se juega entero y sin vidas, se puntúa con estrellas por los palos
 * atrapados, y con una basta para desbloquear el siguiente. Lo desbloqueado se
 * recuerda entre visitas (`progress.ts`).
 */

/** Palos de cada nivel dentro de una misma velocidad, de menos a más. */
export const LEVEL_STICK_STEPS = [5, 9, 13] as const

export const LEVEL_COUNT = DIFFICULTY_ORDER.length * LEVEL_STICK_STEPS.length

export type Stars = 0 | 1 | 2 | 3

/** Qué parte de los palos hay que atrapar para cada estrella. */
export const STAR_THRESHOLDS: readonly [number, number, number] = [0.6, 0.8, 1]

export interface LevelSpec {
  level: number
  difficulty: Difficulty
  stickCount: number
}

/** Recorta un nivel al rango que existe; lo raro cae al primero. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)))
}

/** Lo que cuelga de la máquina en ese nivel. */
export function levelSpec(level: number): LevelSpec {
  const safe = clampLevel(level)
  const index = safe - 1
  const steps = LEVEL_STICK_STEPS.length
  return {
    level: safe,
    difficulty: DIFFICULTY_ORDER[Math.floor(index / steps)],
    stickCount: LEVEL_STICK_STEPS[index % steps],
  }
}

/** Las estrellas de una partida: cuántos palos se atraparon de los que cayeron. */
export function levelStars(caught: number, stickCount: number): Stars {
  if (!Number.isFinite(stickCount) || stickCount <= 0) return 0
  const ratio = Math.min(1, Math.max(0, caught / stickCount))
  let stars: Stars = 0
  for (const threshold of STAR_THRESHOLDS) if (ratio >= threshold) stars = (stars + 1) as Stars
  return stars
}

export function levelPassed(stars: Stars): boolean {
  return stars >= 1
}

/** Hasta qué nivel se puede jugar tras esta partida. No baja nunca. */
export function nextUnlocked(unlocked: number, level: number, stars: Stars): number {
  const actual = clampLevel(unlocked)
  if (!levelPassed(stars)) return actual
  return Math.max(actual, clampLevel(level + 1))
}
