import type { GameMode } from './gameMode'
import { MENU_EN } from './menuWords'

/**
 * The warm-up: the first run with the headset, while the tutorial is in front, does not count.
 *
 * **The problem.** The menu opens on the challenge and the tutorial runs on top of it: the sticks
 * that got away while someone was learning to close their hand used up the challenge's three
 * lives, and the one lost in ten seconds without knowing what to do was the run that gives a
 * medal. It is the common recipe of the hall's seventeen games: while the gesture is being
 * learned, nothing that happens counts.
 *
 * **In Stick Rush, nothing counts means that the sticks that fall to the floor take no lives** and
 * the run does not end: catching sounds, vibrates and adds to the scoreboard, as always, so that
 * what happens is learned. The tutorial closes through its steps (catching two sticks), through
 * «Siguiente», through «Saltar» or through its deadline, and then **the challenge starts from
 * scratch**: machine loaded again, countdown, three lives and on the sign «Ahora cuenta para
 * medalla» until the first stick.
 *
 * **Never in the challenge of the day** (the one that brings a seed from the hall comes in with no
 * lesson) **nor with two players**, and only in the challenge: practice and levels give no medal,
 * so there is nothing to protect.
 */
export function inWarmup({
  teaching,
  gameMode,
  twoPlayers,
  inChallenge,
}: {
  /** The run is teaching: with a headset and without the tutorial seen (the store's `teaching`). */
  teaching: boolean
  gameMode: GameMode
  /** Two play, passing the controller to each other. */
  twoPlayers: boolean
  /** It is the hall's challenge of the day. */
  inChallenge: boolean
}): boolean {
  return teaching && gameMode === 'challenge' && !twoPlayers && !inChallenge
}

/** What the thing being played meanwhile is called, on the sign that says it does not count. */
export const WARMUP = MENU_EN.warmup

/** The one-line notice when the tutorial closes, until the challenge's first stick is settled. */
export const NOW_IT_COUNTS = MENU_EN.nowItCounts
