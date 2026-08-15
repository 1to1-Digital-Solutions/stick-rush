/**
 * El almacenamiento del navegador, cuando deja tocarlo.
 *
 * En modo privado, o con el almacenamiento vetado por política, leer
 * `window.localStorage` **lanza** en vez de devolver `null`. Todo lo que el
 * juego guarda —el récord, la altura del aro y si ya se vio el tutorial del
 * visor— es prescindible, así que aquí ese fallo se traduce a "no hay
 * almacenamiento" y cada cosa decide con qué valor se queda. En el servidor
 * tampoco lo hay, y eso es lo que mantiene igual el HTML que se prerenderiza y
 * el que se hidrata.
 */
export function gameStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
