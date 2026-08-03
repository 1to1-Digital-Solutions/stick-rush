'use client'

import { createXRStore } from '@react-three/xr'

/** Radio de la esfera de agarre del mando, en metros (por defecto 0.07). */
const CONTROLLER_GRAB_RADIUS = 0.09
/** El mismo volumen para la mano desnuda, algo más ajustado. */
const HAND_GRAB_RADIUS = 0.06

/**
 * Store de WebXR compartido entre los botones de entrada (DOM) y el
 * componente <XR> dentro del Canvas. Se crea una sola vez a nivel de
 * módulo para que ambos lados apunten a la misma sesión.
 *
 * Dos decisiones a propósito:
 *
 * - **Se conservan los dos punteros.** El de agarre (`grab`) es una esfera
 *   pegada al puño que se activa con el gatillo lateral: es con el que se cogen
 *   los palos. El rayo (`ray`) se queda para manejar el menú, que está a un par
 *   de metros y sería incómodo tocar. Quién puede atrapar y quién no lo decide
 *   `Stick` mirando el tipo de puntero del evento, no este fichero.
 * - **Sin modelo de mando ni de mano** (`model: false`). @react-three/xr los
 *   descarga de `cdn.jsdelivr.net`, y el juego tiene que funcionar en un visor
 *   sin salida a internet (además, la CSP ya lo bloquea). En su lugar el
 *   jugador se orienta con el cursor del agarre y el rayo, que son geometría
 *   local. Si algún día se quieren los modelos, hay que auto-hospedar
 *   `@webxr-input-profiles/assets` y montar un <XRController> propio: la ruta
 *   no se puede cambiar desde aquí.
 */
export const xrStore = createXRStore({
  controller: {
    model: false,
    grabPointer: { radius: CONTROLLER_GRAB_RADIUS, cursorModel: true },
    rayPointer: { rayModel: true, cursorModel: true },
    teleportPointer: false,
  },
  hand: {
    model: false,
    grabPointer: { radius: HAND_GRAB_RADIUS, cursorModel: true },
    rayPointer: { rayModel: true, cursorModel: true },
    teleportPointer: false,
  },
})
