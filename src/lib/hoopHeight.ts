import { MACHINE_HEIGHT, STICK_FALL_DISTANCE, STICK_MISS_Y } from './gameConfig'
import { gameStorage } from './storage'

/**
 * A qué altura queda el aro para quien está jugando.
 *
 * **El problema que resuelve.** `MACHINE_HEIGHT` es una cota fija, elegida para
 * una persona de pie de estatura media. De pie está bien; sentado, o con
 * alguien más bajo, el mismo aro queda por encima de la cabeza y los palos
 * pasan fuera del alcance del brazo. El juego se vuelve injugable sin que nada
 * falle.
 *
 * **Cómo se resuelve.** La altura sale de la del visor: el aro se planta
 * `HOOP_RISE_ABOVE_EYES` por encima de los ojos, que es la relación con la que
 * se diseñó la máquina. Encima hay una corrección manual, porque el dato del
 * visor no siempre está disponible ni siempre acierta: quien juega sentado en
 * un sofá con el espacio calibrado de pie necesita bajarlo a mano.
 *
 * **El dato del visor solo vale con el suelo puesto.** WebXR entrega la pose de
 * la cabeza dentro de un espacio de referencia, y solo los de tipo `*-floor`
 * tienen el origen en el suelo: en un `local` la cabeza nace en el cero y su
 * cota no dice nada de la estatura. Por eso `headsetEyeHeight` exige que la
 * sesión traiga `local-floor`; cuando no lo trae no se inventa nada y el ajuste
 * manual se queda como única forma de acomodar el aro.
 *
 * Los dos límites del enunciado —ni inalcanzable, ni dentro del suelo— se
 * sostienen con dos vallas distintas: el ajuste manual está acotado **respecto
 * a quien juega** (`HOOP_ADJUST_RANGE`, lo que separa el aro del brazo), y por
 * encima hay un tope absoluto (`HOOP_MIN_HEIGHT`/`HOOP_MAX_HEIGHT`) por si el
 * dato de partida es disparatado.
 *
 * Aquí solo vive la aritmética, sin three.js ni React, para poder probar el
 * comportamiento sin navegador ni visor.
 */

/**
 * Altura de ojos de la persona con la que se diseñó la escena: una de pie, de
 * estatura media. Para ella se eligieron `MACHINE_HEIGHT` y las cotas de la
 * interfaz inmersiva (`@/lib/xrLayout`), así que las dos cuelgan de aquí. Sin
 * dato del visor, todo se queda donde ha estado siempre.
 */
export const REFERENCE_EYE_HEIGHT = 1.6

/**
 * Cuánto queda el aro por encima de los ojos en el visor. Es la relación que hace jugable
 * la máquina —los palos cuelgan por encima del pecho y caen atravesándolo, que es donde la
 * mano llega cómoda—, así que es lo que se conserva al cambiar de jugador.
 *
 * **Era `MACHINE_HEIGHT − REFERENCE_EYE_HEIGHT` (35 cm) y se ha subido a 50** (con el
 * visor: «la máquina más alta»). Ya no sale de la cota de escritorio: con 35 cm los palos
 * colgaban a la altura de la cara; con 50 cuelgan por encima y bajan hasta la mano. El
 * escritorio sigue en `MACHINE_HEIGHT`, que es lo que ve su cámara. El recorrido más largo
 * no cambia la dificultad: la velocidad se escala con él (`hoopFallSpeed`).
 *
 * A CALIBRAR CON EL VISOR.
 */
export const HOOP_RISE_ABOVE_EYES = 0.5

/**
 * Alturas de ojos que se aceptan como las de una persona, en metros: desde
 * sentado en el suelo hasta alguien muy alto de pie. Fuera de ahí la medida no
 * es una estatura sino un espacio de referencia mal entendido (o un visor sobre
 * la mesa), y se descarta.
 *
 * **Las mismas que en los otros doce.** El tope estaba en 2,0, que son los ojos de alguien
 * de 2,15: existe, y en este juego se le dejaba sin corregir la altura mientras en los demás
 * sí. Cada repo escribe estas cifras donde quiere —aquí, en `uiHeight.ts`, dentro de
 * `xrLayout.ts`— así que no las comparaba nadie; ahora sí, en `scripts/repos/comunes.py`.
 */
export const MIN_EYE_HEIGHT = 0.9
export const MAX_EYE_HEIGHT = 2.2

/**
 * Cuánto se puede corregir la altura a mano, arriba o abajo, en metros.
 *
 * No es un número redondo elegido a ojo: lo manda el brazo. Los palos cuelgan a
 * unos 60 cm del jugador en horizontal y el alcance cómodo son 75, así que
 * queda algo menos de 26 cm de margen vertical antes de que el aro se salga de
 * lo que se toca sin moverse del sitio (`hoopHeight.test.ts` lo comprueba palo a
 * palo). Hacia abajo el límite es el mismo por simetría, y deja el aro 15 cm
 * sobre los ojos: justo por encima de la cabeza, que es donde tiene que estar.
 */
export const HOOP_ADJUST_RANGE = 0.2

/** Cuánto sube o baja el aro por cada toque, en metros. */
export const HOOP_ADJUST_STEP = 0.05

/**
 * Topes absolutos, en metros. Son la última valla, no el ajuste: con un dato de
 * partida razonable nunca llegan a morder. Están para que ninguna medida
 * disparatada acabe metiendo el aro en el suelo —los palos necesitan recorrido
 * para caer— ni colgándolo del techo.
 */
export const HOOP_MIN_HEIGHT = 1.05
export const HOOP_MAX_HEIGHT = 2.6

/** ¿Puede esa medida ser la altura de ojos de una persona? */
export function isPlausibleEyeHeight(
  value: number | null | undefined,
): value is number {
  return (
    value != null &&
    Number.isFinite(value) &&
    value >= MIN_EYE_HEIGHT &&
    value <= MAX_EYE_HEIGHT
  )
}

/**
 * Altura de ojos que entrega el visor, o `null` si no hay dato en el que
 * apoyarse.
 *
 * @param cameraY    cota de la cabeza sobre el origen de la sesión, en metros
 * @param floorLevel si ese origen está en el suelo (espacio `*-floor`)
 */
export function headsetEyeHeight(
  cameraY: number,
  floorLevel: boolean,
): number | null {
  // Sin suelo el origen es el punto donde arrancó la sesión, y la cota de la
  // cabeza mide desde ahí: no es una estatura y no se puede usar como tal.
  if (!floorLevel) return null
  return isPlausibleEyeHeight(cameraY) ? cameraY : null
}

/**
 * ¿Tiene esta sesión el origen en el suelo, a la vista de las prestaciones que
 * dice haber habilitado?
 *
 * `local-floor` se pide como **requerida** al abrir la sesión (lo hace
 * @react-three/xr, ver `xrStore.ts`), así que una sesión viva la tiene por
 * fuerza: sin ella el visor habría rechazado abrirla. Pero `enabledFeatures` es
 * opcional en la especificación y hay navegadores que no la publican, y ahí
 * exigirla equivale a renunciar a medir al jugador en visores donde el dato es
 * perfectamente bueno. Cuando la lista falta se da por buena, que es lo que la
 * sesión garantiza; y si aun así el espacio no fuera de suelo, la cota nacería
 * cerca del cero y `isPlausibleEyeHeight` la descartaría igual.
 */
export function hasFloorReference(
  enabledFeatures: readonly string[] | null | undefined,
): boolean {
  if (enabledFeatures == null) return true
  return (
    enabledFeatures.includes('local-floor') ||
    enabledFeatures.includes('bounded-floor')
  )
}

/** Deja la corrección manual dentro de lo que se permite mover el aro. */
export function clampHoopAdjustment(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(HOOP_ADJUST_RANGE, Math.max(-HOOP_ADJUST_RANGE, value))
}

export type HoopHeightInput = {
  /** Lo que dice el visor, o `null`/`undefined` si no lo dice. */
  eyeHeight?: number | null
  /** Corrección manual, en metros. */
  adjustment?: number
}

/**
 * Altura del aro para quien está jugando, en metros.
 *
 * Con la altura del visor, `HOOP_RISE_ABOVE_EYES` sobre los ojos; sin ella —escritorio, o un
 * visor que no dice dónde está el suelo—, la cota nominal `MACHINE_HEIGHT`. En los dos casos
 * con la corrección manual encima.
 */
export function hoopHeightFor({
  eyeHeight,
  adjustment = 0,
}: HoopHeightInput): number {
  const base = isPlausibleEyeHeight(eyeHeight)
    ? eyeHeight + HOOP_RISE_ABOVE_EYES
    : MACHINE_HEIGHT
  const height = base + clampHoopAdjustment(adjustment)
  return Math.min(HOOP_MAX_HEIGHT, Math.max(HOOP_MIN_HEIGHT, height))
}

/**
 * Velocidad media de caída corregida para la altura del aro (de ella sale la
 * aceleración del palo, ver `fallAcceleration`).
 *
 * Subir el aro alarga el recorrido hasta el suelo, así que con la misma
 * velocidad media el palo tardaría más en llegar y cada estatura jugaría una dificultad distinta.
 * Se escala con el recorrido para que Fácil dure lo mismo para todo el mundo:
 * acomodar el aro es ergonomía, no una ventaja. Es también lo que mantiene
 * válidos los tiempos que vigila `gameConfig.test.ts`.
 */
export function hoopFallSpeed(speed: number, hoopHeight: number): number {
  const distance = hoopHeight - STICK_MISS_Y
  if (!Number.isFinite(distance) || distance <= 0) return speed
  return speed * (distance / STICK_FALL_DISTANCE)
}

/**
 * Dónde se guarda la corrección manual. Con prefijo, como el récord, para no
 * chocar con nada más del mismo origen.
 */
export const HOOP_ADJUST_KEY = 'stick-rush:hoop-adjust'

/**
 * Interpreta lo leído del almacenamiento.
 *
 * Es entrada externa —cualquiera puede editarla desde las herramientas del
 * navegador—, así que se acota igual que si viniera del menú: lo que no se
 * entienda cuenta como "sin corrección" en vez de propagar un `NaN` a la
 * geometría de la escena.
 */
export function parseHoopAdjustment(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 0
  return clampHoopAdjustment(Number(raw))
}

/** Corrección guardada, o 0 si no hay ninguna legible. */
export function readHoopAdjustment(storage: Storage | null): number {
  if (!storage) return 0
  try {
    return parseHoopAdjustment(storage.getItem(HOOP_ADJUST_KEY))
  } catch {
    // Almacenamiento bloqueado: se juega con el aro donde lo deje el visor.
    return 0
  }
}

/** Guarda la corrección, ya acotada, para la próxima partida y la próxima visita. */
export function writeHoopAdjustment(
  storage: Storage | null,
  value: number,
): void {
  if (!storage || !Number.isFinite(value)) return
  try {
    storage.setItem(HOOP_ADJUST_KEY, String(clampHoopAdjustment(value)))
  } catch {
    // Cuota agotada o escritura prohibida: el aro se queda donde está durante
    // esta visita, y la siguiente vuelve a empezar. No es motivo para
    // interrumpir el juego con un aviso.
  }
}

/** Corrección con la que arranca el juego en este navegador. */
export function getHoopAdjustment(): number {
  return readHoopAdjustment(gameStorage())
}

/** Recuerda la corrección elegida en el menú del visor. */
export function saveHoopAdjustment(value: number): void {
  writeHoopAdjustment(gameStorage(), value)
}
