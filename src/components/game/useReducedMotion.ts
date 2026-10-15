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

/** On the server there is no preference to read: normal motion is assumed. */
function getServerSnapshot(): boolean {
  return false
}

/**
 * Whether the system asks to reduce motion.
 *
 * It is the equivalent for the 3D scene of the media query that `globals.css` already
 * applies to the menu animations: inside the Canvas no CSS is any use,
 * so the preference has to be read and passed by hand.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
