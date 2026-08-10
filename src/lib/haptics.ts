/**
 * Vibración de los mandos (haptics de WebXR).
 *
 * En el visor el acierto se cuenta de tres formas a la vez: el palo destella en
 * verde, suena un "ding" y **el mando da un golpe**. La vibración es la única de
 * las tres que llega aunque el jugador esté mirando otro palo y tenga el sonido
 * quitado, y además cae en la mano que ha cogido el palo, así que confirma
 * *quién* lo cogió y no solo *que* se cogió.
 *
 * No hay nada que descargar: el motor del mando lo expone el propio WebXR en
 * `XRInputSource.gamepad.hapticActuators`, un array de actuadores con `pulse()`.
 * Fuera de una sesión inmersiva —el ratón en escritorio, o una mano desnuda sin
 * mando— no hay actuador y el juego sigue igual, sin vibración.
 *
 * Como en `sound.ts`, la receta son datos puros (probables sin navegador) y
 * `pulseHaptics` es lo único que habla con el hardware.
 */

/** Un golpe de vibración. */
export interface HapticPulse {
  /** Cuánto aprieta, de 0 (nada) a 1 (todo lo que dé el mando). */
  intensity: number
  /** Cuánto dura, en milisegundos. */
  durationMs: number
}

/**
 * El golpe del acierto: seco y corto.
 *
 * Corto a propósito. Una partida encadena hasta trece aciertos y el mando se
 * lleva pegado a la mano: alargarlo convertiría una racha en un zumbido
 * continuo, que deja de leerse como "otro palo" y empieza a molestar. Fuerte,
 * en cambio, sí: el golpe llega con el brazo en movimiento, que es cuando peor
 * se nota.
 */
export const CATCH_PULSE: HapticPulse = { intensity: 0.7, durationMs: 45 }

/** Lo único que se le pide al mando: dar un golpe. */
interface HapticActuator {
  pulse(value: number, duration: number): Promise<boolean>
}

/**
 * El motor de vibración del mando que ha disparado este evento, si lo hay.
 *
 * El evento llega de @pmndrs/pointer-events y trae en `pointerState` el estado
 * del puntero que lo produjo: para un mando de XR es su `XRControllerState`,
 * con el `inputSource` de WebXR dentro. El ratón y las manos desnudas no llevan
 * mando, y un mando sin motor (o un navegador que no implemente `pulse`) no
 * vibra: los tres casos son jugar sin vibración, no un fallo.
 *
 * Se usa el primer actuador: los mandos de visor declaran uno, y cuando hay
 * varios el primero es el del cuerpo del mando.
 */
function actuatorOf(event: unknown): HapticActuator | undefined {
  if (typeof event !== 'object' || event == null) return undefined
  const { pointerState } = event as { pointerState?: { inputSource?: XRInputSource } }
  const actuator = pointerState?.inputSource?.gamepad?.hapticActuators?.[0]
  return typeof actuator?.pulse === 'function' ? actuator : undefined
}

/**
 * ¿Lo devuelto por el mando es una promesa a la que agarrarse?
 *
 * La especificación dice que `pulse()` devuelve una, pero eso es una promesa
 * del navegador, no una garantía: encadenarle el `catch` a ciegas convertiría
 * un mando que devuelva otra cosa en un error en plena captura.
 */
function isPromise(value: unknown): value is Promise<unknown> {
  return typeof (value as Promise<unknown> | undefined)?.catch === 'function'
}

/**
 * Hace vibrar el mando que ha disparado `event`.
 *
 * @returns si el mando llegó a recibir el golpe. Con el ratón, con la mano
 *   desnuda o con un mando sin motor devuelve `false` y no ocurre nada.
 */
export function pulseHaptics(event: unknown, pulse: HapticPulse): boolean {
  const actuator = actuatorOf(event)
  if (actuator == null) return false

  // Que el mando se niegue a vibrar es un desenlace previsto —el visor ha
  // perdido el foco, la sesión se está cerrando— y significa jugar sin
  // vibración: el destello y el sonido siguen ahí. Se recogen sus dos formas
  // de negarse, porque llegan por caminos distintos: la promesa rechazada
  // (sin el `catch` sería un rechazo suelto por cada palo atrapado) y la
  // excepción en el acto, que subiría por el manejador del agarre y sí se
  // llevaría por delante lo que quede de la captura.
  try {
    const played: unknown = actuator.pulse(pulse.intensity, pulse.durationMs)
    if (isPromise(played)) void played.catch(() => {})
  } catch {
    return false
  }
  return true
}
