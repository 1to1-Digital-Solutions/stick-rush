/**
 * How the fairground responds to what the player does.
 *
 * The bulbs of the garlands and of the Ferris wheel get brighter with the streak
 * and, from a certain streak on, they throb to the rhythm of a party; the crowd
 * sways faster and higher. All of them are pure functions of the streak and the
 * clock: the scene reads them every frame without going through React and they
 * can be tested without a scene.
 *
 * With `prefers-reduced-motion` the bulbs do not throb and the crowd does not
 * move; the glow does rise, since a slow change of light is not motion.
 */

/** Glow of the bulbs with no streak: the one the fairground had before all this. */
export const BULB_GLOW_IDLE = 1.6
/** How far the glow gets with a long streak. */
export const BULB_GLOW_MAX = 3.2
/** Streak from which the bulbs start to throb. */
export const PARTY_STREAK = 5
/** Streak with which the party is already at its maximum; more changes nothing. */
export const FULL_PARTY_STREAK = 15

/** How much the glow rises with the streak: fast at first, saturating afterwards. */
export function bulbGlow(streak: number): number {
  const s = Math.max(0, streak)
  return BULB_GLOW_IDLE + (BULB_GLOW_MAX - BULB_GLOW_IDLE) * (1 - Math.exp(-s / 6))
}

/** How much of a party there is: 0 with no streak, 1 with the full party streak. */
export function partyLevel(streak: number): number {
  if (streak < PARTY_STREAK) return 0
  return Math.min(1, (streak - PARTY_STREAK + 1) / (FULL_PARTY_STREAK - PARTY_STREAK + 1))
}

/**
 * The throb of the bulbs at this instant, between 0 (the usual colour) and
 * 1 (party white). It beats faster the longer the streak.
 */
export function bulbPulse(streak: number, time: number): number {
  const level = partyLevel(streak)
  if (level === 0) return 0
  const beat = 1.6 + 1.4 * level
  const wave = 0.5 + 0.5 * Math.sin(Math.PI * 2 * beat * time)
  return wave * level
}

/** How much the crowd sways, in metres of rise and fall. Always something: people are not made of stone. */
export function crowdBob(streak: number): number {
  return 0.012 + 0.05 * Math.min(1, Math.max(0, streak) / FULL_PARTY_STREAK)
}

/** At what tempo it sways, in sways per second. */
export function crowdTempo(streak: number): number {
  return 1.1 + 1.3 * Math.min(1, Math.max(0, streak) / FULL_PARTY_STREAK)
}
