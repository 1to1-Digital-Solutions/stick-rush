/**
 * La mejor puntuación, guardada entre visitas.
 *
 * Es lo único que el juego escribe en el navegador: un entero en
 * `localStorage`, sin identificadores ni nada que describa a quien juega. Rompe
 * a propósito el "cero almacenamiento" que la auditoría de seguridad dio por
 * bueno, porque un récord que se borra al recargar no es un récord; el resto de
 * preferencias (silencio, escenario) siguen viviendo solo en memoria.
 *
 * El acceso es tolerante a fallos: en modo privado, o con el almacenamiento
 * bloqueado por política, tocar `localStorage` **lanza** en vez de devolver
 * `null`. Ahí el juego se queda sin récord y se juega igual: es una función de
 * más, no una condición para jugar.
 *
 * Las funciones de lectura y escritura reciben el `Storage` por parámetro, así
 * que la regla se prueba sin navegador y sin tocar el almacenamiento real. Por
 * encima hay un almacén al que React se suscribe (`useSyncExternalStore`): el
 * récord no es estado de React sino algo que vive fuera y que el juego
 * consulta, que es justo lo que evita sincronizarlo con efectos.
 */

/** Clave del récord. Con prefijo para no chocar con nada más del mismo origen. */
export const HIGH_SCORE_KEY = 'stick-rush:best-points'

/**
 * Interpreta lo leído del almacenamiento.
 *
 * Es entrada externa —cualquiera puede editarla desde las herramientas del
 * navegador—, así que solo se acepta un entero no negativo y exacto. Cualquier
 * otra cosa cuenta como "todavía no hay récord" en vez de propagar un `NaN` a
 * la puntuación.
 */
export function parseBestPoints(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 0
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) return 0
  return value
}

/** `localStorage` si el navegador lo ofrece; `null` si no hay o está vetado. */
export function scoreStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Récord guardado, o 0 si no hay ninguno legible. */
export function readBestPoints(storage: Storage | null): number {
  if (!storage) return 0
  try {
    return parseBestPoints(storage.getItem(HIGH_SCORE_KEY))
  } catch {
    // Almacenamiento bloqueado: se juega sin récord previo.
    return 0
  }
}

/**
 * Guarda el récord. Los valores imposibles no se escriben, para no dejar en el
 * navegador algo que la lectura vaya a descartar.
 */
export function writeBestPoints(storage: Storage | null, points: number): void {
  if (!storage || !Number.isSafeInteger(points) || points < 0) return
  try {
    storage.setItem(HIGH_SCORE_KEY, String(points))
  } catch {
    // Cuota agotada o escritura prohibida: esa partida se queda sin récord.
    // Perderlo no justifica interrumpir el juego con un aviso.
  }
}

/** Quién quiere enterarse de que el récord ha cambiado. */
const listeners = new Set<() => void>()

/**
 * Récord vigente. Se lee del navegador cada vez en lugar de guardar una copia:
 * el almacenamiento es la única fuente de verdad, así que no hay dos versiones
 * que puedan discrepar.
 */
export function getBestPoints(): number {
  return readBestPoints(scoreStorage())
}

/**
 * Lo que ve el servidor al prerenderizar: no hay navegador, así que no hay
 * récord. Sin esto el HTML del servidor y el del cliente diferirían y React
 * avisaría de un error de hidratación.
 */
export function getServerBestPoints(): number {
  return 0
}

/**
 * Suscripción para `useSyncExternalStore`.
 *
 * Además del aviso propio se escucha el evento `storage`, que es como el
 * navegador cuenta que **otra pestaña** ha tocado el almacenamiento. Sin él,
 * batir el récord en una pestaña dejaría a las demás enseñando el anterior, y
 * el almacenamiento dejaría de ser la única fuente de verdad que dice ser.
 */
export function subscribeBestPoints(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** Guarda la puntuación si mejora el récord, y avisa a quien lo esté mirando. */
export function saveBestPoints(points: number): void {
  if (!Number.isSafeInteger(points) || points <= getBestPoints()) return
  writeBestPoints(scoreStorage(), points)
  for (const listener of listeners) listener()
}
