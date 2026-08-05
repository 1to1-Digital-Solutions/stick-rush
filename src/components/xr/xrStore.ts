'use client'

import { createXRStore } from '@react-three/xr'
import { StickRushController } from './XRController'

/** El mismo volumen de agarre para la mano desnuda, algo más ajustado. */
const HAND_GRAB_RADIUS = 0.06

/** Dónde viven los perfiles de mando servidos por la propia app. */
const XR_PROFILES_PATH = '/webxr-profiles/'

/**
 * Ruta absoluta a los perfiles.
 *
 * @react-three/xr resuelve las rutas con `new URL(path, baseAssetPath)`, que
 * exige una base absoluta: una ruta como `/webxr-profiles/` lanza. En el
 * servidor no hay `window`, pero tampoco hay sesión XR, así que ese valor no
 * llega a usarse nunca.
 */
function profilesBasePath(): string {
  if (typeof window === 'undefined') return `http://localhost${XR_PROFILES_PATH}`
  return new URL(XR_PROFILES_PATH, window.location.origin).href
}

/**
 * Store de WebXR compartido entre los botones de entrada (DOM) y el
 * componente <XR> dentro del Canvas. Se crea una sola vez a nivel de
 * módulo para que ambos lados apunten a la misma sesión.
 *
 * Dos decisiones, las dos salidas de probar con el visor puesto:
 *
 * - **Los perfiles de mando se sirven desde la propia app** (`baseAssetPath`).
 *   Por defecto se descargan de `cdn.jsdelivr.net`; la CSP lo bloquea, y al
 *   fallar la promesa @react-three/xr se traga el error en un
 *   `.catch(console.error)` y **nunca registra el mando**. Sin estado de mando
 *   no se monta ni el rayo ni el puntero de agarre: en el visor eso era
 *   quedarse sin mandos y sin poder pulsar nada. Los ficheros se copian con
 *   `npm run sync:xr-profiles`.
 * - **El mando lo dibuja el juego**, no la librería: `StickRushController` monta
 *   un mando de geometría propia (con la pista del gatillo de agarre) y sus dos
 *   punteros. El modelo real es un `.glb` del mismo CDN, y auto-hospedarlo
 *   costaría los 100 MB del paquete de assets para algo que se ve de refilón.
 *
 * Las manos desnudas van sin modelo: en AR se ven las de verdad por
 * passthrough, y en VR el cursor del agarre basta para situarlas. Su modelo sí
 * es una descarga del CDN y no hay equivalente local ligero.
 */
export const xrStore = createXRStore({
  baseAssetPath: profilesBasePath(),
  controller: StickRushController,
  hand: {
    model: false,
    grabPointer: { radius: HAND_GRAB_RADIUS, cursorModel: true },
    rayPointer: { rayModel: true, cursorModel: true },
    teleportPointer: false,
  },
})
