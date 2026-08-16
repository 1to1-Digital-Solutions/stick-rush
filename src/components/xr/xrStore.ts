'use client'

import { createXRStore } from '@react-three/xr'
import { assetUrl } from '../../lib/assets'
import { StickRushController } from './XRController'

/** El mismo volumen de agarre para la mano desnuda, algo más ajustado. */
const HAND_GRAB_RADIUS = 0.06

/** Dónde viven los perfiles de mando servidos junto al resto de assets. */
const XR_PROFILES_PATH = 'webxr-profiles/'

/**
 * Ruta absoluta a los perfiles.
 *
 * @react-three/xr resuelve las rutas con `new URL(path, baseAssetPath)`, que
 * exige una base absoluta: una ruta como `/webxr-profiles/` lanza. En el
 * servidor no hay `window`, pero tampoco hay sesión XR, así que ese valor no
 * llega a usarse nunca.
 */
function profilesBasePath(): string {
  const path = assetUrl(XR_PROFILES_PATH)
  if (typeof window === 'undefined') return new URL(path, 'http://localhost').href
  return new URL(path, window.location.origin).href
}

/**
 * Store de WebXR compartido entre los botones de entrada (DOM) y el
 * componente <XR> dentro del Canvas. Se crea una sola vez, la primera vez que
 * alguno lo pide, para que ambos lados apunten a la misma sesión.
 *
 * Se crea al pedirlo y no al importar el módulo porque su `baseAssetPath`
 * depende de dónde estén los ficheros del juego, y eso lo decide quien lo monta
 * (ver `lib/assets.ts`): fijándolo en el import quedaría atado a la raíz antes
 * de que nadie hubiera podido decir otra cosa.
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
let store: ReturnType<typeof createXRStore> | null = null

export function getXrStore(): ReturnType<typeof createXRStore> {
  store ??= createXRStore({
    baseAssetPath: profilesBasePath(),
    controller: StickRushController,
    hand: {
      model: false,
      grabPointer: { radius: HAND_GRAB_RADIUS, cursorModel: true },
      rayPointer: { rayModel: true, cursorModel: true },
      teleportPointer: false,
    },
  })
  return store
}

/**
 * Cierra la sesión inmersiva, si la hay.
 *
 * Hace falta al desmontar el juego. El store vive fuera del árbol de React y
 * `<XR>` no cierra nada al desmontarse: una aplicación que quite el juego con
 * el visor puesto —el hub volviendo a su salón— dejaría viva una sesión atada a
 * un Canvas que ya no existe, y el jugador se quedaría mirando una escena
 * congelada, sin poder volver ni empezar otra (WebXR da una sesión por
 * documento). En su propia web pasa lo mismo al navegar entre `/` y `/game`.
 */
export function endXrSession(): void {
  const session = store?.getState().session
  if (session == null) return
  // Que la llamada falle es un desenlace previsto: la sesión puede estar
  // cerrándose ya porque el jugador haya salido por su cuenta.
  void session.end().catch(() => {})
}
