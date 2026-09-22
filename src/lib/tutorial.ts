import { gameStorage } from './storage'
import type { TextKey } from './textos'

/**
 * El tutorial que se ve dentro del visor la primera vez.
 *
 * **El problema que resuelve.** Con las gafas puestas, quien llega nuevo no sabe que los
 * palos se agarran: el menú inmersivo se maneja con el rayo del mando, así que lo primero
 * que aprende es justo lo que **no** sirve para jugar —apuntar desde lejos no atrapa nada
 * (ver `xrInteraction.ts`)—.
 *
 * **Y cómo se resolvía mal.** Era un pase de diapositivas por reloj, con la partida en
 * espera: tres tramos —un mando con un palo cayéndole encima, cuántos palos venían y en qué
 * nivel— y al agotarse los segundos se daba por aprendido. Quien lo miraba sin hacer nada
 * salía igual que entró, y de propina era el único de la flota con un tutorial propio: dos
 * paneles distintos que mantener y, el día de portarlo a Godot, dos portes.
 *
 * **Cómo se resuelve ahora: por hitos.** Cada paso se supera **atrapando un palo**. La
 * partida no se para —los palos caen mientras se explica—, y el panel espera a que pase lo
 * que tiene que pasar en vez de contar segundos. Cada paso lleva además un **plazo de
 * seguridad** por si alguien se queda mirando: se pasa solo, porque un paso que no se
 * consiga dejaría a alguien encerrado en él. Y siempre hay salida a mano: siguiente y saltar.
 *
 * Aquí vive solo el guion —qué pasos hay, qué los supera, cuánto esperan y si ya se ha
 * visto—, sin three ni React, para poder probarlo sin navegador ni visor.
 */

/** Qué enseña cada paso, y qué hay que hacer para superarlo. */
export type TutorialStepKey =
  /** Cerrar la mano sobre un palo: se supera al atrapar el primero. */
  | 'grab'
  /** Que caen por todas partes: se supera al atrapar otro, que obliga a buscarlo. */
  | 'around'

/** Los pasos, en orden. */
export const TUTORIAL_STEPS: readonly TutorialStepKey[] = ['grab', 'around']

/**
 * Qué botón del mando enseña cada paso, para dibujarlo resaltado.
 *
 * **Es la mitad de la lección.** Una frase que dice «el botón de agarre» solo sirve a quien ya
 * sabe cuál es; con el visor puesto, lo que hay en la mano es un mando con cinco botones y
 * ninguno con su nombre escrito. `null` es un paso que no va de apretar nada.
 */
export type BotonDelMando = 'agarre' | 'gatillo'

export const TUTORIAL_BUTTONS: Record<TutorialStepKey, BotonDelMando | null> = {
  grab: 'agarre',
  // El segundo paso no enseña otro botón: es el mismo gesto, mirando a otro lado. Repetir la
  // marca sobre el mando aquí la convertiría en decorado, y de paso taparía el palo que hay
  // que ir a buscar justo cuando toca buscarlo.
  around: null,
}

/**
 * Cómo llama WebXR a cada uno de esos botones.
 *
 * Es el puente entre el nombre de andar por casa —el que se usa al escribir la lección— y el
 * identificador del perfil de mando, que es con el que se encuentra la pieza dentro del
 * modelo 3D cuando el tutorial lo enseña a tamaño real sobre la mano (`MandoDeVerdad.tsx`).
 * Los dos nombres son los del estándar y valen para cualquier mando, no solo para los de
 * Quest.
 */
export const COMPONENTE_DEL_BOTON: Record<BotonDelMando, string> = {
  agarre: 'xr-standard-squeeze',
  gatillo: 'xr-standard-trigger',
}

/**
 * Lo que se pide en cada paso, con un mando en la mano.
 *
 * Las frases viven aquí y no en el panel que las pinta porque **las enseñan dos sitios**: el
 * panel del visor y su reflejo en el overlay, que es DOM y no puede importar nada de three.
 * Un juego con una sola pantalla las tendría junto al dibujo, como el resto de la flota.
 */
export const FRASES: Record<TutorialStepKey, TextKey> = {
  grab: 'Hold the grip button on a stick, do not point at it',
  around: 'They fall all around you: turn and catch another one',
}

/**
 * Y lo que se pide **con las manos desnudas**, que es como también se puede jugar.
 *
 * Ahí no hay botón que apretar: el puntero de agarre lo mueve el pellizco (ver
 * `xrInteraction.ts`). El tutorial es la única pantalla que explica el gesto, así que
 * nombrarle un botón a quien no tiene mando sería explicarle el juego al revés.
 */
export const FRASES_CON_LAS_MANOS: Record<TutorialStepKey, TextKey> = {
  grab: 'Pinch your fingers on a stick, do not point at it',
  around: 'They fall all around you: turn and catch another one',
}

/**
 * Cuántos palos hay que llevar atrapados para dar cada paso por hecho.
 *
 * El hito es **atrapar**, que es lo único que el juego pide aprender, y se cuenta acumulado
 * desde el principio de la partida: así el segundo paso no puede cumplirse con el mismo palo
 * que cumplió el primero.
 */
export const PALOS_DEL_PASO: Record<TutorialStepKey, number> = {
  grab: 1,
  around: 2,
}

/**
 * Cuánto espera cada paso antes de pasar solo, en segundos.
 *
 * Es una red, no un reloj: lo normal es que el paso se supere atrapando mucho antes. Existe
 * porque el hito puede no llegar nunca —quien se queda leyendo el panel, o quien falla los
 * palos uno tras otro— y el panel se quedaría delante de la cara toda la partida.
 *
 * El primero espera más: es el que enseña el gesto, y antes de poder hacerlo hay que esperar
 * a que caiga un palo.
 */
export const PLAZO_DEL_PASO: Record<TutorialStepKey, number> = {
  grab: 12,
  around: 8,
}

/** Lo mínimo para que un paso no se escape antes de haber podido intentarlo. */
export const TUTORIAL_MIN_SECONDS = 12
/** Lo máximo que la lección puede ocupar de una partida si nadie atrapa nada. */
export const TUTORIAL_MAX_SECONDS = 25

/**
 * Lo que dura la lección en el peor caso: sin atrapar un solo palo, de plazo en plazo.
 *
 * Acotado entre el mínimo y el máximo por un test, así que alargar un paso obliga a acortar
 * otro.
 */
export const TUTORIAL_SECONDS = TUTORIAL_STEPS.reduce(
  (total, step) => total + PLAZO_DEL_PASO[step],
  0,
)

/**
 * Lo que quien juega ya ha hecho. Se **acumula**: hacer algo no se deshace.
 *
 * Se deduce de lo que ya cuenta la partida —cuántos palos lleva atrapados— en vez de
 * apuntarse aparte: un tutorial que lleva su propia cuenta acaba discrepando de lo que pasa
 * en la escena, y aquí lo que manda es lo que pasa en la escena.
 */
export type TutorialHitos = Readonly<Record<TutorialStepKey, boolean>>

/** Nada hecho todavía. */
export const SIN_HITOS: TutorialHitos = { grab: false, around: false }

/**
 * Los hitos que se deducen de los palos atrapados hasta ahora.
 *
 * La cuenta viene de la partida, no de fuera, pero se sanea igual: un `NaN` que se colara
 * aquí dejaría los dos pasos sin cumplir para siempre y el panel puesto hasta agotar los dos
 * plazos.
 */
export function hitosAtrapando(caught: number): TutorialHitos {
  const atrapados = Number.isFinite(caught) ? Math.floor(caught) : 0
  return {
    grab: atrapados >= PALOS_DEL_PASO.grab,
    around: atrapados >= PALOS_DEL_PASO.around,
  }
}

/**
 * Qué paso toca enseñar, o `null` si ya no queda nada.
 *
 * El primero que no esté hecho, saltándose los que se hayan dado por pasados con el botón o
 * por plazo. Se **calcula** en vez de guardarse, por lo mismo que los hitos.
 *
 * @param saltados Cuántos pasos se han dado por pasados sin haberlos hecho.
 */
export function tutorialStep(hitos: TutorialHitos, saltados: number): TutorialStepKey | null {
  for (let i = Math.max(0, saltados); i < TUTORIAL_STEPS.length; i += 1) {
    const paso = TUTORIAL_STEPS[i]
    if (!hitos[paso]) return paso
  }
  return null
}

/**
 * Dar por pasado el paso que se está enseñando: desde dónde seguir buscando.
 *
 * Se apunta **la posición del paso**, no «uno más de los que iban»: con un hito ya cumplido
 * por delante, sumar uno a la cuenta puede dejar el mismo paso en pantalla, y entonces ni el
 * botón de siguiente ni el plazo harían nada. Y nunca retrocede: lo dado por pasado no
 * vuelve.
 */
export function saltarPaso(saltados: number, step: TutorialStepKey): number {
  return Math.max(saltados, TUTORIAL_STEPS.indexOf(step) + 1)
}

/**
 * Dónde se recuerda que el tutorial ya se ha visto. Con prefijo, como el récord y la altura
 * del aro, para no chocar con nada más del mismo origen.
 */
export const TUTORIAL_SEEN_KEY = 'stick-rush:tutorial-seen'

/**
 * Qué se guarda como «ya visto»: **la versión de la lección**, no un sí.
 *
 * Cualquier otro valor la vuelve a enseñar, así que subir este número es la forma de que
 * quien ya la vio la vuelva a ver cuando lo que enseña ha cambiado. La 1 fue la demostración
 * por reloj, con la partida esperando y un mando de mentira cogiendo un palo de mentira; la
 * **2** es esta, que se hace jugando y se supera atrapando palos de verdad. Quien vio la 1
 * no ha hecho esta.
 */
export const TUTORIAL_SEEN_VALUE = '2'

/**
 * ¿Ya se ha visto la lección?
 *
 * Lo leído es entrada externa —cualquiera puede editarla desde las herramientas del
 * navegador—, así que solo el valor exacto cuenta como visto: cualquier otra cosa la vuelve
 * a enseñar, que es el lado seguro. Enseñarla de más cuesta un panel saltable; no enseñarla
 * deja a alguien sin saber cómo se juega.
 */
export function tutorialSeen(storage: Pick<Storage, 'getItem'> | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    return storage.getItem(TUTORIAL_SEEN_KEY) === TUTORIAL_SEEN_VALUE
  } catch {
    // Almacenamiento capado: se enseña otra vez. Ver de más es mejor que no entender.
    return false
  }
}

/**
 * Deja constancia de que ya se ha visto.
 *
 * @returns si quedó guardado. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la lección se verá también la próxima vez.
 */
export function markTutorialSeen(storage: Storage | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    storage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    return true
  } catch {
    return false
  }
}
