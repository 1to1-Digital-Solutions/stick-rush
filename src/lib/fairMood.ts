/**
 * Cómo responde la feria a lo que hace el jugador.
 *
 * Las bombillas de las casetas y las guirnaldas suben de brillo con la racha y,
 * a partir de cierta racha, palpitan al ritmo de una fiesta; el público se
 * mece más deprisa y más alto. Todo son funciones puras de la racha y del reloj:
 * la escena las lee cada fotograma sin pasar por React y se pueden probar sin
 * escena.
 *
 * Con `prefers-reduced-motion` las bombillas no palpitan y el público no se
 * mueve; el brillo sí sube, que un cambio lento de luz no es movimiento.
 */

/** Brillo de las bombillas sin racha: el que tenía la feria antes de todo esto. */
export const BULB_GLOW_IDLE = 1.6
/** Hasta dónde llega el brillo con una racha larga. */
export const BULB_GLOW_MAX = 3.2
/** Racha a partir de la cual las bombillas empiezan a palpitar. */
export const PARTY_STREAK = 5
/** Racha con la que la fiesta ya está al máximo; más no cambia nada. */
export const FULL_PARTY_STREAK = 15

/** Cuánto sube el brillo con la racha: rápido al principio, saturando después. */
export function bulbGlow(streak: number): number {
  const s = Math.max(0, streak)
  return BULB_GLOW_IDLE + (BULB_GLOW_MAX - BULB_GLOW_IDLE) * (1 - Math.exp(-s / 6))
}

/** Cuánto de fiesta hay: 0 sin racha, 1 con la racha de fiesta completa. */
export function partyLevel(streak: number): number {
  if (streak < PARTY_STREAK) return 0
  return Math.min(1, (streak - PARTY_STREAK + 1) / (FULL_PARTY_STREAK - PARTY_STREAK + 1))
}

/**
 * El palpitar de las bombillas en este instante, entre 0 (color de siempre) y
 * 1 (blanco de fiesta). Late más deprisa cuanto mayor es la racha.
 */
export function bulbPulse(streak: number, time: number): number {
  const level = partyLevel(streak)
  if (level === 0) return 0
  const beat = 1.6 + 1.4 * level
  const wave = 0.5 + 0.5 * Math.sin(Math.PI * 2 * beat * time)
  return wave * level
}

/** Cuánto se mece el público, en metros de subida y bajada. Siempre algo: la gente no es de piedra. */
export function crowdBob(streak: number): number {
  return 0.012 + 0.05 * Math.min(1, Math.max(0, streak) / FULL_PARTY_STREAK)
}

/** A qué ritmo se mece, en vaivenes por segundo. */
export function crowdTempo(streak: number): number {
  return 1.1 + 1.3 * Math.min(1, Math.max(0, streak) / FULL_PARTY_STREAK)
}
