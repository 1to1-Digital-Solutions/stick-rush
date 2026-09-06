import { GROUND_Y } from './gameConfig'
import { facingRotationY, GARLAND_RING_RADIUS, STALL_RING_RADIUS, type Vec3 } from './sceneryLayout'

/**
 * Dónde está el público de la feria.
 *
 * La feria tenía noria y casetas pero nadie dentro. El público son siluetas
 * —un cuerpo y una cabeza, sin cara— repartidas en un anillo entre los postes
 * de las guirnaldas y las casetas, todas mirando a la máquina. Se colocan con
 * un poco de desorden para que no parezcan una valla, y el desorden sale de un
 * hash y no de `Math.random`: la misma feria tiene la misma gente cada vez que
 * se monta, que es lo que deja medirla.
 */

/** Cuántas figuras. Van instanciadas: son una llamada de dibujo sean 10 o 100. */
export const CROWD_COUNT = 42
/** El anillo por el que se reparte, a medio camino entre guirnaldas y casetas. */
export const CROWD_RING_RADIUS = (GARLAND_RING_RADIUS + STALL_RING_RADIUS) / 2
/** Cuánto se sale cada figura del anillo, hacia dentro o hacia fuera, en metros. */
export const CROWD_RING_JITTER = 0.55
/** Estatura de la figura más baja y de la más alta, como escala de la silueta. */
export const CROWD_HEIGHT_RANGE: readonly [number, number] = [0.88, 1.12]

export interface CrowdSpot {
  position: Vec3
  /** Giro en Y que la deja mirando a la máquina. */
  rotationY: number
  /** Escala vertical: estatura relativa a la silueta base. */
  height: number
  /** Fase propia del vaivén, para que no se muevan todas a la vez. */
  phase: number
  /** Qué tono de la paleta viste (índice, a repartir con `%`). */
  shade: number
}

/** Un valor entre 0 y 1 a partir de un entero y una sal que separa usos. */
export function crowdHash(value: number, salt: number): number {
  let x = (value * 0x9e3779b1 + salt * 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  return x / 0x100000000
}

export function crowdSpots(count = CROWD_COUNT, radius = CROWD_RING_RADIUS): CrowdSpot[] {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    // Repartidas por el anillo con un poco de holgura en el ángulo: dos figuras
    // pueden quedar juntas, como la gente, pero nunca en el mismo sitio.
    const step = (Math.PI * 2) / Math.max(count, 1)
    const angle = index * step + (crowdHash(index, 1) - 0.5) * step * 0.8
    const distance = radius + (crowdHash(index, 2) - 0.5) * 2 * CROWD_RING_JITTER
    const position: Vec3 = [Math.sin(angle) * distance, GROUND_Y, Math.cos(angle) * distance]
    const [low, high] = CROWD_HEIGHT_RANGE
    return {
      position,
      rotationY: facingRotationY(position),
      height: low + crowdHash(index, 3) * (high - low),
      phase: crowdHash(index, 4) * Math.PI * 2,
      shade: Math.floor(crowdHash(index, 5) * 1024),
    }
  })
}
