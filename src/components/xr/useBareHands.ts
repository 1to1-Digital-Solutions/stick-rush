'use client'

import { useXR } from '@react-three/xr'

import { playingBareHanded } from '../../lib/xrInteraction'

/**
 * Si la sesión de ahora mismo va con las manos desnudas.
 *
 * La regla vive en `@/lib/xrInteraction`, probada sin navegador; aquí solo se
 * le da lo que dice la sesión. El selector devuelve un booleano y no la lista,
 * porque cualquier cosa que no se compare por valor volvería a renderizar en
 * cada fotograma.
 */
export function useBareHands(): boolean {
  return useXR((state) =>
    playingBareHanded(state.inputSourceStates.map((input) => input.type)),
  )
}
