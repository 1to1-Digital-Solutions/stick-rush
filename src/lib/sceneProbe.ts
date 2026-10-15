/**
 * Where each stick is, for whoever looks from outside the Canvas.
 *
 * The sticks are three objects: from the DOM there is no way of selecting them,
 * nor of knowing which one is falling, nor at what height it is. A browser test that
 * wants to check that a stick is caught **with the bare hand** could only
 * move the hand at random and hope to hit, which depends on luck and on the
 * machine where it runs. And the grab with the hand leaves no trace in the DOM: there is no
 * button to press nor focus to follow, only a pointer of the library touching
 * a cylinder.
 *
 * This avoids it by publishing where the sticks are, but **only if someone has
 * asked for it**: the scene writes to `window.__stickRushSticks` if that property already
 * exists, and if it does not exist it does nothing. No browser ships with it, so
 * whoever does not create it —that is, everybody except the tests— pays one
 * check per frame and nothing more.
 */

/** A stick and where it is, in metres of the world. */
export interface StickProbe {
  x: number
  y: number
  z: number
  /** Whether it can be caught right now (see `canCatchStick`). */
  catchable: boolean
}

declare global {
  interface Window {
    /**
     * The live sticks, by their run key, one frame behind.
     *
     * `undefined` means that nobody has asked for it and the scene publishes nothing.
     * An empty object means that it has been asked for and right now there are no sticks:
     * in the menu there is nothing hanging.
     */
    __stickRushSticks?: Record<string, StickProbe>
  }
}

/** Is anyone looking? */
export function stickProbeRequested(): boolean {
  return typeof window !== 'undefined' && '__stickRushSticks' in window
}

/**
 * Publishes where a stick is, if someone had asked for it. With `null` it is erased,
 * which is what a stick does on unmounting: leaving its key in place would make
 * whoever looks believe that there is still a stick there, still forever.
 */
export function publishStick(id: string, probe: StickProbe | null): void {
  if (!stickProbeRequested()) return
  const sticks = window.__stickRushSticks ?? {}
  if (probe == null) delete sticks[id]
  else sticks[id] = probe
  window.__stickRushSticks = sticks
}
