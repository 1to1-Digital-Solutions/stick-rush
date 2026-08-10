import { machinePoint } from './gameConfig'

/** Posición y momento de salida de un palo dentro de una partida. */
export interface StickLayout {
  /** Clave estable por partida: fuerza el remontaje al empezar otra. */
  key: string
  /** Punto del aro del que cuelga. */
  anchor: [number, number, number]
  /** Segundos que espera colgando antes de soltarse. */
  delay: number
  /** Su hueco dentro del ciclo del vaivén, en [0, 1). Ver `stickSwing.ts`. */
  swingPhase: number
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
 * Turno de caída de cada palo, barajado.
 *
 * Devuelve las posiciones del aro en el orden en que se sueltan: `order[0]` es
 * el palo que cae primero. Fisher-Yates sembrado con `runId`, así que la
 * secuencia es distinta en cada partida pero estable dentro de ella.
 */
export function fallOrder(stickCount: number, runId: number): number[] {
  const order = Array.from({ length: Math.max(stickCount, 0) }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(i, runId) * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * Reparte los palos por el aro y escalona su caída.
 *
 * La posición en el aro y el momento de caer son **independientes**: los
 * anclajes van de izquierda a derecha evitando los extremos exactos (ahí están
 * los postes), pero el turno de cada palo sale de `fallOrder`. Antes el retardo
 * se calculaba a partir del índice, así que los palos caían siempre en orden,
 * de izquierda a derecha, y la partida era predecible.
 */
export function buildStickLayout(
  stickCount: number,
  runId: number,
): StickLayout[] {
  const order = fallOrder(stickCount, runId)
  const turnOf: number[] = []
  order.forEach((stickIndex, turn) => {
    turnOf[stickIndex] = turn
  })

  return Array.from({ length: stickCount }, (_, index) => {
    const t = stickCount === 1 ? 0.5 : (index + 1) / (stickCount + 1)
    return {
      key: `${runId}-${index}`,
      anchor: machinePoint(t),
      // Un turno por palo, más un jitter para que no suene a metrónomo.
      delay: turnOf[index] * (1 + seededRandom(index, runId) * 0.5),
      swingPhase: seededRandom(index + SWING_PHASE_SEED, runId),
    }
  })
}

/**
 * Desplazamiento de la semilla del vaivén. Sin él, la fase del balanceo saldría
 * del mismo valor que el jitter del retardo y el palo que más tarda en caer
 * sería siempre el que más adelantado va meciéndose.
 */
const SWING_PHASE_SEED = 977

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
