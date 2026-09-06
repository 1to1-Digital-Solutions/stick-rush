import { type GameMode } from './gameMode'
import { createStoredPreference, gameStorage } from './storage'

/**
 * La mejor puntuación, guardada entre visitas.
 *
 * Un entero por modo en `localStorage`, sin identificadores ni nada que describa
 * a quien juega. Rompe a propósito el "cero almacenamiento" que la auditoría de
 * seguridad dio por bueno, porque un récord que se borra al recargar no es un
 * récord; lo demás que se guarda son la altura del aro (`hoopHeight.ts`), el
 * tutorial ya visto (`tutorial.ts`) y el silencio (`mutePreference.ts`). El
 * escenario y el modo siguen viviendo solo en memoria.
 *
 * **Un récord por modo** y no uno global: un desafío se corta al quedarse sin
 * vidas, así que con los mismos palos y la misma dificultad nunca puede puntuar
 * más que la práctica equivalente. Con una sola marca, el modo con algo en juego
 * sería el único que jamás la batiría.
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

/**
 * Clave del récord de cada modo. Con prefijo para no chocar con nada más del
 * mismo origen. La de práctica es la que ya había: quien tuviera un récord antes
 * de que existieran los modos lo conserva donde estaba.
 */
export const HIGH_SCORE_KEYS: Record<GameMode, string> = {
  practice: 'stick-rush:best-points',
  levels: 'stick-rush:best-points:levels',
  challenge: 'stick-rush:best-points:challenge',
}

/** La partida sin fin no mide puntos —crecen sin tope— sino la mejor racha. */
export const ENDLESS_STREAK_KEY = 'stick-rush:best-streak:endless'

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

/** Récord guardado de ese modo, o 0 si no hay ninguno legible. */
export function readBestPoints(
  storage: Storage | null,
  mode: GameMode,
): number {
  if (!storage) return 0
  try {
    return parseBestPoints(storage.getItem(HIGH_SCORE_KEYS[mode]))
  } catch {
    // Almacenamiento bloqueado: se juega sin récord previo.
    return 0
  }
}

/**
 * Guarda el récord de un modo. Los valores imposibles no se escriben, para no
 * dejar en el navegador algo que la lectura vaya a descartar.
 */
export function writeBestPoints(
  storage: Storage | null,
  mode: GameMode,
  points: number,
): void {
  if (!storage || !Number.isSafeInteger(points) || points < 0) return
  try {
    storage.setItem(HIGH_SCORE_KEYS[mode], String(points))
  } catch {
    // Cuota agotada o escritura prohibida: esa partida se queda sin récord.
    // Perderlo no justifica interrumpir el juego con un aviso.
  }
}

/** Quién quiere enterarse de que el récord ha cambiado. */
const listeners = new Set<() => void>()

/**
 * Récord vigente de un modo. Se lee del navegador cada vez en lugar de guardar
 * una copia: el almacenamiento es la única fuente de verdad, así que no hay dos
 * versiones que puedan discrepar.
 */
export function getBestPoints(mode: GameMode): number {
  return readBestPoints(gameStorage(), mode)
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

/**
 * Guarda la puntuación si mejora el récord de ese modo, y avisa a quien lo esté
 * mirando.
 */
export function saveBestPoints(mode: GameMode, points: number): void {
  if (!Number.isSafeInteger(points) || points <= getBestPoints(mode)) return
  writeBestPoints(gameStorage(), mode, points)
  for (const listener of listeners) listener()
}

const endlessStreak = createStoredPreference<number>({
  key: ENDLESS_STREAK_KEY,
  parse: parseBestPoints,
  serialize: String,
})

export const {
  get: getBestEndlessStreak,
  getServer: getServerBestEndlessStreak,
  subscribe: subscribeBestEndlessStreak,
} = endlessStreak

/** Guarda la racha de una partida sin fin si mejora la marca. */
export function saveBestEndlessStreak(streak: number): void {
  if (!Number.isSafeInteger(streak) || streak <= getBestEndlessStreak()) return
  endlessStreak.save(streak)
}
