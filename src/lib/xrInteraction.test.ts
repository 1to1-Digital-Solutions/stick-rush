import { describe, expect, it } from 'vitest'
import {
  MACHINE_HEIGHT,
  MACHINE_RADIUS,
  PLAYER_OFFSET_Z,
  PLAYER_SHOULDER_HEIGHT,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  distanceFromPlayer,
  machinePoint,
} from './gameConfig'
import { XR_ANCHOR_DEADZONE } from './xrAnchor'
import { canCatchStick, canCatchWithPointer } from './xrInteraction'
import {
  XR_HUD_POSITION,
  XR_MENU_POSITION,
  XR_QUIT_POSITION,
  XR_QUIT_YAW,
  type Vec3,
  xrMenuExitPosition,
  xrMenuSoundPosition,
} from './xrLayout'

/**
 * La máquina tiene que quedar dentro de lo que el jugador alcanza con la mano.
 *
 * Los palos ya no se cogen apuntando con el mando sino agarrándolos, así que la
 * geometría deja de ser una cuestión estética: si el aro se aleja o se sube de
 * más, los palos pasan fuera del alcance y el juego se vuelve injugable en el
 * visor sin que ningún test de escritorio se entere.
 */

/** Alcance cómodo del brazo de un adulto desde el hombro, en metros. */
const ARM_REACH = 0.75

/** Centro del palo colgado del punto `t` del aro, antes de empezar a caer. */
function hangingStickCenter(t: number): [number, number, number] {
  const [x, y, z] = machinePoint(t)
  return [x, y - STICK_CORD_LENGTH - STICK_LENGTH / 2, z]
}

describe('la máquina queda al alcance de la mano', () => {
  it('el aro queda por encima de la cabeza, sin golpearla', () => {
    // Por encima de una persona alta de pie, y por debajo de lo que dejaría los
    // palos colgando fuera de alcance.
    expect(MACHINE_HEIGHT).toBeGreaterThan(1.85)
    expect(MACHINE_HEIGHT).toBeLessThan(2.1)
  })

  it('los palos pasan por delante del jugador a altura de agarre', () => {
    // Recorren desde donde cuelgan hasta que se pierden: toda esa franja tiene
    // que cruzar la altura del hombro para poder cogerlos al vuelo.
    expect(MACHINE_HEIGHT).toBeGreaterThan(PLAYER_SHOULDER_HEIGHT)
    expect(STICK_MISS_Y).toBeLessThan(PLAYER_SHOULDER_HEIGHT)
  })

  it('ningún palo del aro queda fuera del brazo extendido', () => {
    // Se mide desde donde está el jugador de verdad, que no es el centro del
    // aro: va adelantado (`PLAYER_OFFSET_Z`) porque el semicírculo solo cubre
    // su frente. El peor caso son los extremos, que con ese adelanto quedan más
    // lejos que el palo del centro.
    for (let i = 0; i <= 20; i++) {
      expect(distanceFromPlayer(hangingStickCenter(i / 20))).toBeLessThanOrEqual(
        ARM_REACH,
      )
    }
  })

  it('el jugador va adelantado, pero sin dejarse palos a la espalda', () => {
    // Si se adelantara más que los extremos del aro, los palos de los lados le
    // caerían por detrás y no los vería venir.
    expect(PLAYER_OFFSET_Z).toBeLessThan(0)
    expect(PLAYER_OFFSET_Z).toBeGreaterThan(-MACHINE_RADIUS / 2)
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
    ['el botón de volver al menú', XR_QUIT_POSITION],
    ['el botón de salir del visor', xrMenuExitPosition()],
    ['el botón de silenciar', xrMenuSoundPosition()],
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

  it('el botón de volver al menú encara al jugador', () => {
    // Está apartado a un lado, así que es el único que gira. Y tiene que girar
    // justo lo que pide su posición: de canto, la placa se estrecha y su propio
    // borde se adelanta por delante del icono hasta comérselo.
    const [x, , z] = XR_QUIT_POSITION
    // Normal de la placa tras el giro, en el plano horizontal.
    const normal = [Math.sin(XR_QUIT_YAW), Math.cos(XR_QUIT_YAW)]
    const toPlayer = [-x, -z]
    const reach = Math.hypot(...toPlayer)
    const alignment =
      (normal[0] * toPlayer[0] + normal[1] * toPlayer[1]) / reach

    expect(alignment).toBeCloseTo(1)
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

describe('un palo se coge hasta que toca el suelo', () => {
  it('vale cogerlo mientras todavía cuelga del aro', () => {
    // Decisión de producto: adelantarse al palo es jugar, no hacer trampa. Si
    // este caso se cerrara habría que rehacer el bonus por reflejos, que hoy
    // paga el máximo justo por cogerlo antes de que caiga.
    expect(canCatchStick('hanging', false)).toBe(true)
  })

  it('vale cogerlo al vuelo, que es el caso normal', () => {
    expect(canCatchStick('falling', false)).toBe(true)
  })

  it('el palo que ya tocó el suelo no se recoge', () => {
    // Se queda tirado para que el suelo cuente los fallos, pero es decorado:
    // recogerlo borraría un fallo ya consumado.
    expect(canCatchStick('missed', false)).toBe(false)
  })

  it('el palo ya atrapado no vuelve a contar', () => {
    // Los dos mandos del visor pueden alcanzar el mismo palo en el mismo frame.
    expect(canCatchStick('caught', false)).toBe(false)
  })

  it('con la partida parada no se coge nada, cuelgue o caiga', () => {
    // La cuenta atrás entra aquí: durante esos tres segundos los palos cuelgan
    // a la vista y quietos, y sin esta guarda se vaciaba el aro a clics antes
    // de que empezara la partida.
    expect(canCatchStick('hanging', true)).toBe(false)
    expect(canCatchStick('falling', true)).toBe(false)
  })
})
