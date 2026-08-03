import { describe, expect, it } from 'vitest'
import { MACHINE_HEIGHT, MACHINE_RADIUS, STICK_MISS_Y } from './gameConfig'

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
