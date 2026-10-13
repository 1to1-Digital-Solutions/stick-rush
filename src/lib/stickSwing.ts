/**
 * Swing of the sticks that hang from the hoop.
 *
 * Until the first stick fell nothing moved: with the headset on the
 * machine looked frozen while the player chose options and during the
 * countdown. The sway is only decoration —it changes neither when a stick is
 * released nor from what height—, so it is kept short and slow: just enough for
 * the scene to breathe without distracting from what is going to fall.
 */

/** Amplitude of the main swing, in radians (~3°). */
export const SWING_AMPLITUDE = 0.055

/**
 * Amplitude of the perpendicular axis, in proportion to the main one. With a single axis
 * the sticks look like windscreen wipers; with both they describe a slow ellipse,
 * which is how something hanging that the air catches moves.
 */
export const SWING_CROSS_RATIO = 0.45

/**
 * Cycles per second of the swing. A real pendulum of this length (the cord plus
 * the stick, half a metre) would be around 0.7 Hz; it is left somewhat slower because at
 * three degrees that pace reads as nervous, not as inertia.
 */
export const SWING_FREQUENCY = 0.55

/** How much the frequency varies between sticks: from 85 % to 115 % of the base. */
export const SWING_FREQUENCY_SPREAD = 0.3

/**
 * Frequency of the perpendicular axis relative to the main one. It is not a simple
 * multiple on purpose: if the two axes closed the cycle at once, the stick
 * would repeat the same path over and over and the loop would be noticed.
 */
export const SWING_CROSS_RATE = 0.73

/**
 * At what rate the stick straightens (1/s) when it stops hanging. On being released it falls
 * straight in ~0.25 s: a falling stick has to read clearly to catch it, and
 * dragging the sway along during the fall makes it hard to follow.
 */
export const SWING_RELEASE_DECAY = 4

/** Tilt of the stick relative to the vertical, in radians. */
export interface SwingTilt {
  /** Turn about X: it rocks the stick forwards and backwards. */
  x: number
  /** Turn about Z: it rocks it sideways. */
  z: number
}

/**
 * How much a hanging stick tilts, `time` seconds after being mounted.
 *
 * `phase` is its own slot within the cycle, in [0, 1): it decides where the
 * swing starts and fine-tunes its frequency, so that thirteen sticks with the same recipe
 * do not move as a single block.
 */
export function hangingSwing(time: number, phase: number): SwingTilt {
  const frequency =
    SWING_FREQUENCY * (1 + (phase - 0.5) * SWING_FREQUENCY_SPREAD)
  const speed = 2 * Math.PI * frequency
  const offset = 2 * Math.PI * phase

  return {
    x:
      SWING_AMPLITUDE *
      SWING_CROSS_RATIO *
      Math.sin(speed * SWING_CROSS_RATE * time + offset * 1.7),
    z: SWING_AMPLITUDE * Math.sin(speed * time + offset),
  }
}
