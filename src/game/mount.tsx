'use client'

import { createRoot } from 'react-dom/client'
import { StickRush, type StickRushProps } from './StickRush'

/** Lo que devuelve `mountStickRush` para poder deshacerlo. */
export interface StickRushHandle {
  /** Desmonta el juego y libera lo que tenga abierto (escena, audio, sesión). */
  unmount(): void
}

/**
 * Monta el juego en un elemento del DOM.
 *
 * Es el mismo juego que `<StickRush>`, para quien no renderiza React por su
 * cuenta: crea la raíz, pinta dentro y devuelve con qué quitarlo. El elemento
 * tiene que tener altura; el juego la llena.
 */
export function mountStickRush(
  container: HTMLElement,
  options: StickRushProps = {},
): StickRushHandle {
  const root = createRoot(container)
  root.render(<StickRush {...options} />)

  return { unmount: () => root.unmount() }
}
