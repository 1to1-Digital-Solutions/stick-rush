import { gameStorage } from './storage'

/**
 * Guion del tutorial que se ve dentro del visor la primera vez.
 *
 * **El problema que resuelve.** Con las gafas puestas, quien llega por primera
 * vez no sabe que los palos se agarran ni con qué botón: el menú inmersivo se
 * maneja con el rayo del mando, así que lo primero que aprende es justo lo que
 * *no* sirve para jugar. Se perdía gente en el momento de enseñárselo.
 *
 * **Cómo se resuelve.** Una demostración de unos siete segundos entre pulsar
 * «empezar» y la cuenta atrás: el mando con su gatillo de agarre marcado
 * cogiendo un palo, cuántos palos van a caer y en qué nivel. Sin una sola
 * letra, como el resto de la interfaz inmersiva (`<Text>` de drei descarga las
 * fuentes de un CDN que la CSP bloquea), así que cada cosa se dice con la
 * geometría que ya significa eso en el juego.
 *
 * **Corto de verdad.** La duración total está acotada entre
 * `TUTORIAL_MIN_SECONDS` y `TUTORIAL_MAX_SECONDS`: por debajo no da tiempo a
 * leer nada y por encima estorba a quien solo quiere jugar. Un test lo vigila,
 * de modo que alargar un paso obliga a acortar otro.
 *
 * Aquí solo vive el guion —qué se enseña, cuánto dura y si ya se ha visto—, sin
 * three.js ni React, para poder probarlo sin navegador ni visor.
 */

/** Qué enseña cada tramo de la demostración. */
export type TutorialStepKey =
  /** El gatillo que agarra, marcado sobre el mando, cogiendo un palo. */
  | 'grab'
  /** Cuántos palos van a caer: tantos como se hayan elegido. */
  | 'sticks'
  /** En qué nivel se juega, con las barras del menú. */
  | 'level'

export interface TutorialStep {
  key: TutorialStepKey
  /** Cuánto dura en pantalla, en segundos. */
  seconds: number
}

/**
 * Los tres tramos, en orden. El del agarre es el más largo porque es el único
 * que enseña un gesto —y lo repite dos veces—; los otros dos solo enseñan un
 * número y un nivel que el jugador acaba de elegir.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { key: 'grab', seconds: 3.4 },
  { key: 'sticks', seconds: 2.2 },
  { key: 'level', seconds: 1.8 },
]

/** Lo mínimo para que dé tiempo a entender los tres tramos. */
export const TUTORIAL_MIN_SECONDS = 5
/** Lo máximo antes de que estorbe a quien solo quiere empezar a jugar. */
export const TUTORIAL_MAX_SECONDS = 10

/** Lo que dura la demostración entera, en segundos. */
export const TUTORIAL_SECONDS = TUTORIAL_STEPS.reduce(
  (total, step) => total + step.seconds,
  0,
)

export interface TutorialFrame {
  /** Tramo que toca enseñar, o `null` cuando la demostración ya ha acabado. */
  step: TutorialStepKey | null
  /** Cuánto lleva recorrido ese tramo, de 0 a 1. */
  stepProgress: number
  /** Cuánto lleva recorrido el tutorial entero, de 0 a 1. */
  progress: number
  done: boolean
}

/** Estado del tutorial cuando ya no queda nada que enseñar. */
const FINISHED: TutorialFrame = {
  step: null,
  stepProgress: 1,
  progress: 1,
  done: true,
}

/**
 * Qué se está enseñando a los `elapsed` segundos de arrancar.
 *
 * El reloj lo lleva quien pinta la escena, fotograma a fotograma, así que esto
 * es una función del tiempo y no una máquina de estados: no hay nada que
 * sincronizar si un fotograma llega tarde o si el visor baja de frecuencia.
 */
export function tutorialFrameAt(elapsed: number): TutorialFrame {
  if (!Number.isFinite(elapsed)) return FINISHED
  const time = Math.max(0, elapsed)
  if (time >= TUTORIAL_SECONDS) return FINISHED

  let start = 0
  for (const step of TUTORIAL_STEPS) {
    const end = start + step.seconds
    if (time < end) {
      return {
        step: step.key,
        stepProgress: (time - start) / step.seconds,
        progress: time / TUTORIAL_SECONDS,
        done: false,
      }
    }
    start = end
  }

  return FINISHED
}

/**
 * Dónde se recuerda que el tutorial ya se ha visto. Con prefijo, como el récord
 * y la altura del aro, para no chocar con nada más del mismo origen.
 */
export const TUTORIAL_SEEN_KEY = 'stick-rush:tutorial-seen'

/** Lo que se escribe cuando ya se ha visto. */
const SEEN_VALUE = '1'

/**
 * Interpreta lo leído del almacenamiento.
 *
 * Es entrada externa —cualquiera puede editarla desde las herramientas del
 * navegador—, así que solo el valor exacto cuenta como visto. Cualquier otra
 * cosa se trata como "aún no", que es el lado seguro: enseñar el tutorial de
 * más cuesta siete segundos saltables, y no enseñarlo deja a alguien sin saber
 * cómo se juega.
 */
export function parseTutorialSeen(raw: string | null): boolean {
  return raw === SEEN_VALUE
}

/** ¿Ya se vio el tutorial en este navegador? */
export function readTutorialSeen(storage: Storage | null): boolean {
  if (!storage) return false
  try {
    return parseTutorialSeen(storage.getItem(TUTORIAL_SEEN_KEY))
  } catch {
    // Almacenamiento bloqueado: se enseña otra vez, que es preferible a dar por
    // sabido algo que quizá no se ha visto nunca.
    return false
  }
}

/** Recuerda que ya se ha visto, para no volver a interponerlo. */
export function writeTutorialSeen(storage: Storage | null): void {
  if (!storage) return
  try {
    storage.setItem(TUTORIAL_SEEN_KEY, SEEN_VALUE)
  } catch {
    // Cuota agotada o escritura prohibida: el tutorial volverá a salir en la
    // próxima visita. Es saltable, así que no justifica ningún aviso.
  }
}

/** Si el tutorial ya se vio en este navegador. */
export function getTutorialSeen(): boolean {
  return readTutorialSeen(gameStorage())
}

/** Anota que el tutorial se ha visto (entero o saltado: ya lo ha decidido). */
export function saveTutorialSeen(): void {
  writeTutorialSeen(gameStorage())
}
