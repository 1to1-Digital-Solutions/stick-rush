import { pulsesFor, type HandSide, type HandPulse, type HapticEvent } from './hapticFeedback'

/**
 * Vibración de los mandos (haptics de WebXR).
 *
 * **Lo que vibra es el contacto, y en la mano que toca** (`.claude/rules/xr.md`, «Cada
 * contacto se siente en la mano que toca, y nada más»). En este juego hay un solo contacto:
 * **atrapar un palo**. Se traduce a un `agarre` de las recetas comunes (`tactos.ts`), en la
 * mano que lo ha cogido, y con algo más de fuerza si se ha cogido in extremis, a punto de
 * tocar el suelo: ese es el que se celebra.
 *
 * Y lo que no es contacto no vibra. **El palo que se escapa ya no vibra**: antes daba un
 * golpe largo en los dos mandos, pero ninguna mano lo ha tocado, y el sonido y el palo rojo
 * en el suelo ya lo dicen. Lo que sí se conserva es el toque de un botón del menú
 * (`PRESS_PULSE`): no es un contacto con nada del juego, es la confirmación de que el rayo
 * ha pulsado, y va en la mano que apunta.
 *
 * No hay nada que descargar: el motor del mando lo expone el propio WebXR en
 * `XRInputSource.gamepad.hapticActuators`, un array de actuadores con `pulse()`.
 * Fuera de una sesión inmersiva —el ratón en escritorio, o una mano desnuda sin
 * mando— no hay actuador y el juego sigue igual, sin vibración.
 */

/** Un golpe de vibración. */
export interface HapticPulse {
  /** Cuánto aprieta, de 0 (nada) a 1 (todo lo que dé el mando). */
  intensity: number
  /** Cuánto dura, en milisegundos. */
  durationMs: number
}

/**
 * El toque de un botón del menú inmersivo: lo justo para notar que se ha
 * activado.
 *
 * Los botones se pulsan **apuntando** con el rayo, así que la mano no toca
 * nada y no hay nada que confirme la pulsación salvo lo que cambie en la
 * escena, que a veces es un panel entero cambiando y a veces un palito que se
 * enciende al otro lado del menú. Discreto a propósito: elegir trece palos son
 * trece pulsaciones seguidas.
 */
export const PRESS_PULSE: HapticPulse = { intensity: 0.25, durationMs: 18 }

/**
 * A partir de qué momento de la caída un palo se ha cogido **in extremis**: 0 recién
 * soltado, 1 tocando el suelo (`stickFallProgress`, en tiempo). Es el último quinto del
 * tiempo, que con el palo acelerando es algo más de un tercio del recorrido: el tramo en
 * que se escapa. A CALIBRAR CON EL VISOR.
 */
export const IN_EXTREMIS = 0.8

/**
 * Cuánto más fuerte se siente el palo cogido in extremis que uno cualquiera. Multiplica la
 * intensidad del `agarre` común (0,25 → 0,45): se tiene que notar distinto sin llegar a ser
 * un golpe. A CALIBRAR CON EL VISOR.
 */
export const IN_EXTREMIS_BOOST = 1.8

/** El contacto de atrapar un palo, dicho desde la mano que lo coge. */
export function tactoDelAtrape(mano: HandSide): HapticEvent {
  return { type: 'grab', hand: mano }
}

/**
 * Los pulsos de atrapar un palo con esa mano, cogido en ese punto de la caída.
 *
 * @param fallProgress cuánto había caído el palo al cogerlo, de 0 a 1.
 */
export function pulsosDelAtrape(mano: HandSide, fallProgress: number): HandPulse[] {
  const pulsos = pulsesFor(tactoDelAtrape(mano))
  if (!(fallProgress >= IN_EXTREMIS)) return pulsos
  return pulsos.map((p) => ({ ...p, intensity: Math.min(1, p.intensity * IN_EXTREMIS_BOOST) }))
}

/**
 * La mano que ha producido un evento de puntero, si es de un mando o de una mano de XR.
 *
 * El ratón no tiene mano, y una fuente sin lado (`'none'`) tampoco: a ninguna de las dos se
 * le puede cobrar un contacto.
 */
export function manoDelEvento(event: unknown): HandSide | null {
  const handedness = inputSourceOf(event)?.handedness
  return handedness === 'left' || handedness === 'right' ? handedness : null
}

/** Lo único que se le pide al mando: dar un golpe. */
interface HapticActuator {
  pulse(value: number, duration: number): Promise<boolean>
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

/** Cómo se programa un pulso que sale más tarde; `setTimeout` salvo en los tests. */
export type Programar = (hacer: () => void, ms: number) => () => void

const conSetTimeout: Programar = (hacer, ms) => {
  const id = setTimeout(hacer, ms)
  return () => clearTimeout(id)
}

/**
 * Reproduce unos pulsos en los mandos de su mano.
 *
 * Los que llevan `retardo` se programan; el resto sale en el acto. Devuelve cómo cancelar
 * los que quedan pendientes, para llamarlo al desmontar: un pulso que saliera después
 * vibraría por algo que ya no está.
 *
 * @param fuentes los mandos entre los que buscar el de cada mano: los de la sesión, o solo
 *   el que ha producido el evento.
 */
export function reproducirPulsos(
  fuentes: Iterable<XRInputSource | undefined>,
  pulsos: readonly HandPulse[],
  programar: Programar = conSetTimeout,
): () => void {
  const lista = [...fuentes]
  const pendientes: (() => void)[] = []
  for (const pulso of pulsos) {
    const actuator = actuatorOf(lista.find((fuente) => fuente?.handedness === pulso.hand))
    if (actuator == null) continue
    const golpe = { intensity: pulso.intensity, durationMs: pulso.ms }
    if (pulso.delay > 0) pendientes.push(programar(() => fire(actuator, golpe), pulso.delay))
    else fire(actuator, golpe)
  }
  return () => {
    for (const cancelar of pendientes) cancelar()
  }
}

/**
 * Hace sentir en su mano que ha atrapado un palo.
 *
 * @returns cómo cancelar lo que quede pendiente. Con el ratón, la mano desnuda o un mando
 *   sin motor no ocurre nada.
 */
export function pulsarAtrape(event: unknown, fallProgress: number): () => void {
  const mano = manoDelEvento(event)
  if (mano == null) return () => {}
  return reproducirPulsos([inputSourceOf(event)], pulsosDelAtrape(mano, fallProgress))
}
