'use client'

import { createXRStore } from '@react-three/xr'

/**
 * Store de WebXR compartido entre los botones de entrada (DOM) y el
 * componente <XR> dentro del Canvas. Se crea una sola vez a nivel de
 * módulo para que ambos lados apunten a la misma sesión.
 */
export const xrStore = createXRStore()
