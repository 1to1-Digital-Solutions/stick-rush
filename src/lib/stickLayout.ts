import { machinePoint } from './gameConfig'

/** Posición y momento de salida de un palo dentro de una partida. */
export interface StickLayout {
  /** Clave estable por partida: fuerza el remontaje al empezar otra. */
  key: string
  /** Punto del aro del que cuelga. */
  anchor: [number, number, number]
  /** Segundos que espera colgando antes de soltarse. */
  delay: number
}

/**
 * Pseudo-aleatorio determinista en [0, 1) a partir de dos enteros (índice
 * y partida). Evita Math.random() en render (impuro) manteniendo el jitter
 * estable durante el ciclo de vida de cada palo.
 */
export function seededRandom(a: number, b: number): number {
  const x = Math.sin(a * 374761393 + b * 668265263) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Reparte los palos por el aro y escalona su caída.
 *
 * Los anclajes van de izquierda a derecha evitando los extremos exactos (ahí
 * están los postes) y cada palo sale algo más tarde que el anterior, con un
 * jitter determinista para que la secuencia no se sienta metronómica.
 */
export function buildStickLayout(
  stickCount: number,
  runId: number,
): StickLayout[] {
  return Array.from({ length: stickCount }, (_, index) => {
    const t = stickCount === 1 ? 0.5 : (index + 1) / (stickCount + 1)
    return {
      key: `${runId}-${index}`,
      anchor: machinePoint(t),
      delay: index * (1 + seededRandom(index, runId) * 0.5),
    }
  })
}

/** Cómo ha acabado (o no) cada palo, para pintar el marcador. */
export type StickStatus = 'caught' | 'missed' | 'pending'

/**
 * Estado de cada palo del marcador a partir de los contadores de la partida.
 *
 * El store solo guarda agregados (atrapados y resueltos), no el desenlace de
 * cada palo: para el marcador basta con pintar primero los atrapados, luego los
 * perdidos y al final los que siguen en juego.
 */
export function stickStatuses(
  score: number,
  resolved: number,
  stickCount: number,
): StickStatus[] {
  return Array.from({ length: Math.max(stickCount, 0) }, (_, index) => {
    if (index < score) return 'caught'
    if (index < resolved) return 'missed'
    return 'pending'
  })
}
