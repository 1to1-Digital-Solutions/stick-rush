/**
 * Qué palo toca la mano o el ratón: la parte de los punteros de la web (`@pmndrs/pointer-events`)
 * que en Godot no hay, en cuentas sin motor.
 *
 * - **Con la mano** (`grab`): en la web, una esfera en el puño (`DefaultXRControllerGrabPointer`)
 *   que dispara `pointerdown` sobre lo que toca al **apretar** el gatillo lateral. Aquí igual: al
 *   apretar, el palo cuyo cuerpo queda a menos del radio de esa esfera del centro del puño; si hay
 *   varios, el más cercano, que es el que el puntero de la web elige.
 * - **Con el ratón**: el rayo de la cámara contra el cilindro de cada palo; gana el primero que
 *   corta, como el `raycast` de three.
 *
 * El cuerpo del palo se toma como un segmento con el grosor del palo (`STICK_RADIUS`): la cápsula
 * que lo envuelve, que en las puntas se pasa medio grosor de lo que es el cilindro.
 */
import { STICK_RADIUS } from '@/lib/gameConfig'

import { cuerpoDelPalo, type Palo, type Vec3 } from './round'

/**
 * El radio de la esfera de agarre del mando en la web (`CONTROLLER_GRAB_RADIUS` de
 * `components/xr/XRController.tsx`, que es de React y no se puede importar aquí): 9 cm, algo más que
 * los 7 por defecto de la librería, porque el palo es fino y cae.
 */
export const RADIO_DEL_AGARRE = 0.09

function resta(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function punto(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function largo(a: Vec3): number {
  return Math.sqrt(punto(a, a))
}

/** La distancia de un punto al segmento `a`–`b`. */
export function distanciaAlSegmento(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = resta(b, a)
  const l2 = punto(ab, ab)
  const t = l2 > 0 ? Math.min(1, Math.max(0, punto(resta(p, a), ab) / l2)) : 0
  return largo(resta(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]))
}

/**
 * Lo más que se acercan un rayo (origen `o`, dirección `d`, unitaria) y el segmento `a`–`b`, y a qué
 * distancia del origen del rayo: los puntos más cercanos de dos rectas, con el del segmento dentro
 * de él y el del rayo por delante de su origen. Rayo y palo paralelos se resuelven desde la punta de
 * arriba.
 */
export function rayoContraSegmento(o: Vec3, d: Vec3, a: Vec3, b: Vec3): { distancia: number; lejos: number } {
  const u = resta(b, a)
  const w = resta(a, o)
  const uu = punto(u, u)
  const ud = punto(u, d)
  const uw = punto(u, w)
  const dw = punto(d, w)
  // Con `d` unitaria: el segmento en `a + s·u`, el rayo en `o + t·d`.
  const det = uu - ud * ud
  let s = det > 1e-12 ? (ud * dw - uw) / det : 0
  s = Math.min(1, Math.max(0, s))
  const q: Vec3 = [a[0] + u[0] * s, a[1] + u[1] * s, a[2] + u[2] * s]
  const lejos = Math.max(0, punto(resta(q, o), d))
  const cerca: Vec3 = [o[0] + d[0] * lejos, o[1] + d[1] * lejos, o[2] + d[2] * lejos]
  return { distancia: largo(resta(q, cerca)), lejos }
}

/** El palo que coge una mano cerrada en `puno` (en el espacio de la máquina), o `null`. */
export function paloEnLaMano(palos: readonly Palo[], puno: Vec3, radio = RADIO_DEL_AGARRE): Palo | null {
  let elegido: Palo | null = null
  let cerca = Infinity
  for (const palo of palos) {
    const { arriba, abajo } = cuerpoDelPalo(palo)
    const d = distanciaAlSegmento(puno, arriba, abajo)
    if (d <= radio + STICK_RADIUS && d < cerca) {
      elegido = palo
      cerca = d
    }
  }
  return elegido
}

/** El palo que corta el rayo del ratón (en el espacio de la máquina), el primero, o `null`. */
export function paloEnElRayo(palos: readonly Palo[], origen: Vec3, direccion: Vec3): Palo | null {
  let elegido: Palo | null = null
  let primero = Infinity
  for (const palo of palos) {
    const { arriba, abajo } = cuerpoDelPalo(palo)
    const { distancia, lejos } = rayoContraSegmento(origen, direccion, arriba, abajo)
    if (distancia <= STICK_RADIUS && lejos < primero) {
      elegido = palo
      primero = lejos
    }
  }
  return elegido
}
