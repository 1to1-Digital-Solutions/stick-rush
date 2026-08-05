import { describe, expect, it } from 'vitest'
import { MACHINE_HEIGHT, MACHINE_RADIUS, STICK_MISS_Y } from './gameConfig'
import { XR_ANCHOR_DEADZONE } from './xrAnchor'
import { canCatchWithPointer } from './xrInteraction'
import {
  XR_HUD_POSITION,
  XR_MENU_POSITION,
  XR_QUIT_POSITION,
  type Vec3,
  xrMenuExitPosition,
} from './xrLayout'

/**
 * La máquina tiene que quedar dentro de lo que el jugador alcanza con la mano.
 *
 * Los palos ya no se cogen apuntando con el mando sino agarrándolos, así que la
 * geometría deja de ser una cuestión estética: si el aro se aleja o se sube de
 * más, los palos pasan fuera del alcance y el juego se vuelve injugable en el
 * visor sin que ningún test de escritorio se entere.
 */

/** Alcance cómodo del brazo de un adulto desde el eje del cuerpo, en metros. */
const ARM_REACH = 0.75
/** Altura de hombro de referencia (adulto de pie). */
const SHOULDER_HEIGHT = 1.45

describe('la máquina queda al alcance de la mano', () => {
  it('el aro no se va más lejos que el brazo extendido', () => {
    expect(MACHINE_RADIUS).toBeLessThanOrEqual(ARM_REACH)
  })

  it('el aro queda por encima de la cabeza, sin golpearla', () => {
    // Por encima de una persona alta de pie, y por debajo de lo que dejaría los
    // palos colgando fuera de alcance.
    expect(MACHINE_HEIGHT).toBeGreaterThan(1.85)
    expect(MACHINE_HEIGHT).toBeLessThan(2.1)
  })

  it('los palos pasan por delante del jugador a altura de agarre', () => {
    // Recorren desde donde cuelgan hasta que se pierden: toda esa franja tiene
    // que cruzar la altura del hombro para poder cogerlos al vuelo.
    const highest = MACHINE_HEIGHT
    expect(highest).toBeGreaterThan(SHOULDER_HEIGHT)
    expect(STICK_MISS_Y).toBeLessThan(SHOULDER_HEIGHT)
  })

  it('la distancia diagonal al palo más lejano sigue siendo alcanzable', () => {
    // El peor caso es un palo en un extremo del semicírculo, recién soltado.
    const worstCase = Math.hypot(MACHINE_RADIUS, MACHINE_HEIGHT - SHOULDER_HEIGHT)
    expect(worstCase).toBeLessThanOrEqual(ARM_REACH + 0.15)
  })
})

/**
 * Ángulo horizontal de un punto respecto al frente del jugador (−Z), en
 * radianes. Siempre positivo: importa cuánto hay que girar, no hacia dónde.
 */
function gazeAngle([x, , z]: Vec3): number {
  return Math.abs(Math.atan2(x, -z))
}

describe('la interfaz cae dentro del campo de visión', () => {
  const elements: Array<[string, Vec3]> = [
    ['el menú', XR_MENU_POSITION],
    ['el marcador', XR_HUD_POSITION],
    ['el botón de salir de la partida', XR_QUIT_POSITION],
    ['el botón de salir del visor', xrMenuExitPosition()],
  ]

  it.each(elements)('%s se puede mirar sin que la interfaz huya', (_, position) => {
    // La relación que de verdad importa: si un elemento estuviera más allá de
    // la zona muerta, mirarlo haría girar todo el conjunto y el botón se
    // escaparía del rayo justo al intentar apuntarlo. Con margen, además, para
    // que no baste con rozar el límite.
    expect(gazeAngle(position)).toBeLessThan(XR_ANCHOR_DEADZONE * 0.85)
  })

  it.each(elements)('%s queda a una altura cómoda', (_, [, y]) => {
    // Por encima de la cintura y por debajo de tener que estirar el cuello.
    expect(y).toBeGreaterThan(0.85)
    expect(y).toBeLessThan(1.75)
  })

  it.each(elements)('%s queda al alcance del rayo, sin pegarse a la cara', (_, [x, , z]) => {
    const distance = Math.hypot(x, z)
    // Más cerca de medio metro y hay que bizquear; más lejos de metro y medio y
    // los objetivos pequeños del selector de palos se vuelven imposibles.
    expect(distance).toBeGreaterThan(0.5)
    expect(distance).toBeLessThan(1.5)
  })
})

describe('un palo se coge con la mano, no apuntando', () => {
  it('el agarre del mando y el contacto de la mano valen', () => {
    expect(canCatchWithPointer('grab')).toBe(true)
    expect(canCatchWithPointer('touch')).toBe(true)
  })

  it('el rayo no: apuntar desde lejos no atrapa nada', () => {
    // Es lo que distingue este juego de un shooter: el rayo llega a cualquier
    // distancia y convertiría atrapar los palos en apuntar y disparar. Se queda
    // solo para manejar el menú.
    expect(canCatchWithPointer('ray')).toBe(false)
  })

  it('el ratón sigue valiendo, que es como se juega en escritorio', () => {
    expect(canCatchWithPointer('mouse')).toBe(true)
    // Los eventos de ratón no siempre traen el tipo de puntero.
    expect(canCatchWithPointer(undefined)).toBe(true)
  })

  it('un puntero nuevo de la librería puede coger palos por defecto', () => {
    // Preferimos que algo desconocido funcione a que deje de responder sin que
    // nadie se entere: el único caso que se cierra es el rayo, explícitamente.
    expect(canCatchWithPointer('lines')).toBe(true)
  })
})
