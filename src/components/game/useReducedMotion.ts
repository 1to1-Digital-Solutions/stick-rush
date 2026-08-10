'use client'

import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function matchReducedMotion(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null
  return window.matchMedia(REDUCED_MOTION_QUERY)
}

function subscribe(onChange: () => void): () => void {
  const media = matchReducedMotion()
  if (!media) return () => {}
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return matchReducedMotion()?.matches ?? false
}

/** En el servidor no hay preferencia que leer: se asume movimiento normal. */
function getServerSnapshot(): boolean {
  return false
}

/**
 * Si el sistema pide reducir el movimiento.
 *
 * Es el equivalente para la escena 3D de la media query que `globals.css` ya
 * aplica a las animaciones del menú: dentro del Canvas no hay CSS que valga,
 * así que la preferencia hay que leerla y pasarla a mano.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
