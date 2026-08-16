import { gameStorage } from './storage'
// Solo el tipo: se borra al compilar, así que no crea un ciclo real con el store aunque el
// store importe de aquí.
import type { SceneryMode } from './gameStore'

/**
 * Si el jugador prefiere ver su cuarto en vez del escenario, recordado entre visitas.
 *
 * **Por qué se guarda.** Es la misma incomodidad que ya se arregló con el silencio: quien
 * juega en passthrough tenía que quitar el escenario cada vez que se ponía las gafas, para
 * deshacer algo que ya había decidido. Se guarda por lo mismo que el récord y la altura del
 * aro: es una preferencia de cómo se juega, no un dato de la partida. Sigue sin haber
 * identificadores ni nada que salga del navegador.
 *
 * **Solo se escribe el passthrough.** Con escenario se borra la clave en vez de guardar un
 * valor: el arranque por defecto es con escenario, así que el almacenamiento solo tiene algo
 * cuando el jugador se aparta de él. Y lo leído es entrada externa —cualquiera puede editarla
 * desde las herramientas del navegador—, así que solo el valor exacto cuenta; cualquier otra
 * cosa es "con escenario".
 *
 * **Lo que esto NO decide.** Que la preferencia diga passthrough no significa que se pueda
 * servir: en una sesión `immersive-vr` no hay habitación real detrás, y quitar el escenario
 * dejaría al jugador mirando la nada sin saber por qué. Eso lo resuelve quien pinta la
 * escena, que es el único que sabe qué tipo de sesión se ha concedido.
 */

/** Dónde se recuerda. Con prefijo, como el récord, el silencio y la altura del aro. */
export const SCENERY_KEY = 'stick-rush:scenery'

/** Lo que se escribe cuando el jugador prefiere ver su cuarto. */
const PASSTHROUGH_VALUE = 'passthrough'

/** Interpreta lo leído del almacenamiento (ver el porqué arriba). */
export function parseScenery(raw: string | null): SceneryMode {
  return raw === PASSTHROUGH_VALUE ? 'passthrough' : 'scene'
}

/** ¿Con qué escenario se quedó la última vez? */
export function readScenery(storage: Storage | null): SceneryMode {
  if (!storage) return 'scene'
  try {
    return parseScenery(storage.getItem(SCENERY_KEY))
  } catch {
    // Almacenamiento bloqueado: se arranca con escenario, como siempre.
    return 'scene'
  }
}

/**
 * Recuerda la preferencia, o la olvida cuando se vuelve al escenario.
 *
 * @returns si quedó guardada. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la preferencia tendrá que vivir en memoria.
 */
export function writeScenery(storage: Storage | null, scenery: SceneryMode): boolean {
  if (!storage) return false
  try {
    if (scenery === 'passthrough') storage.setItem(SCENERY_KEY, PASSTHROUGH_VALUE)
    else storage.removeItem(SCENERY_KEY)
    return true
  } catch {
    // Cuota agotada o escritura prohibida: la preferencia dura lo que dure la visita, que es
    // lo que hacía antes. No justifica ningún aviso.
    return false
  }
}

/** Quién quiere enterarse de que la preferencia ha cambiado. */
const listeners = new Set<() => void>()

/**
 * La preferencia cuando el navegador no deja guardarla, y `null` mientras sí.
 *
 * Sin esto, en modo privado el selector no haría nada —lo guardado no cambia, así que la
 * lectura devolvería siempre lo mismo— y el escenario no se movería por más que se pulsara.
 */
let inMemory: SceneryMode | null = null

/** Preferencia vigente. */
export function getScenery(): SceneryMode {
  return inMemory ?? readScenery(gameStorage())
}

/**
 * Lo que ve el servidor al prerenderizar: no hay navegador, así que no hay preferencia.
 * El selector solo existe dentro del visor, pero el valor alimenta el lienzo, que sí se
 * prerenderiza.
 */
export function getServerScenery(): SceneryMode {
  return 'scene'
}

/**
 * Suscripción para `useSyncExternalStore`.
 *
 * Se escucha además el evento `storage`, que es como el navegador cuenta que **otra pestaña**
 * ha tocado el almacenamiento.
 */
export function subscribeScenery(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** Cambia la preferencia y avisa a quien la esté mirando. */
export function saveScenery(scenery: SceneryMode): void {
  inMemory = writeScenery(gameStorage(), scenery) ? null : scenery
  for (const listener of listeners) listener()
}
