import { describe, expect, it } from 'vitest'
import { MAX_STICKS } from './gameConfig'
import {
  CHALLENGE_LIVES,
  CHALLENGE_SETUP,
  GAME_MODE_LABELS,
  GAME_MODE_ORDER,
  picksSetup,
  remainingLives,
  runOutcome,
  startingLives,
} from './gameMode'

/**
 * The rules of the two modes. What is checked here is when a run ends and
 * with how many lives, which is the only thing that tells the challenge from
 * practice: if this goes out of line, the challenge turns into a normal run
 * (or the other way round, practice closes on the third miss).
 */

describe('lives of each mode', () => {
  it('practice is not played with lives', () => {
    // `null` and not zero: zero is having lost, and practice cannot be lost.
    expect(startingLives('practice')).toBeNull()
    expect(remainingLives('practice', 0)).toBeNull()
    expect(remainingLives('practice', 99)).toBeNull()
  })

  it('the challenge starts with three lives', () => {
    expect(startingLives('challenge')).toBe(CHALLENGE_LIVES)
    expect(CHALLENGE_LIVES).toBe(3)
  })

  it('each stick that gets away costs a life', () => {
    expect(remainingLives('challenge', 0)).toBe(3)
    expect(remainingLives('challenge', 1)).toBe(2)
    expect(remainingLives('challenge', 2)).toBe(1)
    expect(remainingLives('challenge', 3)).toBe(0)
  })

  it('it does not go below zero however many misses arrive', () => {
    // Two sticks can touch the ground in the same batch right as the last
    // life runs out; a negative counter would be painted as lives missing.
    expect(remainingLives('challenge', 5)).toBe(0)
  })
})

describe('when the run ends', () => {
  it('in practice, when the last stick is resolved', () => {
    expect(
      runOutcome({ mode: 'practice', resolved: 4, misses: 4, stickCount: 5 }),
    ).toBeNull()
    expect(
      runOutcome({ mode: 'practice', resolved: 5, misses: 5, stickCount: 5 }),
    ).toBe('cleared')
  })

  it('in practice, missing them all does not cut it short', () => {
    // It is what separates the two modes: here missing costs nothing.
    expect(
      runOutcome({ mode: 'practice', resolved: 3, misses: 3, stickCount: 13 }),
    ).toBeNull()
  })

  it('in the challenge, on running out of lives even if sticks are left', () => {
    expect(
      runOutcome({ mode: 'challenge', resolved: 2, misses: 2, stickCount: 13 }),
    ).toBeNull()
    expect(
      runOutcome({ mode: 'challenge', resolved: 3, misses: 3, stickCount: 13 }),
    ).toBe('failed')
  })

  it('in the challenge, resolving them all with lives left is beating the challenge', () => {
    expect(
      runOutcome({ mode: 'challenge', resolved: 5, misses: 2, stickCount: 5 }),
    ).toBe('cleared')
  })

  it('running out of lives with the last stick is losing, not completing', () => {
    // The stick that uses up the last life can also be the last one of the
    // run. Counting it as a beaten challenge would give away a lost challenge.
    expect(
      runOutcome({ mode: 'challenge', resolved: 5, misses: 3, stickCount: 5 }),
    ).toBe('failed')
  })

  it('catching sticks does not use up lives', () => {
    expect(
      runOutcome({ mode: 'challenge', resolved: 12, misses: 0, stickCount: 13 }),
    ).toBeNull()
  })
})

describe('presentation of the modes', () => {
  it('all three are offered, from practice to the challenge', () => {
    expect(GAME_MODE_ORDER).toEqual(['practice', 'levels', 'challenge'])
  })

  it('the levels are played without lives, like practice', () => {
    expect(startingLives('levels')).toBeNull()
    expect(runOutcome({ mode: 'levels', resolved: 5, misses: 5, stickCount: 5 })).toBe('cleared')
  })

  it('each mode has a label in the product language', () => {
    for (const mode of GAME_MODE_ORDER) {
      expect(GAME_MODE_LABELS[mode]).toBeTruthy()
    }
  })
})

describe('what each mode asks', () => {
  it('only practice asks for sticks and speed', () => {
    expect(GAME_MODE_ORDER.filter(picksSetup)).toEqual(['practice'])
  })

  it('the challenge goes with the hoop full at medium speed: a challenge has to be demanding', () => {
    // It is the run of the cabinet's record and of the challenge of the day: changing it invalidates
    // the stored records and the medals of the manifest.
    expect(CHALLENGE_SETUP).toEqual({ difficulty: 'medium', stickCount: MAX_STICKS })
  })
})
