import { gameStorage } from './storage'

/**
 * Si el juego arranca en silencio, recordado entre visitas.
 *
 * **Por qué se guarda.** El silencio nació durando lo que durara la visita, a
 * propósito: la auditoría de seguridad dejó el juego sin almacenamiento y
 * persistir una preferencia lo rompía. Pero con el visor puesto, el sonido va
 * pegado a los oídos y quien lo prefiere quitado tiene que apagarlo cada vez
 * que se pone las gafas —el gesto más incómodo del juego, y para deshacer algo
 * que ya había decidido—. Se guarda por lo mismo que la altura del aro (ver
 * `hoopHeight.ts`): es una preferencia de cómo se juega, no un dato de la
 * partida. Sigue sin haber identificadores, cookies ni nada que salga del
 * navegador.
 *
 * **Solo se escribe el silencio.** Con sonido se borra la clave en vez de
 * guardar un cero: el arranque por defecto es con sonido, así que el
 * almacenamiento solo tiene algo cuando el jugador se aparta de él. Y lo leído
 * es entrada externa —cualquiera puede editarla desde las herramientas del
 * navegador—, así que solo el valor exacto cuenta como silencio; cualquier otra
 * cosa es "con sonido", que es lo que hacía el juego antes de guardar nada.
 *
 * Las funciones de lectura y escritura reciben el `Storage` por parámetro, así
 * que la regla se prueba sin navegador. Por encima hay un almacén al que React
 * se suscribe (`useSyncExternalStore`), como con el récord: leerlo en un efecto
 * al montar desajustaría la hidratación —el servidor no ve el almacenamiento— y
 * el linter de React 19 lo prohíbe con razón.
 */

/** Dónde se recuerda. Con prefijo, como el récord y la altura del aro. */
export const MUTED_KEY = 'stick-rush:muted'

/** Lo que se escribe cuando el juego se deja en silencio. */
const MUTED_VALUE = '1'

/** Interpreta lo leído del almacenamiento (ver el porqué arriba). */
export function parseMuted(raw: string | null): boolean {
  return raw === MUTED_VALUE
}

/** ¿Quedó el juego en silencio la última vez? */
export function readMuted(storage: Storage | null): boolean {
  if (!storage) return false
  try {
    return parseMuted(storage.getItem(MUTED_KEY))
  } catch {
    // Almacenamiento bloqueado: se arranca con sonido, como siempre.
    return false
  }
}

/**
 * Recuerda la preferencia, o la olvida cuando se vuelve al sonido.
 *
 * @returns si quedó guardada. Un `false` no es un error: significa que este
 *   navegador no guarda nada y la preferencia tendrá que vivir en memoria.
 */
export function writeMuted(storage: Storage | null, muted: boolean): boolean {
  if (!storage) return false
  try {
    if (muted) storage.setItem(MUTED_KEY, MUTED_VALUE)
    else storage.removeItem(MUTED_KEY)
    return true
  } catch {
    // Cuota agotada o escritura prohibida: la preferencia dura lo que dure la
    // visita, que es lo que hacía antes. No justifica ningún aviso.
    return false
  }
}

/** Quién quiere enterarse de que la preferencia ha cambiado. */
const listeners = new Set<() => void>()

/**
 * La preferencia cuando el navegador no deja guardarla, y `null` mientras sí.
 *
 * Silenciar es una función del juego y no un adorno: sin esto, en modo privado
 * el botón no haría nada —lo guardado no cambia, así que la lectura devolvería
 * siempre lo mismo— y el juego seguiría sonando por más que se pulsara. Mientras
 * el almacenamiento funcione se queda a `null` y la única fuente de verdad es
 * el navegador, sin copias que puedan discrepar.
 */
let inMemory: boolean | null = null

/** Preferencia vigente. */
export function getMuted(): boolean {
  return inMemory ?? readMuted(gameStorage())
}

/**
 * Lo que ve el servidor al prerenderizar: no hay navegador, así que no hay
 * preferencia. El botón de silenciar sí se prerenderiza —está en la pantalla de
 * inicio—, y sin esto el HTML del servidor y el del cliente diferirían.
 */
export function getServerMuted(): boolean {
  return false
}

/**
 * Suscripción para `useSyncExternalStore`.
 *
 * Se escucha además el evento `storage`, que es como el navegador cuenta que
 * **otra pestaña** ha tocado el almacenamiento: silenciar en una y que la otra
 * siguiera sonando sería justo lo contrario de lo que se acaba de pedir.
 */
export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** Cambia la preferencia y avisa a quien la esté mirando. */
export function saveMuted(muted: boolean): void {
  inMemory = writeMuted(gameStorage(), muted) ? null : muted
  for (const listener of listeners) listener()
}
