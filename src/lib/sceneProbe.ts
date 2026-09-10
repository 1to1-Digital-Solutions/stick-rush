/**
 * Dónde está cada palo, para quien mire desde fuera del Canvas.
 *
 * Los palos son objetos de three: desde el DOM no hay forma de seleccionarlos,
 * ni de saber cuál está cayendo, ni a qué altura va. Un test de navegador que
 * quiera comprobar que un palo se atrapa **con la mano desnuda** solo podría
 * mover la mano al azar y esperar a acertar, que depende de la suerte y de la
 * máquina donde corra. Y el agarre con la mano no deja rastro en el DOM: no hay
 * botón que pulsar ni foco que seguir, solo un puntero de la librería tocando
 * un cilindro.
 *
 * Esto lo evita publicando dónde están los palos, pero **solo si alguien lo ha
 * pedido**: la escena escribe en `window.__stickRushSticks` si esa propiedad ya
 * existe, y si no existe no hace nada. Ningún navegador la trae de serie, así
 * que quien no la cree —o sea, todo el mundo menos los tests— paga una
 * comprobación por fotograma y nada más.
 */

/** Un palo y dónde está, en metros del mundo. */
export interface StickProbe {
  x: number
  y: number
  z: number
  /** Si ahora mismo se puede coger (ver `canCatchStick`). */
  catchable: boolean
}

declare global {
  interface Window {
    /**
     * Los palos vivos, por su clave de partida, un fotograma por detrás.
     *
     * `undefined` significa que nadie lo ha pedido y la escena no publica nada.
     * Un objeto vacío significa que sí se ha pedido y ahora mismo no hay palos:
     * en el menú no hay nada colgando.
     */
    __stickRushSticks?: Record<string, StickProbe>
  }
}

/** ¿Hay alguien mirando? */
export function stickProbeRequested(): boolean {
  return typeof window !== 'undefined' && '__stickRushSticks' in window
}

/**
 * Publica dónde está un palo, si alguien lo había pedido. Con `null` se borra,
 * que es lo que hace un palo al desmontarse: dejar su clave puesta haría creer
 * a quien mire que sigue habiendo un palo ahí, quieto para siempre.
 */
export function publishStick(id: string, probe: StickProbe | null): void {
  if (!stickProbeRequested()) return
  const sticks = window.__stickRushSticks ?? {}
  if (probe == null) delete sticks[id]
  else sticks[id] = probe
  window.__stickRushSticks = sticks
}
