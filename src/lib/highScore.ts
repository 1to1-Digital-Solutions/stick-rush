/**
 * La mejor puntuación, guardada entre visitas: las marcas de `bests.ts` y lo que solo tiene el
 * navegador, la suscripción al evento `storage` de las otras pestañas y lo que ve el servidor.
 *
 * Todo lo demás —las claves, leer, escribir, guardar si mejora, la racha sin fin— está en
 * `bests.ts`, sin navegador, y se reexporta de aquí tal cual: quien importaba de este fichero
 * sigue importando lo mismo.
 */
import { escucharElRecord } from './bests'

export * from './bests'

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
  const dejar = escucharElRecord(listener)
  window.addEventListener('storage', listener)
  return () => {
    dejar()
    window.removeEventListener('storage', listener)
  }
}
