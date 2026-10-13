/**
 * El juego, manejable desde un test de navegador sin jugar: lo común de los diecisiete
 * (`e2e/support/comun.ts`) para sacar las mismas capturas de la UX en todos.
 *
 * Coger palos con el emulador del visor es lo que ni el emulador ni un test hacen bien, y lo que se
 * mira en esas capturas —el menú, el cartel antes de empezar, al cruzar el bronce y al acabar— no
 * depende de cómo se cogieron. Así que el test empieza el reto, le pone los puntos y lo acaba.
 *
 * **La llave lleva el nombre del juego**: los juegos se instalan todos a la vez dentro del salón, y
 * un `declare global` es de la página, no de quien lo escribe; con dos juegos llamando `__partida`
 * a lo suyo, TypeScript funde las declaraciones y el salón no construye.
 *
 * **Solo cuenta si alguien lo pide**: el test crea `window.__partidaStickRush` antes de cargar la
 * página (`pedirLaPartida`), y la escena deja ahí lo que se le puede pedir. En una partida de verdad
 * esto no hace nada, que es lo que permite dejarlo puesto. Se mira en `globalThis`, que en el
 * navegador es la ventana y fuera de él también existe: así `src/lib` no toca el navegador.
 */

import type { VistaDelCartel } from './objetivo'

/** Lo que un test puede hacerle al juego: lo común de `PartidaComun` (`e2e/support/comun.ts`). */
export interface PartidaDePrueba {
  /** Empieza un reto, solo, sin lección ni cuenta atrás que esperar. */
  start: () => void
  /** Fija los puntos del reto en curso, como si ya se hubiera atrapado un palo. */
  score: (puntos: number) => void
  /** Acaba el reto en curso como si se hubieran resuelto todos los palos: cuenta para el salón. */
  end: () => void
  /** Lo que dice ahora el cartel del objetivo, o `null` si no se ve. */
  cartel: () => VistaDelCartel | null
}

declare global {
  var __partidaStickRush: Partial<PartidaDePrueba> | undefined
}

/** ¿Alguien quiere manejar el juego desde fuera? */
export function isPartidaRequested(): boolean {
  return globalThis.__partidaStickRush != null
}

/** Deja a mano lo que se puede hacer, si alguien lo ha pedido. */
export function exponerPartida(api: PartidaDePrueba): void {
  const partida = globalThis.__partidaStickRush
  if (partida == null) return
  partida.start = api.start
  partida.score = api.score
  partida.end = api.end
  partida.cartel = api.cartel
}
