import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER } from './gameConfig'
import {
  clampLevel,
  LEVEL_COUNT,
  LEVEL_STICK_STEPS,
  levelPassed,
  levelSpec,
  levelStars,
  nextUnlocked,
} from './levels'

describe('the ladder of levels', () => {
  it('starts with the easiest and the shortest round', () => {
    expect(levelSpec(1)).toEqual({ level: 1, difficulty: DIFFICULTY_ORDER[0], stickCount: LEVEL_STICK_STEPS[0] })
  })

  it('raises the sticks before the speed, and goes through all the speeds', () => {
    expect(levelSpec(2).difficulty).toBe(DIFFICULTY_ORDER[0])
    expect(levelSpec(2).stickCount).toBeGreaterThan(levelSpec(1).stickCount)
    expect(levelSpec(4).difficulty).toBe(DIFFICULTY_ORDER[1])
    expect(levelSpec(4).stickCount).toBe(LEVEL_STICK_STEPS[0])
    expect(levelSpec(LEVEL_COUNT).difficulty).toBe(DIFFICULTY_ORDER[DIFFICULTY_ORDER.length - 1])
    expect(LEVEL_COUNT).toBe(15)
  })

  it('a level that does not exist falls to the nearest edge', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(LEVEL_COUNT + 10)).toBe(LEVEL_COUNT)
    expect(clampLevel(2.7)).toBe(2)
    expect(clampLevel(Number.NaN)).toBe(1)
  })
})

describe('the stars', () => {
  it('the first is more than half, the third is losing none', () => {
    expect(levelStars(2, 5)).toBe(0)
    expect(levelStars(3, 5)).toBe(1)
    expect(levelStars(4, 5)).toBe(2)
    expect(levelStars(5, 5)).toBe(3)
    expect(levelStars(8, 13)).toBe(1)
    expect(levelStars(11, 13)).toBe(2)
  })

  it('passing is one star at least', () => {
    expect(levelPassed(0)).toBe(false)
    expect(levelPassed(1)).toBe(true)
  })
})

describe('the unlocking', () => {
  it('passing the highest level opens the next, without going past the last', () => {
    expect(nextUnlocked(3, 3, 1)).toBe(4)
    expect(nextUnlocked(LEVEL_COUNT, LEVEL_COUNT, 3)).toBe(LEVEL_COUNT)
  })

  it('repeating a lower one or not passing leaves things as they were', () => {
    expect(nextUnlocked(5, 2, 3)).toBe(5)
    expect(nextUnlocked(3, 3, 0)).toBe(3)
  })
})

describe('the stars of an impossible round', () => {
  it('with no sticks to catch there are no stars to give', () => {
    // The endless round has no number of sticks: dividing by it would give infinity.
    expect(levelStars(3, 0)).toBe(0)
    expect(levelStars(3, Number.POSITIVE_INFINITY)).toBe(0)
  })
})
