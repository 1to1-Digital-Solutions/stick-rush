'use client'

import { createRoot } from 'react-dom/client'
import { StickRush, type StickRushProps } from './StickRush'

/** What `mountStickRush` returns so that it can be undone. */
export interface StickRushHandle {
  /** Unmounts the game and releases whatever it has open (scene, audio, session). */
  unmount(): void
}

/**
 * Mounts the game in a DOM element.
 *
 * It is the same game as `<StickRush>`, for whoever does not render React on
 * their own: it creates the root, paints inside and returns what to remove it
 * with. The element has to have a height; the game fills it.
 */
export function mountStickRush(
  container: HTMLElement,
  options: StickRushProps = {},
): StickRushHandle {
  const root = createRoot(container)
  root.render(<StickRush {...options} />)

  return { unmount: () => root.unmount() }
}
