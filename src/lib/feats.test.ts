import { describe, expect, it } from 'vitest'
import { MAX_STICKS } from './gameConfig'
import {
  BEHIND_BACK_TURN,
  FEATS,
  FEATS_KEY,
  NO_FEATS,
  hoopAtMinimum,
  withFeats,
  countCatch,
  countRound,
  isBehindBack,
  earnFeats,
  readFeats,
} from './feats'
import { HOOP_ADJUST_RANGE, HOOP_ADJUST_STEP } from './hoopHeight'

/** An in-memory storage: the Godot engine has neither `localStorage` nor `vi`. */
function memoryStorage(initial: Record<string, string> = {}): Storage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

/** The head at the centre looking towards `−z` (towards the machine), and the stick at the requested angle. */
function stickAt(degrees: number, distance = 0.65) {
  const a = (degrees * Math.PI) / 180
  return {
    head: { x: 0, z: 0 },
    gaze: { x: 0, z: -1 },
    stick: { x: Math.sin(a) * distance, z: -Math.cos(a) * distance },
  }
}

describe('isBehindBack', () => {
  it('from the front, from the side or out of the corner of the eye is not behind the back', () => {
    for (const degrees of [0, 45, -60, 90, -90, 115]) expect(isBehindBack(stickAt(degrees))).toBe(false)
  })

  it('with the stick behind the shoulder it is, on both sides', () => {
    for (const degrees of [125, -125, 180]) expect(isBehindBack(stickAt(degrees))).toBe(true)
  })

  it('the threshold is the behind-the-back turn: one degree before no, one degree after yes', () => {
    const threshold = (BEHIND_BACK_TURN * 180) / Math.PI
    expect(isBehindBack(stickAt(threshold - 1))).toBe(false)
    expect(isBehindBack(stickAt(threshold + 1))).toBe(true)
  })

  it('it counts on the ground: the head turned with the machine behind, standing anywhere', () => {
    // Facing +x, at (2, 3), with the stick behind their back at −x.
    expect(isBehindBack({ head: { x: 2, z: 3 }, gaze: { x: 5, z: 0 }, stick: { x: 1.4, z: 3.1 } })).toBe(true)
    expect(isBehindBack({ head: { x: 2, z: 3 }, gaze: { x: 5, z: 0 }, stick: { x: 2.6, z: 3.1 } })).toBe(false)
  })

  it('with the stick right above the head, or looking at the sky, there is no back to speak of', () => {
    expect(isBehindBack({ head: { x: 0, z: 0 }, gaze: { x: 0, z: -1 }, stick: { x: 0.01, z: 0.02 } })).toBe(false)
    expect(isBehindBack({ head: { x: 0, z: 0 }, gaze: { x: 0, z: 0 }, stick: { x: 0, z: 0.6 } })).toBe(false)
  })
})

describe('countCatch', () => {
  it('the catch behind the back gives SR_BEHIND_BACK', () => {
    expect(countCatch(NO_FEATS, { behind: true }).earned).toEqual([FEATS.behindBack])
  })

  it('one from the front gives nothing, and does not touch the count', () => {
    expect(countCatch(NO_FEATS, { behind: false })).toBe(NO_FEATS)
  })

  it('two behind the back in the same run are a single feat', () => {
    const one = countCatch(NO_FEATS, { behind: true })
    expect(countCatch(one, { behind: true })).toBe(one)
  })
})

describe('countRound', () => {
  it('the thirteen of a round without any getting away give SR_CLEAN_SWEEP', () => {
    const count = countRound(NO_FEATS, { sticks: MAX_STICKS, caught: MAX_STICKS, hoopAdjustment: 0 })
    expect(count.earned).toEqual([FEATS.cleanSweep])
  })

  it('twelve of thirteen does not: one that got away is enough to lose it', () => {
    expect(countRound(NO_FEATS, { sticks: MAX_STICKS, caught: MAX_STICKS - 1, hoopAdjustment: 0 })).toBe(NO_FEATS)
  })

  it('a clean round of fewer sticks is not the full machine', () => {
    expect(countRound(NO_FEATS, { sticks: MAX_STICKS - 1, caught: MAX_STICKS - 1, hoopAdjustment: 0 })).toBe(NO_FEATS)
  })

  it('with the hoop at the minimum, a whole round without any getting away gives SR_LOW_HOOP, however many it has', () => {
    const count = countRound(NO_FEATS, { sticks: 5, caught: 5, hoopAdjustment: -HOOP_ADJUST_RANGE })
    expect(count.earned).toEqual([FEATS.lowHoop])
  })

  it('with the hoop one step above the minimum it does not, nor with the minimum and one that got away', () => {
    const oneStepUp = -HOOP_ADJUST_RANGE + HOOP_ADJUST_STEP
    expect(countRound(NO_FEATS, { sticks: 5, caught: 5, hoopAdjustment: oneStepUp })).toBe(NO_FEATS)
    expect(countRound(NO_FEATS, { sticks: 5, caught: 4, hoopAdjustment: -HOOP_ADJUST_RANGE })).toBe(NO_FEATS)
  })

  it('the full machine with the hoop at the minimum gives both, only once each', () => {
    const round = { sticks: MAX_STICKS, caught: MAX_STICKS, hoopAdjustment: -HOOP_ADJUST_RANGE }
    const one = countRound(NO_FEATS, round)
    expect(one.earned).toEqual([FEATS.cleanSweep, FEATS.lowHoop])
    expect(countRound(one, round)).toBe(one)
  })

  it('a round with no sticks does not count', () => {
    expect(countRound(NO_FEATS, { sticks: 0, caught: 0, hoopAdjustment: -HOOP_ADJUST_RANGE })).toBe(NO_FEATS)
  })

  it('the minimum accepts the rounding of adding 5 cm steps', () => {
    const summed = [1, 2, 3, 4].reduce((adjustment) => adjustment - HOOP_ADJUST_STEP, 0)
    expect(hoopAtMinimum(summed)).toBe(true)
    expect(hoopAtMinimum(0)).toBe(false)
  })
})

describe('what is stored', () => {
  it('it is first earned once: it is stored and the second run no longer counts it', () => {
    const storage = memoryStorage()
    expect(earnFeats([FEATS.behindBack], storage)).toEqual([FEATS.behindBack])
    expect(JSON.parse(storage.data.get(FEATS_KEY)!)).toEqual([FEATS.behindBack])
    expect(earnFeats([FEATS.behindBack], storage)).toEqual([])
    expect(readFeats(storage)).toEqual([FEATS.behindBack])
  })

  it('it adds to what was already there without repeating, and with nothing new it does not write', () => {
    const storage = memoryStorage({ [FEATS_KEY]: JSON.stringify([FEATS.cleanSweep]) })
    expect(earnFeats([FEATS.cleanSweep, FEATS.lowHoop], storage)).toEqual([FEATS.lowHoop])
    expect(readFeats(storage)).toEqual([FEATS.cleanSweep, FEATS.lowHoop])
    const before = storage.data.get(FEATS_KEY)
    expect(earnFeats([FEATS.lowHoop], storage)).toEqual([])
    expect(storage.data.get(FEATS_KEY)).toBe(before)
  })

  it('what is not a feat of this game is neither first earned nor read', () => {
    const storage = memoryStorage({ [FEATS_KEY]: JSON.stringify(['GH_SHUTOUT', FEATS.behindBack]) })
    expect(readFeats(storage)).toEqual([FEATS.behindBack])
    expect(earnFeats(['GH_SHUTOUT'], storage)).toEqual([])
  })

  it('what is unreadable or is not a list counts as nothing', () => {
    expect(readFeats(memoryStorage({ [FEATS_KEY]: '{broken' }))).toEqual([])
    expect(readFeats(memoryStorage({ [FEATS_KEY]: '"SR_LOW_HOOP"' }))).toEqual([])
    expect(readFeats(memoryStorage())).toEqual([])
  })

  it('without storage they all look new, and nothing breaks', () => {
    expect(readFeats(null)).toEqual([])
    expect(earnFeats([FEATS.behindBack], null)).toEqual([FEATS.behindBack])
  })

  it('with writing forbidden they are given all the same and given again next time', () => {
    const storage = memoryStorage()
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(earnFeats([FEATS.lowHoop], storage)).toEqual([FEATS.lowHoop])
    expect(earnFeats([FEATS.lowHoop], storage)).toEqual([FEATS.lowHoop])
  })
})

describe('withFeats', () => {
  const result = { mode: 'practice', points: 120, challenge: false }

  it('with one first earned, the result carries it', () => {
    expect(withFeats(result, [FEATS.cleanSweep])).toEqual({ ...result, feats: [FEATS.cleanSweep] })
  })

  it('with none, the result is the usual one, without the field', () => {
    expect(withFeats(result, [])).toBe(result)
    expect('feats' in withFeats(result, [])).toBe(false)
  })
})
