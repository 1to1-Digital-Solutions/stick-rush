/**
 * Anclaje de la interfaz inmersiva a la mirada del jugador.
 *
 * **El problema que resuelve.** Menú, marcador y botón de volver colgaban de
 * `<XROrigin>` en posiciones fijas con Z negativo. Pero el origen no es la
 * cabeza del jugador: es el origen del espacio de referencia de la sala, y su
 * −Z lo decide el sistema al crear la sesión (en un Quest, según cómo esté
 * calibrado el guardian). Si el jugador no entraba mirando justo hacia ese −Z,
 * la interfaz aparecía **a su espalda**: no veía el menú, no podía seleccionar
 * nada y el botón de salir era inalcanzable.
 *
 * **Cómo se resuelve.** Un grupo que se coloca bajo el jugador y gira con él,
 * de modo que la interfaz siempre cae dentro de su campo de visión. Pero no
 * pegada a la cara: seguir la mirada frame a frame marea y, sobre todo, hace
 * imposible apuntar (el objetivo huye del rayo). Así que hay una **zona
 * muerta**: mientras el jugador mire hacia la interfaz, esta se queda quieta y
 * se puede apuntar con calma; solo si se gira más de la cuenta, la interfaz le
 * alcanza con un giro suave y vuelve a quedarse quieta.
 *
 * Aquí vive solo la aritmética de ángulos, sin nada de three.js, para poder
 * probar el comportamiento sin navegador ni visor —que es justo lo que no se
 * pudo hacer con los punteros—. El componente `XRGazeAnchor` se limita a leer
 * la cámara y aplicar lo que decide `stepAnchor`.
 */

/**
 * Cuánto puede girar la cabeza antes de que la interfaz le siga, en radianes
 * (~40°). Es algo menos de medio campo de visión cómodo: al mirar de reojo la
 * interfaz sigue ahí, pero al volverse hacia otro lado viene detrás.
 */
export const XR_ANCHOR_DEADZONE = 0.7

/**
 * Cuánto tarda el reencuadre, como constante de tiempo exponencial (1/s).
 * Un valor alto persigue de forma brusca y marea; uno bajo se queda atrás.
 */
export const XR_ANCHOR_FOLLOW_SPEED = 3.5

/**
 * Desfase por debajo del cual se considera que el reencuadre ha terminado
 * (~1.7°). Sin esto, la interpolación exponencial nunca llega del todo y la
 * interfaz quedaría persiguiendo al jugador para siempre.
 */
export const XR_ANCHOR_SETTLE = 0.03

const TWO_PI = Math.PI * 2

/**
 * Lleva cualquier ángulo al rango [−π, π). La antípoda exacta es ambigua por
 * naturaleza (±π son el mismo ángulo) y se resuelve como −π.
 */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  const wrapped = (angle + Math.PI) % TWO_PI
  return (wrapped < 0 ? wrapped + TWO_PI : wrapped) - Math.PI
}

/**
 * Giro más corto para ir de `from` a `to`. Devuelve el sentido en el signo, y
 * nunca da la vuelta larga: de 170° a −170° son 20°, no 340°.
 */
export function angleDelta(from: number, to: number): number {
  return normalizeAngle(to - from)
}

/**
 * Fracción de interpolación de este frame, independiente del framerate.
 *
 * Un `factor * delta` a pelo cambia de comportamiento entre los 72 Hz de un
 * visor y los 120 de otro; la exponencial da el mismo recorrido en el mismo
 * tiempo real sea cual sea el número de frames.
 */
export function followRatio(
  delta: number,
  speed: number = XR_ANCHOR_FOLLOW_SPEED,
): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0
  return 1 - Math.exp(-speed * delta)
}

/** Acerca `current` a `target` por el camino corto, sin pasarse. */
export function approachAngle(
  current: number,
  target: number,
  ratio: number,
): number {
  const clamped = Math.min(Math.max(ratio, 0), 1)
  return normalizeAngle(current + angleDelta(current, target) * clamped)
}

/**
 * Estado del anclaje entre frames.
 *
 * `following` es lo que da la histéresis: se enciende al salirse de la zona
 * muerta y no se apaga hasta haber alcanzado al jugador. Sin él, la interfaz
 * se detendría en cuanto volviera a entrar en la zona muerta y quedaría
 * siempre torcida en el borde.
 */
export type AnchorState = {
  /** Orientación actual de la interfaz, en radianes. */
  yaw: number
  /** ¿Está reencuadrando ahora mismo? */
  following: boolean
}

export type AnchorOptions = {
  deadzone?: number
  speed?: number
  settle?: number
}

/** Estado inicial: la interfaz nace ya alineada con la mirada. */
export function initialAnchorState(yaw: number): AnchorState {
  return { yaw: normalizeAngle(yaw), following: false }
}

/**
 * Avanza el anclaje un frame.
 *
 * @param state    dónde está la interfaz ahora
 * @param gazeYaw  hacia dónde mira el jugador
 * @param delta    segundos transcurridos desde el frame anterior
 */
export function stepAnchor(
  state: AnchorState,
  gazeYaw: number,
  delta: number,
  options: AnchorOptions = {},
): AnchorState {
  const {
    deadzone = XR_ANCHOR_DEADZONE,
    speed = XR_ANCHOR_FOLLOW_SPEED,
    settle = XR_ANCHOR_SETTLE,
  } = options

  const target = normalizeAngle(gazeYaw)
  const offset = Math.abs(angleDelta(state.yaw, target))

  // Quieta y el jugador mirándola: no se toca, para poder apuntar con calma.
  if (!state.following && offset <= deadzone) {
    return state
  }

  // Se ha salido de la zona muerta: a partir de aquí persigue hasta alcanzarle.
  if (offset <= settle) {
    return { yaw: target, following: false }
  }

  return {
    yaw: approachAngle(state.yaw, target, followRatio(delta, speed)),
    following: true,
  }
}
