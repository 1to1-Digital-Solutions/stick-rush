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
 * Como en `sound.ts`, la receta son datos puros (probables sin navegador) y las
 * dos funciones de abajo son lo único que habla con el hardware. Hay dos porque
 * hay dos formas de saber a qué mando le toca vibrar: el acierto y la pulsación
 * de un botón vienen de un evento de puntero y se cobran en la mano que lo
 * produjo (`pulseHaptics`), mientras que el palo que toca el suelo no lo
 * produce nadie y se anuncia en los dos (`pulseAllHaptics`).
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

/**
 * El golpe del fallo: largo y blando, lo contrario del acierto.
 *
 * El sonido ya distingue acierto de fallo, así que la vibración tiene que
 * hacerlo también o dirá menos que él justo cuando el jugador la tiene por
 * única señal —mirando otro palo, o con el sonido quitado—. Se distinguen por
 * las dos cosas a la vez, como en el resto del juego: dura el triple y aprieta
 * la mitad, de modo que uno se siente como un golpe seco y el otro como un
 * lamento. Puede sonar en los dos mandos a la vez, y por eso conviene que sea
 * suave: no lo ha provocado ninguna de las dos manos.
 */
export const MISS_PULSE: HapticPulse = { intensity: 0.35, durationMs: 140 }

/**
 * El toque de un botón del menú inmersivo: lo justo para notar que se ha
 * activado.
 *
 * Los botones se pulsan **apuntando** con el rayo, así que la mano no toca
 * nada y no hay nada que confirme la pulsación salvo lo que cambie en la
 * escena, que a veces es un panel entero cambiando y a veces un palito que se
 * enciende al otro lado del menú. El más discreto de los tres golpes a
 * propósito: elegir trece palos son trece pulsaciones seguidas.
 */
export const PRESS_PULSE: HapticPulse = { intensity: 0.25, durationMs: 18 }

/** Lo único que se le pide al mando: dar un golpe. */
interface HapticActuator {
  pulse(value: number, duration: number): Promise<boolean>
}

/**
 * Lo único que se le pide a la sesión: quién tiene algo en la mano ahora mismo.
 *
 * `XRSession.inputSources` está vivo —los mandos entran y salen de la lista al
 * encenderse o dormirse—, así que se lee en el momento de vibrar y no se
 * guarda.
 */
export interface HapticSession {
  inputSources: Iterable<XRInputSource>
}

/**
 * El motor de vibración de un mando, si lo hay.
 *
 * El ratón y las manos desnudas no llevan mando, y un mando sin motor (o un
 * navegador que no implemente `pulse`) no vibra: los tres casos son jugar sin
 * vibración, no un fallo.
 *
 * Se usa el primer actuador: los mandos de visor declaran uno, y cuando hay
 * varios el primero es el del cuerpo del mando.
 */
function actuatorOf(inputSource: XRInputSource | undefined): HapticActuator | undefined {
  const actuator = inputSource?.gamepad?.hapticActuators?.[0]
  return typeof actuator?.pulse === 'function' ? actuator : undefined
}

/**
 * El mando que ha disparado este evento, si lo hay.
 *
 * El evento llega de @pmndrs/pointer-events y trae en `pointerState` el estado
 * del puntero que lo produjo: para un mando de XR es su `XRControllerState`,
 * con el `inputSource` de WebXR dentro.
 */
function inputSourceOf(event: unknown): XRInputSource | undefined {
  if (typeof event !== 'object' || event == null) return undefined
  const { pointerState } = event as { pointerState?: { inputSource?: XRInputSource } }
  return pointerState?.inputSource
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
 * Le pide el golpe a un motor de vibración concreto.
 *
 * Que el mando se niegue a vibrar es un desenlace previsto —el visor ha perdido
 * el foco, la sesión se está cerrando— y significa jugar sin vibración: el
 * destello y el sonido siguen ahí. Se recogen sus dos formas de negarse, porque
 * llegan por caminos distintos: la promesa rechazada (sin el `catch` sería un
 * rechazo suelto por cada palo atrapado) y la excepción en el acto, que subiría
 * por el manejador del agarre y sí se llevaría por delante lo que quede de la
 * captura.
 */
function fire(actuator: HapticActuator, pulse: HapticPulse): boolean {
  try {
    const played: unknown = actuator.pulse(pulse.intensity, pulse.durationMs)
    if (isPromise(played)) void played.catch(() => {})
  } catch {
    return false
  }
  return true
}

/**
 * Hace vibrar el mando que ha disparado `event`.
 *
 * @returns si el mando llegó a recibir el golpe. Con el ratón, con la mano
 *   desnuda o con un mando sin motor devuelve `false` y no ocurre nada.
 */
export function pulseHaptics(event: unknown, pulse: HapticPulse): boolean {
  const actuator = actuatorOf(inputSourceOf(event))
  if (actuator == null) return false
  return fire(actuator, pulse)
}

/**
 * Hace vibrar todos los mandos de la sesión.
 *
 * Para lo que no ha provocado ninguna mano: el palo que se escapa toca el suelo
 * solo, sin evento de puntero del que sacar un mando, así que el aviso va a las
 * dos —además, no saber en cuál se habría notado es parte de lo que significa—.
 * Un mando que se niegue a vibrar no impide que el otro lo haga.
 *
 * @returns cuántos mandos recibieron el golpe. Fuera de sesión, con las manos
 *   desnudas o con mandos sin motor devuelve 0 y no ocurre nada.
 */
export function pulseAllHaptics(
  session: HapticSession | null | undefined,
  pulse: HapticPulse,
): number {
  if (session == null) return 0

  let pulsed = 0
  for (const inputSource of session.inputSources) {
    const actuator = actuatorOf(inputSource)
    if (actuator != null && fire(actuator, pulse)) pulsed++
  }
  return pulsed
}
