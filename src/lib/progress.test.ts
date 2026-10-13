// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { LEVEL_COUNT } from './levels'
import {
  UNLOCKED_LEVEL_KEY,
  getStarsList,
  getUnlockedLevel,
  levelsPassed,
  parseStarsList,
  parseUnlockedLevel,
  saveLevelResult,
  starsFromList,
} from './progress'

beforeEach(() => {
  window.localStorage.clear()
})

describe('the progress of Levels', () => {
  it('with nothing stored it starts with the first, with no stars', () => {
    expect(getUnlockedLevel()).toBe(1)
    expect(parseUnlockedLevel(null)).toBe(1)
    expect(parseStarsList(null).split(',')).toHaveLength(LEVEL_COUNT)
  })

  it('anything odd in the storage does not open levels that do not exist', () => {
    expect(parseUnlockedLevel('99')).toBe(LEVEL_COUNT)
    expect(parseUnlockedLevel('three')).toBe(1)
    expect(starsFromList(parseStarsList('3,7,x'), 2)).toBe(0)
  })

  it('passing the highest opens the next and notes down the stars, which only go up', () => {
    expect(saveLevelResult(1, 2)).toBe(2)
    expect(window.localStorage.getItem(UNLOCKED_LEVEL_KEY)).toBe('2')
    saveLevelResult(1, 1)
    expect(starsFromList(getStarsList(), 1)).toBe(2)
    expect(saveLevelResult(1, 0)).toBe(2)
    expect(levelsPassed(getStarsList())).toBe(1)
  })
})

describe('a tampered list of stars', () => {
  it('is read as zero, not as whatever number it says', () => {
    // It is edited by hand from the browser's tools in two clicks.
    expect(starsFromList('9,x,-1', 1)).toBe(0)
    expect(starsFromList('9,x,-1', 2)).toBe(0)
  })
})

describe('repeating a level with fewer stars', () => {
  it('does not erase the ones it already had', () => {
    // The stars are the best of what has been done: if they went down on
    // playing again, repeating would punish instead of rewarding.
    saveLevelResult(1, 3)
    saveLevelResult(1, 1)

    expect(starsFromList(getStarsList(), 1)).toBe(3)
  })
})
