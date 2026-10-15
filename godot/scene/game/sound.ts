/**
 * What sounds in Stick Rush and when: the rule of the web's `useGameSound.ts`, without React, over
 * the effects rendered from its `sound.ts` (`godot-kit.json`).
 *
 * The web compares the counters of the run with those of the previous render and fires what has
 * happened: **catching** (its note goes up a semitone per stick of streak, up to seven:
 * `catchFrequency`), **missing**, each **second of the countdown** (3, 2 and 1, each on its note),
 * the **start** when the count ends, the **medal threshold** that is crossed (two short notes,
 * higher the better the medal is) and the **end** —winning, losing or just finishing
 * (`roundOutcome`)— with the **record** on top if there is one. Here it is compared the same way,
 * from one frame to the next. As on the web, two sticks resolved at once sound only once: two
 * copies of the same sound at once are not heard as two.
 *
 * The effects are files, one per distinct trigger of the web: the note of the catch comes in eight
 * (`catch-1`…`catch-8`, from streak 1 to 8 and beyond), the countdown in three and the threshold in
 * three.
 */
import { thresholdCrossed, type Medal } from '@/lib/goal'

import type { RunPhase } from './run'

/** All the effect files, those of `godot-kit.json`. */
export const SOUNDS = [
  'catch-1',
  'catch-2',
  'catch-3',
  'catch-4',
  'catch-5',
  'catch-6',
  'catch-7',
  'catch-8',
  'miss',
  'countdown-3',
  'countdown-2',
  'countdown-1',
  'go',
  'over-win',
  'over-loss',
  'over-close',
  'record',
  'medal-bronze',
  'medal-silver',
  'medal-gold',
] as const

/** What the effect of each medal threshold is called (`{ name: 'medal', rank }` in `sound.ts`). */
export const THRESHOLD_SOUND = { bronze: 'medal-bronze', silver: 'medal-silver', gold: 'medal-gold' } as const satisfies Record<Medal, string>

export type Sound = (typeof SOUNDS)[number]

/** From this streak on the note of the catch no longer goes up (`CATCH_MAX_SEMITONES` + 1). */
export const HIGHEST_NOTE_STREAK = 8

/** What is compared from one frame to the next. */
export interface Cues {
  score: number
  missed: number
  countdown: number
  gameState: RunPhase
  streak: number
  /**
   * Whether the end sounds like winning on top of the close: the record beaten, or the end of a
   * two-player run (`celebrates` of the run).
   */
  isRecord: boolean
  /** Whether what ends is the second round of a two-player run: the close sounds like winning. */
  duelEnds?: boolean
  /** Whether the finished level was passed, or `null` outside the levels. */
  levelPassed: boolean | null
  lives: number | null
  /** The medal that already belongs to whoever plays (`medal` of the run): when it goes up, its threshold sounds. */
  medal?: Medal | null
}

/** How the end sounds (`roundOutcome` in `useGameSound.ts`). */
export function endingSound(levelPassed: boolean | null, lives: number | null): 'win' | 'loss' | 'close' {
  if (levelPassed != null) return levelPassed ? 'win' : 'loss'
  if (lives != null) return lives > 0 ? 'win' : 'loss'
  return 'close'
}

/** What has to sound when going from `before` to `now`, in order. */
export function soundsBetween(before: Cues, now: Cues): Sound[] {
  const sounds: Sound[] = []
  if (now.score > before.score) sounds.push(`catch-${Math.min(Math.max(1, Math.round(now.streak)), HIGHEST_NOTE_STREAK)}` as Sound)
  if (now.missed > before.missed) sounds.push('miss')
  if (now.gameState === 'countdown' && now.countdown > 0 && now.countdown !== before.countdown) {
    sounds.push(`countdown-${Math.min(3, Math.max(1, now.countdown))}` as Sound)
  }
  if (now.gameState === 'playing' && before.gameState === 'countdown') sounds.push('go')
  // The medal threshold that has just been crossed, besides the catch that crossed it.
  const crossed = thresholdCrossed(before.medal ?? null, now.medal ?? null)
  if (crossed != null) sounds.push(THRESHOLD_SOUND[crossed])
  if (now.gameState === 'finished' && before.gameState !== 'finished') {
    // The end of a two-player run sounds like winning: someone of those in front wins it, or they
    // tie, even if the second one has run out of lives.
    sounds.push(`over-${now.duelEnds === true ? 'win' : endingSound(now.levelPassed, now.lives)}` as Sound)
    // The record goes on top of the close and not instead of it.
    if (now.isRecord) sounds.push('record')
  }
  return sounds
}
