import { describe, expect, it } from 'vitest'
import {
  CLOSED,
  MAX_BEND,
  REST,
  approachPose,
  fingerAngles,
  pressAmount,
  glovePose,
} from './glove'

describe('what is read from the controller', () => {
  it('the analogue value if there is one, clamped', () => {
    expect(pressAmount({ state: 'touched', button: 0.4 })).toBe(0.4)
    expect(pressAmount({ state: 'pressed', button: 1.3 })).toBe(1)
    expect(pressAmount({ state: 'default', button: -0.2 })).toBe(0)
  })

  it('without an analogue value, pressed or not', () => {
    expect(pressAmount({ state: 'pressed' })).toBe(1)
    expect(pressAmount({ state: 'touched' })).toBe(0)
    expect(pressAmount({ state: 'pressed', button: Number.NaN })).toBe(1)
  })

  it('a button the controller does not have is not squeezed', () => {
    expect(pressAmount(undefined)).toBe(0)
  })
})

describe('the pose of the glove', () => {
  it('loose, it wraps the handle without squeezing: neither fully open nor a fist', () => {
    const loose = glovePose({ grip: 0, trigger: 0 })
    expect(loose.fingers).toBe(REST)
    expect(loose.index).toBe(REST)
    expect(loose.fingers).toBeGreaterThan(0)
    expect(loose.fingers).toBeLessThan(CLOSED)
  })

  it('the side trigger closes the fist, index finger included', () => {
    const fist = glovePose({ grip: 1, trigger: 0 })
    expect(fist.fingers).toBe(1)
    expect(fist.fingers).toBeGreaterThanOrEqual(CLOSED)
    expect(fist.index).toBeGreaterThan(REST)
    expect(fist.thumb).toBeGreaterThan(REST)
    expect(fist.thumb).toBeLessThan(1)
  })

  it('the front trigger only moves the index finger', () => {
    const pointing = glovePose({ grip: 0, trigger: 1 })
    expect(pointing.index).toBe(1)
    expect(pointing.fingers).toBe(REST)
  })

  it('a broken reading does not bend the hand backwards', () => {
    const broken = glovePose({ grip: Number.NaN, trigger: -3 })
    expect(broken).toEqual(glovePose({ grip: 0, trigger: 0 }))
  })
})

describe('the hand closes, it does not jump', () => {
  const open = glovePose({ grip: 0, trigger: 0 })
  const fist = glovePose({ grip: 1, trigger: 1 })

  it('one frame covers only part of the way', () => {
    const step = approachPose(open, fist, 1 / 90)
    expect(step.fingers).toBeGreaterThan(open.fingers)
    expect(step.fingers).toBeLessThan(fist.fingers)
    expect(step.index).toBeLessThan(fist.index)
    expect(step.thumb).toBeLessThan(fist.thumb)
  })

  it('and in a couple of tenths it is closed: it is seen closing on the catch', () => {
    let hand = open
    for (let i = 0; i < 18; i++) hand = approachPose(hand, fist, 1 / 90)
    expect(hand.fingers).toBeGreaterThan(CLOSED)
  })

  it('an impossible delta moves nothing', () => {
    expect(approachPose(open, fist, Number.NaN)).toEqual(open)
    expect(approachPose(open, fist, -1)).toEqual(open)
  })
})

describe('the fingers', () => {
  it('bend in proportion to the closure, until they wrap the handle', () => {
    expect(fingerAngles(0)).toEqual([0, 0, 0])
    expect(fingerAngles(1)).toEqual([...MAX_BEND])
    expect(fingerAngles(2)).toEqual([...MAX_BEND])
    const total = MAX_BEND.reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(Math.PI)
    expect(total).toBeLessThan(Math.PI * 1.5)
  })
})
