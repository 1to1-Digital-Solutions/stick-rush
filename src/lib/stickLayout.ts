import { MACHINE_HEIGHT, machinePoint } from './gameConfig'
import { azarDesde, semillaDe } from './semilla'

/** Posición y momento de salida de un palo dentro de una partida. */
export interface StickLayout {
  /** Clave estable por tanda: fuerza el remontaje al empezar otra. */
  key: string
  /** Punto del aro del que cuelga. */
  anchor: [number, number, number]
  /** Segundos que espera colgando antes de soltarse. */
  delay: number
  /** Su hueco dentro del ciclo del vaivén, en [0, 1). Ver `stickSwing.ts`. */
  swingPhase: number
}

/**
 * De qué sale cada sorteo de una tanda, para derivarlo de la semilla con `semillaDe`.
 *
 * Cada cosa que se sortea lleva su propio hilo: el turno de caída, el titubeo de cada palo antes
 * de soltarse y su vaivén. Así, añadir un sorteo nuevo no cambia los que ya había, y el vaivén
 * —que es solo de adorno— no se lleva números que el reparto necesita.
 */
const HILO = { orden: 1, retardo: 2, vaiven: 3 } as const

/**
 * Turno de caída de cada palo, barajado.
 *
 * Devuelve las posiciones del aro en el orden en que se sueltan: `order[0]` es
 * el palo que cae primero. Fisher-Yates sembrado con la semilla de la tanda, así
 * que la secuencia es distinta en cada partida pero estable dentro de ella, y la
 * misma para todos los que juegan un mismo reto (`semilla.ts`).
 */
export function fallOrder(stickCount: number, seed: number): number[] {
  const order = Array.from({ length: Math.max(stickCount, 0) }, (_, i) => i)
  const azar = azarDesde(semillaDe(seed, HILO.orden))
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** Un número en [0, 1) propio de un palo y de lo que se sortea de él. */
function delPalo(seed: number, hilo: number, index: number): number {
  return azarDesde(semillaDe(seed, hilo, index))()
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
  seed: number,
  hoopHeight: number = MACHINE_HEIGHT,
): StickLayout[] {
  const order = fallOrder(stickCount, seed)
  const turnOf: number[] = []
  order.forEach((stickIndex, turn) => {
    turnOf[stickIndex] = turn
  })

  return Array.from({ length: stickCount }, (_, index) => {
    const t = stickCount === 1 ? 0.5 : (index + 1) / (stickCount + 1)
    return {
      key: `${seed}-${index}`,
      anchor: machinePoint(t, hoopHeight),
      // Un turno por palo, más un jitter para que no suene a metrónomo.
      delay: turnOf[index] * (1 + delPalo(seed, HILO.retardo, index) * 0.5),
      swingPhase: delPalo(seed, HILO.vaiven, index),
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
