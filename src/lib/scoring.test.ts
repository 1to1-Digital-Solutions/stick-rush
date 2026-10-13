import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER, type Difficulty } from './gameConfig'
import {
  BASE_STICK_POINTS,
  DIFFICULTY_MULTIPLIERS,
  MAX_STREAK_MULTIPLIER,
  maxScore,
  reflexMultiplier,
  scoreRatio,
  stickPoints,
  streakMultiplier,
} from './scoring'

/** Catching a stick in the best of the possible cases. */
function perfect(difficulty: Difficulty, streak: number) {
  return stickPoints({ difficulty, streak, fallProgress: 0 })
}

describe('difficulty multiplier', () => {
  it('covers all the levels of the game', () => {
    for (const level of DIFFICULTY_ORDER) {
      expect(DIFFICULTY_MULTIPLIERS[level]).toBeGreaterThan(0)
    }
    expect([...DIFFICULTY_ORDER].sort()).toEqual(
      Object.keys(DIFFICULTY_MULTIPLIERS).sort(),
    )
  })

  it('grows with the difficulty, with no ties', () => {
    const values = DIFFICULTY_ORDER.map((l) => DIFFICULTY_MULTIPLIERS[l])
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })

  it('choosing hard pays off: a short run on Impossible beats a long one on Easy', () => {
    // If it were not so, the difficulty would be decorative and everybody would play on
    // Easy with 13 sticks.
    expect(maxScore('impossible', 5)).toBeGreaterThan(maxScore('easy', 13))
  })
})

describe('streak', () => {
  it('the first stick carries no bonus', () => {
    expect(streakMultiplier(1)).toBe(1)
    expect(streakMultiplier(0)).toBe(1)
  })

  it('each chained stick adds', () => {
    expect(streakMultiplier(2)).toBeGreaterThan(streakMultiplier(1))
    expect(streakMultiplier(5)).toBeGreaterThan(streakMultiplier(4))
  })

  it('has a cap: a long run on Easy cannot run away', () => {
    expect(streakMultiplier(1000)).toBe(MAX_STREAK_MULTIPLIER)
    expect(streakMultiplier(13)).toBeLessThanOrEqual(MAX_STREAK_MULTIPLIER)
  })
})

describe('reflexes', () => {
  it('catching it just released is worth double that of floor level', () => {
    expect(reflexMultiplier(0)).toBe(2)
    expect(reflexMultiplier(1)).toBe(1)
  })

  it('decreases continuously as the stick falls', () => {
    let previous = Infinity
    for (let i = 0; i <= 10; i++) {
      const value = reflexMultiplier(i / 10)
      expect(value).toBeLessThan(previous)
      previous = value
    }
  })

  it('a stick caught while it hangs counts as the best case', () => {
    // `fallProgress` is negative while it has not been released.
    expect(reflexMultiplier(-0.5)).toBe(2)
  })

  it('withstands impossible values without breaking the score', () => {
    expect(reflexMultiplier(4)).toBe(1)
    expect(reflexMultiplier(Number.NaN)).toBe(1)
  })
})

describe('points of a stick', () => {
  it('are always an integer', () => {
    for (const level of DIFFICULTY_ORDER) {
      for (const progress of [0, 0.33, 0.5, 0.77, 1]) {
        const points = stickPoints({
          difficulty: level,
          streak: 3,
          fallProgress: progress,
        })
        expect(Number.isInteger(points)).toBe(true)
      }
    }
  })

  it('the base case is the reference value', () => {
    // Easy, first stick, at floor level: with no multiplier at all.
    expect(stickPoints({ difficulty: 'easy', streak: 1, fallProgress: 1 })).toBe(
      BASE_STICK_POINTS,
    )
  })

  it('is never worth less than the base case', () => {
    for (const level of DIFFICULTY_ORDER) {
      expect(
        stickPoints({ difficulty: level, streak: 1, fallProgress: 1 }),
      ).toBeGreaterThanOrEqual(BASE_STICK_POINTS)
    }
  })

  it('the same stick pays more in a live streak', () => {
    const cold = stickPoints({ difficulty: 'hard', streak: 1, fallProgress: 0.5 })
    const hot = stickPoints({ difficulty: 'hard', streak: 6, fallProgress: 0.5 })
    expect(hot).toBeGreaterThan(cold)
  })
})

describe('maximum and ratio', () => {
  it('the maximum grows with the sticks and with the difficulty', () => {
    expect(maxScore('easy', 13)).toBeGreaterThan(maxScore('easy', 5))
    expect(maxScore('expert', 9)).toBeGreaterThan(maxScore('medium', 9))
  })

  it('a perfect run reaches the maximum', () => {
    // The sticks are added one by one as the game would do it, with the streak alive.
    let total = 0
    for (let i = 1; i <= 7; i++) {
      total += perfect('hard', i)
    }
    expect(total).toBe(maxScore('hard', 7))
    expect(scoreRatio(total, 'hard', 7)).toBe(1)
  })

  it('the ratio stays between 0 and 1 whatever happens', () => {
    expect(scoreRatio(0, 'easy', 5)).toBe(0)
    expect(scoreRatio(-100, 'easy', 5)).toBe(0)
    expect(scoreRatio(999999, 'easy', 5)).toBe(1)
    // With no sticks there is no run, and one cannot divide by zero.
    expect(scoreRatio(0, 'easy', 0)).toBe(0)
  })
})
