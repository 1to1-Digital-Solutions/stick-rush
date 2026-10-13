import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getBestEndlessStreak,
  getBestPoints,
  getServerBestPoints,
  HIGH_SCORE_KEYS,
  parseBestPoints,
  readBestPoints,
  saveBestEndlessStreak,
  saveBestPoints,
  subscribeBestPoints,
  writeBestPoints,
} from './highScore'

/** Fake storage, with just what the record uses. */
function fakeStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(HIGH_SCORE_KEYS.practice, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage
}

/** The one browsers have in private mode: it throws instead of failing. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('quota exhausted', 'QuotaExceededError')
    },
  } as unknown as Storage
}

describe('reading what is stored', () => {
  it('accepts a non-negative integer', () => {
    expect(parseBestPoints('0')).toBe(0)
    expect(parseBestPoints('1234')).toBe(1234)
  })

  it('discards what is not a score', () => {
    // Anyone can edit the storage from the browser: what is not
    // understood counts as "there is no record yet", never as a loose NaN.
    expect(parseBestPoints(null)).toBe(0)
    expect(parseBestPoints('')).toBe(0)
    expect(parseBestPoints('   ')).toBe(0)
    expect(parseBestPoints('a million')).toBe(0)
    expect(parseBestPoints('-500')).toBe(0)
    expect(parseBestPoints('12.5')).toBe(0)
    expect(parseBestPoints('Infinity')).toBe(0)
    expect(parseBestPoints('1e999')).toBe(0)
    expect(parseBestPoints('9007199254740993')).toBe(0)
  })

  it('reads the record from its key', () => {
    expect(readBestPoints(fakeStorage('2500'), 'practice')).toBe(2500)
  })

  it('practice keeps the key from before there were modes', () => {
    // It is the promise that nobody loses their record on updating: changing it
    // would leave the previous best orphaned in the browser, and the game would start
    // as if it had never been played.
    expect(HIGH_SCORE_KEYS.practice).toBe('stick-rush:best-points')
    expect(HIGH_SCORE_KEYS.challenge).not.toBe(HIGH_SCORE_KEYS.practice)
  })

  it('without storage the game is played without a previous record', () => {
    expect(readBestPoints(null, 'practice')).toBe(0)
  })

  it('a blocked storage does not break the run', () => {
    // In private mode `localStorage` exists but throws when touched.
    expect(readBestPoints(blockedStorage(), 'practice')).toBe(0)
  })
})

describe('writing the record', () => {
  it('saves the score in its key', () => {
    const storage = fakeStorage()
    writeBestPoints(storage, 'practice', 3200)
    expect(storage.getItem(HIGH_SCORE_KEYS.practice)).toBe('3200')
  })

  it('does not write what the read would discard', () => {
    const storage = fakeStorage()
    const setItem = vi.spyOn(storage, 'setItem')

    writeBestPoints(storage, 'practice', -1)
    writeBestPoints(storage, 'practice', 12.5)
    writeBestPoints(storage, 'practice', Number.NaN)
    writeBestPoints(storage, 'practice', Number.POSITIVE_INFINITY)

    expect(setItem).not.toHaveBeenCalled()
  })

  it('without storage it does nothing and does not throw', () => {
    expect(() => writeBestPoints(null, 'practice', 100)).not.toThrow()
  })

  it('if the browser refuses to save, the game goes on', () => {
    // Quota exhausted or writing forbidden: the record is lost, not the run.
    expect(() =>
      writeBestPoints(blockedStorage(), 'practice', 100),
    ).not.toThrow()
  })
})

describe('the record the game sees', () => {
  // These tests do use jsdom's `localStorage`, because it is the store the
  // game subscribes to.
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts at zero and comes from what is stored', () => {
    expect(getBestPoints('practice')).toBe(0)

    localStorage.setItem(HIGH_SCORE_KEYS.practice, '4100')
    expect(getBestPoints('practice')).toBe(4100)
  })

  it('on the server there is no record to paint', () => {
    // It is what keeps the server's HTML and the browser's the same.
    expect(getServerBestPoints()).toBe(0)
  })

  it('saves the score when it improves the previous one', () => {
    saveBestPoints('practice', 1500)
    expect(getBestPoints('practice')).toBe(1500)
    expect(localStorage.getItem(HIGH_SCORE_KEYS.practice)).toBe('1500')
  })

  it('a worse or equal score does not touch the record', () => {
    saveBestPoints('practice', 1500)

    saveBestPoints('practice', 900)
    saveBestPoints('practice', 1500)

    expect(getBestPoints('practice')).toBe(1500)
  })

  it('notifies only whoever is still subscribed, and only if there is a new record', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeBestPoints(listener)

    saveBestPoints('practice', 2000)
    expect(listener).toHaveBeenCalledTimes(1)

    // A worse run changes nothing to repaint.
    saveBestPoints('practice', 10)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    saveBestPoints('practice', 9000)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('each mode has its record and they do not overwrite each other', () => {
    // A challenge is cut short when the lives run out, so it can never score
    // more than the equivalent practice: with a shared best, the mode with
    // something at stake would be the only one that would never beat it.
    saveBestPoints('practice', 5000)
    saveBestPoints('challenge', 1200)

    expect(getBestPoints('practice')).toBe(5000)
    expect(getBestPoints('challenge')).toBe(1200)

    // And a challenge worse than the practice record does beat its own.
    saveBestPoints('challenge', 1800)
    expect(getBestPoints('challenge')).toBe(1800)
    expect(getBestPoints('practice')).toBe(5000)
  })

  it('finds out that another tab has changed the record', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeBestPoints(listener)

    localStorage.setItem(HIGH_SCORE_KEYS.practice, '7000')
    window.dispatchEvent(
      new StorageEvent('storage', { key: HIGH_SCORE_KEYS.practice }),
    )

    expect(listener).toHaveBeenCalledTimes(1)
    expect(getBestPoints('practice')).toBe(7000)

    unsubscribe()
    window.dispatchEvent(
      new StorageEvent('storage', { key: HIGH_SCORE_KEYS.practice }),
    )
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('the streak of the endless run', () => {
  it('is only saved if it improves, and does not accept an impossible streak', () => {
    saveBestEndlessStreak(5)
    saveBestEndlessStreak(3)
    for (const streak of [0, -1, 2.5, Number.NaN]) saveBestEndlessStreak(streak)

    expect(getBestEndlessStreak()).toBe(5)
  })
})
